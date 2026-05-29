'use client';

import { use, useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useProject } from '@/hooks/useProject';
import { useGenerate } from '@/hooks/useGenerate';
import { useProjectStore } from '@/stores/projectStore';
import { StageLayout } from '@/components/stages';
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import * as Diff from 'diff';
import type {
  ChapterVersion,
  EditorialPass,
  EditorialIssue,
  RevisionTask,
  SceneProseSegment,
} from '@/types';
import { parseRevisionVerification, type RevisionVerification } from '@/lib/generation/schemas';
import { getEffectiveModelForStage } from '@/lib/data/models';
import {
  EDITORIAL_PASSES,
  EDITORIAL_PASS_LABELS,
  tasksForPass,
  canProceedToExportFinal,
  parseEditorialPass,
} from '@/lib/editorial/passes';
import { assembleContext } from '@/lib/context/assembler';
import { spliceSceneIntoChapter } from '@/lib/editorial/sceneSplice';
import * as firestore from '@/lib/db/client';
import { estimateApplyAllRevisionsTokens, formatTokenRange } from '@/lib/cost/preflight';

interface RevisionPageProps {
  params: Promise<{ projectId: string }>;
}

export default function RevisionPage({ params }: RevisionPageProps) {
  const { projectId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const editorialPass: EditorialPass = parseEditorialPass(searchParams.get('pass')) ?? 'structural';

  const {
    project,
    chapters,
    documents,
    revisionTasks,
    loading: projectLoading,
    error: projectError,
    getApprovedChapterVersion,
    getLatestChapterVersion,
    getDocumentByType,
  } = useProject(projectId);

  const passTasks = useMemo(
    () => tasksForPass(revisionTasks, editorialPass),
    [revisionTasks, editorialPass]
  );

  const revisionGenOpts = useMemo(
    () => ({ projectId, usageSource: 'revision' as const }),
    [projectId]
  );

  const applyAllPreflightLabel = useMemo(() => {
    const q = passTasks.filter((t) => t.status === 'queued').length;
    if (q === 0) return null;
    const e = estimateApplyAllRevisionsTokens(q);
    return formatTokenRange(e.low, e.high);
  }, [passTasks]);
  
  const { loadRevisionTasks, loadEditorialIssues, createChapterVersion, updateChapterVersion, updateRevisionTask, loadChapterVersions, advanceStage } = useProjectStore();
  const { generate, isGenerating, error: generateError, clearError } = useGenerate();
  
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [revisedContent, setRevisedContent] = useState('');
  const [taskLinkedIssues, setTaskLinkedIssues] = useState<EditorialIssue[]>([]);
  const [verification, setVerification] = useState<RevisionVerification | null>(null);
  const [pendingDraftVersionId, setPendingDraftVersionId] = useState<string | null>(null);
  const [revisionScopeLabel, setRevisionScopeLabel] = useState('Full chapter');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showDiff, setShowDiff] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showApplyAllConfirm, setShowApplyAllConfirm] = useState(false);
  const [applyAllRunning, setApplyAllRunning] = useState(false);
  const [contextWarnings, setContextWarnings] = useState<string[]>([]);
  const [applyAllProgress, setApplyAllProgress] = useState<{
    current: number;
    total: number;
    chapterNumber: number;
  } | null>(null);
  
  // Load revision tasks
  useEffect(() => {
    if (projectId) {
      loadRevisionTasks(projectId);
    }
  }, [projectId, loadRevisionTasks]);
  
  useEffect(() => {
    if (!project || revisionTasks.length === 0 || project.currentStage !== 'revision') return;
    if (canProceedToExportFinal(project, revisionTasks)) {
      advanceStage(projectId, 'export-final');
    }
  }, [project, revisionTasks, projectId, advanceStage]);
  
  // Load chapter versions when chapters are available
  useEffect(() => {
    if (chapters.length > 0) {
      chapters.forEach(ch => {
        loadChapterVersions(ch.id);
      });
    }
  }, [chapters, loadChapterVersions]);
  
  // Load chapter versions when a chapter is selected
  useEffect(() => {
    if (selectedChapterId) {
      loadChapterVersions(selectedChapterId);
    }
  }, [selectedChapterId, loadChapterVersions]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = selectedTaskId ? passTasks.find((x) => x.id === selectedTaskId) : null;
      if (!t?.issueIds?.length) {
        setTaskLinkedIssues([]);
        return;
      }
      const list = await firestore.getEditorialIssuesByIds(t.issueIds);
      if (!cancelled) setTaskLinkedIssues(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTaskId, passTasks]);

  const processRevisionTask = useCallback(
    async (task: RevisionTask, options: { autoFinalize: boolean }) => {
      if (!project) throw new Error('Project not loaded');

      const chapter = chapters.find((c) => c.chapterNumber === task.chapterNumber);
      if (!chapter) {
        throw new Error(`Chapter ${task.chapterNumber} not found.`);
      }

      await loadChapterVersions(chapter.id);
      const versions = useProjectStore.getState().chapterVersions.get(chapter.id) || [];
      const originalVersion = versions.find((v) => v.approved);
      if (!originalVersion?.content?.trim()) {
        await updateRevisionTask(task.id, { status: 'done' });
        return;
      }

      await updateRevisionTask(task.id, { status: 'in_progress' });

      const issues =
        task.issueIds.length > 0
          ? await firestore.getEditorialIssuesByIds(task.issueIds)
          : [];

      let sceneScoped = false;
      let activeSceneId: string | undefined;
      let sceneIdx = 0;
      const segs = originalVersion.sceneSegments;
      if (segs?.length && issues.length > 0) {
        const sceneIds = issues.map((i) => i.sceneId).filter((x): x is string => !!x?.trim());
        if (sceneIds.length > 0 && sceneIds.every((id) => id === sceneIds[0])) {
          const cand = sceneIds[0]!;
          if (segs.some((s) => s.sceneId === cand)) {
            sceneScoped = true;
            activeSceneId = cand;
            sceneIdx = segs.findIndex((s) => s.sceneId === cand) + 1;
          }
        }
      }
      const totalScenes = segs?.length ?? 0;
      const scopeLabel =
        sceneScoped && totalScenes > 0
          ? `Scene ${sceneIdx} of ${totalScenes}`
          : 'Full chapter';
      if (!options.autoFinalize) {
        setRevisionScopeLabel(scopeLabel);
      }

      const originalContentForModel =
        sceneScoped && activeSceneId && segs
          ? (segs.find((s) => s.sceneId === activeSceneId)?.prose ?? originalVersion.content)
          : originalVersion.content;

      const charactersDoc = getDocumentByType('characters');
      const endingDoc = getDocumentByType('ending');
      const structureDoc = getDocumentByType('structure');
      const nicheDoc = getDocumentByType('niche');
      const approvedChapterVersions = Array.from(useProjectStore.getState().chapterVersions.values())
        .flat()
        .filter((version) => version.approved);
      const assembled = assembleContext({
        purpose: 'chapter-revision',
        project,
        documents,
        chapters,
        approvedChapterVersions,
        currentChapter: chapter,
        targetChapterNumber: chapter.chapterNumber,
        revisionInstructions: task.instructions,
        editorialPass,
      });
      if (!options.autoFinalize) {
        setContextWarnings(assembled.warnings);
      }

      const revisionModelId = getEffectiveModelForStage('revision').id;
      const result = await generate(
        'revision',
        {
          genre: project.genre,
          chapterNumber: chapter.chapterNumber,
          chapterTitle: chapter.title,
          originalContent: originalContentForModel,
          revisionInstructions:
            task.instructions || 'Review the chapter for overall quality and consistency.',
          acceptanceCriteria:
            task.acceptanceCriteria.length > 0
              ? task.acceptanceCriteria
              : ['The chapter should maintain consistency with established canon and character voices.'],
          assembledContext: assembled.text,
          charactersReference: charactersDoc?.content || '',
          endingReference: endingDoc?.content || '',
          structureReference: structureDoc?.content || '',
          nicheReference: nicheDoc?.content || '',
          editorialPass,
          ...(sceneScoped && activeSceneId ? { sceneRevisionSceneId: activeSceneId } : {}),
        },
        { model: revisionModelId, ...revisionGenOpts },
      );

      if (!result?.content?.trim()) {
        throw new Error(`Empty revision returned for chapter ${chapter.chapterNumber}.`);
      }

      let revisedFull = result.content;
      let newSceneSegments: SceneProseSegment[] | undefined;
      if (sceneScoped && activeSceneId && segs) {
        const spliced = spliceSceneIntoChapter(segs, activeSceneId, result.content.trim());
        revisedFull = spliced.content;
        newSceneSegments = spliced.segments;
      }

      const verifyExcerpt = sceneScoped ? result.content.trim() : revisedFull;

      const summaryResult = await generate('chapter-summary', {
        genre: project.genre,
        chapterNumber: chapter.chapterNumber,
        chapterTitle: chapter.title,
        chapterContent: revisedFull,
      }, revisionGenOpts);

      await loadChapterVersions(chapter.id);
      const refreshed = useProjectStore.getState().chapterVersions.get(chapter.id) || [];
      const latestSorted = [...refreshed].sort((a, b) => b.version - a.version);
      const latestVersion = latestSorted[0];
      const newVersionNum = (latestVersion?.version ?? 0) + 1;

      const versionData: Omit<ChapterVersion, 'id' | 'createdAt'> = {
        chapterId: chapter.id,
        projectId,
        chapterNumber: chapter.chapterNumber,
        version: newVersionNum,
        content: revisedFull,
        wordCount: revisedFull.split(/\s+/).filter(Boolean).length,
        approved: false,
        notes: summaryResult.content.trim(),
        ...(newSceneSegments ? { sceneSegments: newSceneSegments } : {}),
      };
      if (latestVersion?.id) {
        versionData.parentVersionId = latestVersion.id;
      }

      const draftId = await createChapterVersion(versionData);

      setIsVerifying(true);
      let verificationResult: RevisionVerification;
      try {
        const verifyRes = await generate(
          'revision-verify',
          {
            revisedContent: verifyExcerpt,
            instructions: task.instructions,
            issueDescriptions: issues.map((i) => i.description),
          },
          { model: getEffectiveModelForStage('revision-verify').id, ...revisionGenOpts },
        );
        verificationResult = parseRevisionVerification(verifyRes.content);
      } finally {
        setIsVerifying(false);
      }

      if (options.autoFinalize) {
        if (verificationResult.satisfied) {
          await firestore.updateChapterVersion(draftId, { approved: true });
          for (const id of task.issueIds) {
            await firestore.updateEditorialIssue(id, { status: 'resolved' });
          }
          await updateRevisionTask(task.id, { status: 'done' });
          await loadEditorialIssues(projectId);
        } else {
          await updateRevisionTask(task.id, { status: 'queued' });
        }
        await loadChapterVersions(chapter.id);
        await loadRevisionTasks(projectId);
      } else {
        setRevisedContent(revisedFull);
        setVerification(verificationResult);
        setPendingDraftVersionId(draftId);
        setRevisionScopeLabel(scopeLabel);
      }
    },
    [
      chapters,
      documents,
      project,
      projectId,
      editorialPass,
      getDocumentByType,
      loadChapterVersions,
      generate,
      createChapterVersion,
      updateRevisionTask,
      loadRevisionTasks,
      loadEditorialIssues,
    ],
  );

  const runRevisionPipelineForTask = useCallback(
    async (task: RevisionTask) => {
      await processRevisionTask(task, { autoFinalize: true });
    },
    [processRevisionTask],
  );

  const handleConfirmApplyAll = useCallback(async () => {
    const queued = passTasks
      .filter((t) => t.status === 'queued')
      .sort((a, b) => a.chapterNumber - b.chapterNumber);
    if (queued.length === 0) {
      setShowApplyAllConfirm(false);
      return;
    }
    setShowApplyAllConfirm(false);
    setApplyAllRunning(true);
    clearError();
    try {
      for (let i = 0; i < queued.length; i++) {
        const task = queued[i];
        setApplyAllProgress({
          current: i + 1,
          total: queued.length,
          chapterNumber: task.chapterNumber,
        });
        try {
          await runRevisionPipelineForTask(task);
        } catch (err) {
          await updateRevisionTask(task.id, { status: 'queued' }).catch(() => {});
          throw err;
        }
      }
    } finally {
      setApplyAllRunning(false);
      setApplyAllProgress(null);
      await loadRevisionTasks(projectId);
    }
  }, [passTasks, runRevisionPipelineForTask, clearError, loadRevisionTasks, projectId, updateRevisionTask]);
  
  if (projectLoading || !project) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height))]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
          <p className="text-[var(--muted-foreground)]">Loading...</p>
        </div>
      </div>
    );
  }
  
  const pendingCount = passTasks.filter((t) => t.status !== 'done').length;
  const queuedCount = passTasks.filter((t) => t.status === 'queued').length;
  
  // Get approved chapter IDs
  const approvedChapterIds = new Set<string>();
  for (const ch of chapters) {
    if (getApprovedChapterVersion(ch.id)) {
      approvedChapterIds.add(ch.id);
    }
  }
  
  // Get selected chapter and its data
  const selectedChapter = chapters.find((c) => c.id === selectedChapterId);
  const originalVersion = selectedChapter ? getApprovedChapterVersion(selectedChapter.id) : null;
  const selectedTask = selectedTaskId 
    ? passTasks.find((t) => t.id === selectedTaskId)
    : selectedChapter
    ? passTasks.find((t) => t.chapterNumber === selectedChapter.chapterNumber)
    : null;
  
  // Get revision tasks grouped by chapter (current pass only)
  const tasksByChapter = new Map<number, typeof passTasks>();
  for (const task of passTasks) {
    if (!tasksByChapter.has(task.chapterNumber)) {
      tasksByChapter.set(task.chapterNumber, []);
    }
    tasksByChapter.get(task.chapterNumber)!.push(task);
  }
  
  // Handle Apply button click - show confirmation
  const handleApplyClick = (task: typeof passTasks[0]) => {
    const chapter = chapters.find((c) => c.chapterNumber === task.chapterNumber);
    if (!chapter) return;

    setRevisedContent('');
    setVerification(null);
    setPendingDraftVersionId(null);
    setSelectedTaskId(task.id);
    setSelectedChapterId(chapter.id);
    setShowConfirmDialog(true);
  };
  
  // Handle confirmed Apply - generate revision + verify (draft, manual review)
  const handleConfirmApply = async () => {
    if (!selectedChapter) {
      throw new Error('No chapter selected. Please select a chapter first.');
    }
    if (!originalVersion) {
      throw new Error(
        `No approved version found for Chapter ${selectedChapter.chapterNumber}. Please approve a chapter version first.`,
      );
    }
    if (!selectedTask) {
      throw new Error('No revision task selected. Please select a task first.');
    }

    setShowConfirmDialog(false);
    clearError();
    setVerification(null);
    setPendingDraftVersionId(null);

    try {
      await processRevisionTask(selectedTask, { autoFinalize: false });
    } catch (err) {
      console.error('[Revision] Error generating revision:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      if (
        errorMessage.includes('No chapter selected') ||
        errorMessage.includes('No approved version') ||
        errorMessage.includes('No revision task')
      ) {
        setShowConfirmDialog(true);
      }
      throw err;
    }
  };

  // Handle approval of revision (existing draft version)
  const handleApproveRevision = async () => {
    if (!selectedChapter || !pendingDraftVersionId || !selectedTask) return;

    try {
      await firestore.updateChapterVersion(pendingDraftVersionId, { approved: true });
      for (const id of selectedTask.issueIds) {
        await firestore.updateEditorialIssue(id, { status: 'resolved' });
      }
      await updateRevisionTask(selectedTask.id, { status: 'done' });
      await loadEditorialIssues(projectId);
      await loadChapterVersions(selectedChapter.id);
      await loadRevisionTasks(projectId);

      setRevisedContent('');
      setVerification(null);
      setPendingDraftVersionId(null);
      setSelectedChapterId(null);
      setSelectedTaskId(null);
    } catch (err) {
      console.error('[Revision] Error approving revision:', err);
      throw err;
    }
  };

  const handleRerunRevision = async () => {
    if (!selectedTask || !selectedChapter) return;
    setRevisedContent('');
    setVerification(null);
    setPendingDraftVersionId(null);
    await updateRevisionTask(selectedTask.id, { status: 'queued' });
    clearError();
    await processRevisionTask(selectedTask, { autoFinalize: false });
  };
  
  // Generate diff view
  const renderDiff = () => {
    if (!originalVersion || !revisedContent) return null;
    
    const diff = Diff.diffWords(
      originalVersion.content.replace(/<[^>]+>/g, ''),
      revisedContent.replace(/<[^>]+>/g, '')
    );
    
    return (
      <div className="font-mono text-sm whitespace-pre-wrap">
        {diff.map((part, i) => (
          <span
            key={i}
            className={cn(
              part.added && 'bg-green-100 text-green-800',
              part.removed && 'bg-red-100 text-red-800 line-through'
            )}
          >
            {part.value}
          </span>
        ))}
      </div>
    );
  };
  
  const handleSkipToExportFinal = async () => {
    await advanceStage(projectId, 'export-final');
    router.push(`/projects/${projectId}/stage/export-final`);
  };

  return (
    <StageLayout
      projectId={projectId}
      projectTitle={project.title}
      genre={project.genre}
      niche={project.niche}
      currentStage={project.currentStage}
      activeStage="revision"
      chapters={chapters}
      approvedChapterIds={approvedChapterIds}
      revisionTasks={revisionTasks}
      documents={documents}
      fourPassEditorial={!!project.fourPassEditorial}
      blurbFilled={!!project.blurb?.trim()}
      amazonDescriptionFilled={!!project.amazonDescription?.trim()}
    >
      <div className="flex flex-wrap gap-2 mb-6">
        {EDITORIAL_PASSES.map((p) => (
          <Button
            key={p}
            variant={p === editorialPass ? 'primary' : 'secondary'}
            onClick={() => router.push(`/projects/${projectId}/stage/revision?pass=${p}`)}
            className="text-sm"
          >
            {EDITORIAL_PASS_LABELS[p]} — Revisions
          </Button>
        ))}
      </div>
      <div className="mb-6 flex justify-end">
        <Button variant="secondary" onClick={handleSkipToExportFinal} className="text-sm">
          Skip remaining revisions and export final
        </Button>
      </div>
      {/* Error */}
      {(projectError || generateError) && (
        <div className="mb-6 p-4 bg-[rgba(139,38,53,0.1)] border border-[var(--destructive)] rounded-lg">
          <p className="text-sm text-[var(--destructive)]">{projectError || generateError}</p>
        </div>
      )}

      {contextWarnings.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm font-medium text-amber-900 mb-1">Canon context warning</p>
          <p className="text-sm text-amber-800">{contextWarnings[0]}</p>
        </div>
      )}
      
      {/* Apply-all confirmation */}
      {showApplyAllConfirm && !selectedChapterId && (
        <Card className="mb-6 border-[var(--accent)]">
          <CardHeader>
            <CardTitle>Apply all revisions?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--foreground)] mb-4">
              This will generate and verify revised text for <strong>{queuedCount}</strong> queued chapter
              {queuedCount === 1 ? '' : 's'}. Chapters that pass verification are approved automatically; others
              stay as drafts with the task re-queued for review.
            </p>
            {applyAllPreflightLabel && (
              <p className="text-xs text-[var(--muted-foreground)] mb-4">
                Preflight estimate (per task: revision + summary + verify, includes template overhead):{' '}
                <strong className="text-[var(--foreground)]">{applyAllPreflightLabel}</strong>
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleConfirmApplyAll} loading={applyAllRunning} disabled={applyAllRunning}>
                Apply all {queuedCount} chapter{queuedCount === 1 ? '' : 's'}
              </Button>
              <Button variant="secondary" onClick={() => setShowApplyAllConfirm(false)} disabled={applyAllRunning}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revision queue */}
      {!selectedChapterId && (
        <>
          <Card className="mb-6">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
              <CardTitle>Revision Queue</CardTitle>
              {passTasks.length > 0 && queuedCount > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={applyAllRunning || isGenerating}
                  onClick={() => setShowApplyAllConfirm(true)}
                >
                  Apply all
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-[var(--muted-foreground)] mb-4">
                Pass: <strong>{EDITORIAL_PASS_LABELS[editorialPass]}</strong>. Review and apply revisions by chapter.
              </p>

              {applyAllRunning && applyAllProgress && (
                <div className="mb-4 p-4 rounded-lg border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]">
                  <p className="text-sm font-medium text-foreground">
                    Applying revisions… Chapter {applyAllProgress.chapterNumber} ({applyAllProgress.current} of{' '}
                    {applyAllProgress.total})
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Do not close this page until finished.</p>
                </div>
              )}
              
              {passTasks.length === 0 ? (
                <div className="text-center py-8 text-[var(--muted-foreground)]">
                  <p>No revision tasks for this pass. Create a revision queue from the editorial page for {EDITORIAL_PASS_LABELS[editorialPass]}.</p>
                  <Button className="mt-4" onClick={() => router.push(`/projects/${projectId}/stage/editorial?pass=${editorialPass}`)}>
                    Go to editorial
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {Array.from(tasksByChapter.entries())
                    .sort(([a], [b]) => a - b)
                    .map(([chapterNumber, tasks]) => {
                      const chapter = chapters.find((c) => c.chapterNumber === chapterNumber);
                      if (!chapter) return null;
                      
                      const queuedTask = tasks.find((t) => t.status === 'queued');
                      const inProgressTask = tasks.find((t) => t.status === 'in_progress');
                      const doneTask = tasks.find((t) => t.status === 'done');
                      const activeTask = inProgressTask || queuedTask;
                      const isComplete = !queuedTask && !inProgressTask && doneTask;
                      
                      return (
                        <div
                          key={chapterNumber}
                          className={cn(
                            'p-4 rounded-lg border',
                            isComplete
                              ? 'bg-[rgba(92,124,92,0.1)] border-[var(--status-approved)]'
                              : 'bg-[rgba(212,160,58,0.1)] border-[var(--status-in-progress)]'
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              <div className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
                                isComplete
                                  ? 'bg-[var(--status-approved)] text-white'
                                  : 'bg-[var(--status-in-progress)] text-white'
                              )}>
                                {chapterNumber}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-[var(--foreground)]">{chapter.title}</p>
                                {activeTask && (
                                  <div className="mt-2 space-y-1">
                                    <p className="text-sm text-[var(--muted-foreground)]">
                                      {activeTask.instructions.substring(0, 200)}
                                      {activeTask.instructions.length > 200 ? '...' : ''}
                                    </p>
                                    {activeTask.acceptanceCriteria.length > 0 && (
                                      <p className="text-xs text-[var(--muted-foreground)]">
                                        {activeTask.acceptanceCriteria.length} acceptance criteria
                                      </p>
                                    )}
                                  </div>
                                )}
                                {isComplete && (
                                  <p className="text-sm text-[var(--muted-foreground)] mt-1">
                                    Revision completed
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {activeTask && activeTask.status === 'queued' && (
                                <Button
                                  onClick={() => handleApplyClick(activeTask)}
                                  size="sm"
                                  disabled={applyAllRunning}
                                >
                                  Apply
                                </Button>
                              )}
                              {activeTask && activeTask.status === 'in_progress' && (
                                <Button
                                  onClick={() => {
                                    setSelectedTaskId(activeTask.id);
                                    setSelectedChapterId(chapter.id);
                                  }}
                                  variant="secondary"
                                  size="sm"
                                >
                                  View Progress
                                </Button>
                              )}
                              {isComplete && (
                                <Badge variant="success" className="px-3 py-1">
                                  Complete
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
          
          {pendingCount === 0 && passTasks.length > 0 && (
            <Card className="bg-[rgba(92,124,92,0.1)] border-[var(--status-approved)]">
              <CardContent className="py-8 text-center">
                <svg className="w-16 h-16 mx-auto text-[var(--status-approved)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                  {EDITORIAL_PASS_LABELS[editorialPass]} revisions complete
                </h3>
                {canProceedToExportFinal(project, revisionTasks) ? (
                  <>
                    <p className="text-[var(--muted-foreground)] mb-4">
                      All editorial passes are done. You can export the final manuscript.
                    </p>
                    <Link href={`/projects/${projectId}/stage/export-final`}>
                      <Button>
                        Go to Export Final
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-[var(--muted-foreground)] mb-4">
                      Continue with the next editorial pass when you are ready.
                    </p>
                    <Button onClick={() => {
                      const idx = EDITORIAL_PASSES.indexOf(editorialPass);
                      const next = EDITORIAL_PASSES[idx + 1];
                      if (next) router.push(`/projects/${projectId}/stage/editorial?pass=${next}`);
                    }}>
                      Next pass: editorial review
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
      
      {/* Revision workspace */}
      {selectedChapterId && selectedChapter && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <Button variant="ghost" onClick={() => setSelectedChapterId(null)}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Queue
            </Button>
            <div className="text-right">
              <h2 className="text-lg font-semibold">
                Chapter {selectedChapter.chapterNumber}: {selectedChapter.title}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Revising: <strong>{revisionScopeLabel}</strong>
              </p>
            </div>
          </div>
          
          {/* Revision task details */}
          {selectedTask && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Revision Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)] mb-2">Instructions:</p>
                    <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">
                      {selectedTask.instructions}
                    </p>
                  </div>
                  {selectedTask.acceptanceCriteria.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground)] mb-2">Acceptance Criteria:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-[var(--foreground)]">
                        {selectedTask.acceptanceCriteria.map((criterion, idx) => (
                          <li key={idx}>{criterion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="pt-2 border-t border-[var(--border)]">
                    <Badge variant={selectedTask.status === 'queued' ? 'warning' : selectedTask.status === 'in_progress' ? 'info' : 'success'}>
                      {selectedTask.status === 'queued' ? 'Queued' : selectedTask.status === 'in_progress' ? 'In Progress' : 'Complete'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedTask && taskLinkedIssues.length > 0 && (
            <details className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
              <summary className="cursor-pointer text-sm font-medium text-[var(--foreground)]">
                Linked editorial issues ({taskLinkedIssues.length})
              </summary>
              <ul className="mt-3 space-y-3 text-sm">
                {taskLinkedIssues.map((issue) => (
                  <li key={issue.id} className="border-t border-[var(--border)] pt-3 first:border-t-0 first:pt-0">
                    <Badge variant="default" className="mb-1">
                      {issue.category}
                    </Badge>
                    <p className="text-[var(--foreground)]">{issue.description}</p>
                    <p className="text-[var(--muted-foreground)] mt-1">
                      <span className="font-medium">Fix: </span>
                      {issue.recommendedFix}
                    </p>
                    {issue.manuscriptQuote?.trim() ? (
                      <blockquote className="mt-2 pl-3 border-l-2 border-[var(--muted-foreground)] text-[var(--muted-foreground)] italic text-xs whitespace-pre-wrap">
                        {issue.manuscriptQuote}
                      </blockquote>
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          )}
          
          {/* Confirmation dialog */}
          {showConfirmDialog && selectedTask && (
            <Card className="mb-6 border-[var(--accent)]">
              <CardHeader>
                <CardTitle>Confirm Apply Revision</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--foreground)] mb-4">
                  Generate revision for Chapter {selectedChapter?.chapterNumber}: {selectedChapter?.title} using Sonnet 4.6 (Thinking)?
                </p>
                <p className="text-xs text-[var(--muted-foreground)] mb-4">
                  This will create a revised version of the chapter based on the revision instructions. You&apos;ll be able to review and approve the changes.
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleConfirmApply}
                    loading={isGenerating || isVerifying}
                    disabled={isGenerating || isVerifying}
                  >
                    Yes, Apply Revision
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowConfirmDialog(false);
                      setSelectedTaskId(null);
                      setSelectedChapterId(null);
                    }}
                    disabled={isGenerating || isVerifying}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Generate revision in progress */}
          {!showConfirmDialog && !revisedContent && selectedTask && selectedTask.status === 'in_progress' && (
            <Card className="text-center py-12">
              <CardContent>
                <div className="w-12 h-12 border-4 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                  {isVerifying ? 'Verifying revision…' : 'Generating revision…'}
                </h3>
                <p className="text-[var(--muted-foreground)] mb-6 max-w-md mx-auto">
                  Sonnet 4.6 (Thinking) is revising this chapter based on the revision instructions. This may take a minute.
                </p>
              </CardContent>
            </Card>
          )}
          
          {/* Diff view */}
          {revisedContent && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant={showDiff ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setShowDiff(true)}
                  >
                    Diff View
                  </Button>
                  <Button
                    variant={!showDiff ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setShowDiff(false)}
                  >
                    Side by Side
                  </Button>
                </div>
              </div>
              
              {showDiff ? (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Changes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[500px] overflow-y-auto p-4 bg-[var(--background)] rounded">
                      {renderDiff()}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Original</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-[500px] overflow-y-auto prose-book text-sm">
                        <div dangerouslySetInnerHTML={{ __html: originalVersion?.content || '' }} />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Revised</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-[500px] overflow-y-auto prose-book text-sm">
                        <div dangerouslySetInnerHTML={{ __html: revisedContent }} />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
              
              {verification && (
                <Card className="mb-6 border-[var(--border)]">
                  <CardHeader>
                    <CardTitle>
                      Verification {verification.satisfied ? '(passed)' : '(needs review)'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {verification.overallNotes?.trim() ? (
                      <p className="text-sm text-[var(--foreground)]">{verification.overallNotes}</p>
                    ) : null}
                    <ul className="space-y-2 text-sm">
                      {verification.checklist.map((item, idx) => (
                        <li
                          key={idx}
                          className={cn(
                            'rounded border p-2',
                            item.met ? 'border-green-200 bg-green-50/80' : 'border-amber-200 bg-amber-50/80',
                          )}
                        >
                          <p className="font-medium text-[var(--foreground)]">{item.criterion}</p>
                          <p className="text-[var(--muted-foreground)] mt-1">{item.evidence}</p>
                          <p className="text-xs mt-1">{item.met ? 'Met' : 'Not met'}</p>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (selectedTask) {
                        setShowConfirmDialog(true);
                      }
                    }}
                    disabled={isGenerating || isVerifying || !selectedTask}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Regenerate
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setRevisedContent('');
                      setVerification(null);
                      setPendingDraftVersionId(null);
                      if (selectedTask) {
                        updateRevisionTask(selectedTask.id, { status: 'queued' });
                      }
                    }}
                  >
                    Reject
                  </Button>
                  {verification && !verification.satisfied ? (
                    <Button
                      variant="secondary"
                      onClick={() => handleRerunRevision()}
                      disabled={isGenerating || isVerifying}
                    >
                      Re-run revision
                    </Button>
                  ) : null}
                </div>

                <div className="flex flex-col items-stretch gap-2 sm:items-end">
                  {verification?.satisfied ? (
                    <Button
                      onClick={handleApproveRevision}
                      disabled={!selectedTask || !pendingDraftVersionId}
                      className="bg-[var(--status-approved)] hover:opacity-90 text-white"
                    >
                      Approve revision
                    </Button>
                  ) : null}
                  {verification && !verification.satisfied ? (
                    <>
                      <p className="text-xs text-amber-800 max-w-sm text-right">
                        Verification did not pass. You can re-run the revision, or approve anyway if the draft is acceptable.
                      </p>
                      <Button
                        variant="secondary"
                        className="border-amber-600 text-amber-900"
                        onClick={handleApproveRevision}
                        disabled={!selectedTask || !pendingDraftVersionId}
                      >
                        Approve anyway (override)
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </StageLayout>
  );
}
