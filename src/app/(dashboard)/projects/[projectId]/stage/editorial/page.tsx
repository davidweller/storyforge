'use client';

import { use, useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useProject } from '@/hooks/useProject';
import { useGenerate } from '@/hooks/useGenerate';
import { useProjectStore } from '@/stores/projectStore';
import { StageLayout, ContentDisplay, LoadingContent, EmptyContent } from '@/components/stages';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui';
import { getNextStage } from '@/lib/utils';
import {
  EDITORIAL_PASSES,
  EDITORIAL_PASS_LABELS,
  documentTypeForEditorialPass,
  latestEditorialDocContentForPass,
  approvedEditorialDocForPass,
  canStartEditorialPass,
  parseEditorialPass,
} from '@/lib/editorial/passes';
import type { WorkflowStage, EditorialPass } from '@/types';
import { MAX_MANUSCRIPT_TOKENS } from '@/lib/constants';
import { parseRevisionQueue } from '@/lib/generation/schemas';
import { assembleContext } from '@/lib/context/assembler';
import { persistRevisionQueueFromParsed } from '@/lib/editorial/persistRevisionQueue';
import { formatStructuredQueueMarkdown } from '@/lib/editorial/formatStructuredQueueMarkdown';
import { estimateEditorialPassTokens, formatTokenRange } from '@/lib/cost/preflight';

interface EditorialPageProps {
  params: Promise<{ projectId: string }>;
}


export default function EditorialPage({ params }: EditorialPageProps) {
  const { projectId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const editorialPass: EditorialPass = parseEditorialPass(searchParams.get('pass')) ?? 'structural';

  const {
    project,
    documents,
    chapters,
    revisionTasks,
    editorialIssues,
    loading: projectLoading,
    error: projectError,
    getDocumentByType,
    getApprovedChapterVersion,
  } = useProject(projectId);
  
  const {
    createDocument,
    updateDocument,
    approveDocument,
    loadEditorialIssues,
    advanceStage,
    loadChapterVersions,
    createRevisionTask,
    deleteRevisionTasksForProjectAndPass,
    loadRevisionTasks,
  } = useProjectStore();
  const { generate, isGenerating, error: generateError, clearError } = useGenerate();
  
  const [editorialContent, setEditorialContent] = useState('');
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [modelSwitchMessage, setModelSwitchMessage] = useState<string | null>(null);
  const [contextWarnings, setContextWarnings] = useState<string[]>([]);
  const [issueStatusFilter, setIssueStatusFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [issueChapterFilter, setIssueChapterFilter] = useState<'all' | number>('all');
  /** How the current editorial document was produced — affects Continue to revision. */
  const [reportOrigin, setReportOrigin] = useState<'none' | 'prose' | 'structured'>('none');

  const docTypeForPass = useMemo(() => documentTypeForEditorialPass(editorialPass), [editorialPass]);

  const editorialGenOpts = useMemo(
    () => ({ projectId, usageSource: 'editorial' as const }),
    [projectId]
  );

  const manuscriptWordCount = useMemo(() => {
    let t = 0;
    for (const ch of chapters) {
      const v = getApprovedChapterVersion(ch.id);
      if (v) t += v.wordCount;
    }
    return t;
  }, [chapters, getApprovedChapterVersion]);

  const editorialPreflight = useMemo(() => {
    const est = estimateEditorialPassTokens(manuscriptWordCount, 1);
    return formatTokenRange(est.low, est.high);
  }, [manuscriptWordCount]);

  const filteredPersistedIssues = useMemo(() => {
    return editorialIssues.filter((i) => {
      if (i.editPass !== editorialPass) return false;
      if (issueStatusFilter !== 'all' && i.status !== issueStatusFilter) return false;
      if (issueChapterFilter !== 'all' && i.chapterNumber !== issueChapterFilter) return false;
      return true;
    });
  }, [editorialIssues, editorialPass, issueStatusFilter, issueChapterFilter]);

  const refreshIssues = useCallback(() => {
    if (projectId) loadEditorialIssues(projectId);
  }, [projectId, loadEditorialIssues]);

  const getApprovedStub = (chapterId: string) =>
    getApprovedChapterVersion(chapterId) ? { content: '' } : undefined;
  const canStartThisPass = canStartEditorialPass(
    editorialPass,
    chapters,
    getApprovedStub,
    revisionTasks
  );
  
  // Load versions for all chapters when chapters are available
  useEffect(() => {
    if (chapters.length > 0) {
      chapters.forEach(ch => {
        loadChapterVersions(ch.id);
      });
    }
  }, [chapters, loadChapterVersions]);
  
  useEffect(() => {
    if (projectId) loadRevisionTasks(projectId);
  }, [projectId, loadRevisionTasks]);

  // Load existing editorial content for this pass
  useEffect(() => {
    const loaded = latestEditorialDocContentForPass(documents, editorialPass);
    if (loaded) {
      setEditorialContent(loaded.content);
      const t = docTypeForPass;
      const match =
        documents
          .filter((d) => d.type === t)
          .sort((a, b) => b.version - a.version)[0] ||
        (editorialPass === 'structural'
          ? documents.filter((d) => d.type === 'editorial').sort((a, b) => b.version - a.version)[0]
          : undefined);
      setCurrentDocId(match?.id ?? null);
      if (loaded.content.startsWith('# Structured editorial')) {
        setReportOrigin('structured');
      } else {
        setReportOrigin(loaded.content.trim() ? 'prose' : 'none');
      }
    } else {
      setEditorialContent('');
      setCurrentDocId(null);
      setReportOrigin('none');
    }
  }, [documents, editorialPass, docTypeForPass]);
  
  // Load editorial issues
  useEffect(() => {
    if (projectId) {
      loadEditorialIssues(projectId);
    }
  }, [projectId, loadEditorialIssues]);

  useEffect(() => {
    setIssueStatusFilter('all');
    setIssueChapterFilter('all');
  }, [editorialPass]);
  
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
  
  const isApproved = approvedEditorialDocForPass(documents, editorialPass);
  // Get approved chapter IDs
  const approvedChapterIds = new Set<string>();
  for (const ch of chapters) {
    if (getApprovedChapterVersion(ch.id)) {
      approvedChapterIds.add(ch.id);
    }
  }
  
  // Compile manuscript for editorial review
  const compileManuscript = (): string => {
    let manuscript = '';
    let chapterCount = 0;
    
    // Sort chapters by chapter number
    const sortedChapters = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber);
    
    for (const chapter of sortedChapters) {
      const version = getApprovedChapterVersion(chapter.id);
      if (version && version.content) {
        // Strip HTML tags if present
        const textContent = version.content.replace(/<[^>]+>/g, '').trim();
        
        if (textContent.length > 0) {
          manuscript += `\n\n## Chapter ${chapter.chapterNumber}: ${chapter.title}\n\n`;
          manuscript += textContent;
          chapterCount++;
        }
      }
    }
    
    console.log('Compiled manuscript:', {
      chapterCount,
      totalChapters: chapters.length,
      manuscriptLength: manuscript.length,
      hasContent: manuscript.trim().length > 0,
    });
    
    if (manuscript.trim().length === 0) {
      throw new Error('No approved chapter content found. Please approve at least one chapter before generating an editorial review.');
    }
    
    return manuscript.trim();
  };

  const prepareManuscriptAndContextForEditorial = async (): Promise<{
    manuscript: string;
    chapterCount: number;
    assembledText: string;
    nicheReference?: string;
    charactersReference?: string;
    endingReference?: string;
    structureReference?: string;
    intendedAudience?: string;
  }> => {
    console.log('Loading chapter versions...');
    await Promise.all(chapters.map((ch) => loadChapterVersions(ch.id)));

    console.log('Starting editorial review generation...');
    const manuscript = compileManuscript();

    if (!manuscript || manuscript.trim().length === 0) {
      throw new Error(
        'Cannot generate editorial review: No manuscript content available. Please ensure you have approved chapters with content.'
      );
    }

    if (manuscript.trim().length < 1000) {
      console.warn('Manuscript is very short:', manuscript.length, 'characters');
    }

    const chapterMatches = manuscript.match(/## Chapter \d+:/g);
    const chapterCount = chapterMatches ? chapterMatches.length : 0;

    const estimatedManuscriptTokens = Math.ceil(manuscript.length / 4);
    const referenceDocsLength = [
      getDocumentByType('niche')?.content,
      getDocumentByType('characters')?.content,
      getDocumentByType('ending')?.content,
      getDocumentByType('structure')?.content,
    ]
      .filter(Boolean)
      .reduce((sum, doc) => sum + (doc?.length || 0), 0);
    const estimatedReferenceTokens = Math.ceil(referenceDocsLength / 4);
    const estimatedPromptOverhead = 2000;
    const estimatedTotalTokens =
      estimatedManuscriptTokens + estimatedReferenceTokens + estimatedPromptOverhead;

    const gpt52ContextTokens = 128000;
    const openaiLargeContextTokens = 1_000_000;
    const claude46ContextTokens = 1_000_000;

    console.log('[Editorial] Manuscript validation:', {
      totalLength: manuscript.length,
      trimmedLength: manuscript.trim().length,
      chapterCount,
      wordCount: manuscript.split(/\s+/).length,
      estimatedManuscriptTokens,
      estimatedReferenceTokens,
      estimatedTotalTokens,
      gpt52ContextTokens,
      openaiLargeContextTokens,
      claude46ContextTokens,
      willExceedGPT52: estimatedTotalTokens > gpt52ContextTokens,
      willExceedClaude46: estimatedTotalTokens > claude46ContextTokens,
      willExceedEditorialCap: estimatedTotalTokens > MAX_MANUSCRIPT_TOKENS,
      first100Chars: manuscript.substring(0, 100),
      last100Chars: manuscript.substring(Math.max(0, manuscript.length - 100)),
    });

    if (chapterCount === 0) {
      throw new Error(
        'Manuscript does not contain any chapters. Please ensure chapters are properly formatted.'
      );
    }

    if (estimatedTotalTokens > MAX_MANUSCRIPT_TOKENS) {
      const manuscriptWordCount = Math.ceil(manuscript.length / 5);
      const maxWords = Math.floor(
        (MAX_MANUSCRIPT_TOKENS - estimatedReferenceTokens - estimatedPromptOverhead) * (4 / 5)
      );
      throw new Error(
        `Manuscript is too long for editorial review.\n\n` +
          `• Your manuscript: ~${manuscriptWordCount.toLocaleString()} words (${estimatedTotalTokens.toLocaleString()} tokens)\n` +
          `• Maximum supported: ~${maxWords.toLocaleString()} words (${MAX_MANUSCRIPT_TOKENS.toLocaleString()} tokens)\n\n` +
          `Your manuscript exceeds the supported context window. Please consider reviewing in batches or focusing on specific sections.`
      );
    }

    if (estimatedTotalTokens > gpt52ContextTokens && estimatedTotalTokens <= openaiLargeContextTokens) {
      console.log(
        '[Editorial] Manuscript exceeds GPT-5.2 context; API may switch to Claude Sonnet 4.6 if the selected model is GPT-5.2:',
        {
          estimatedTotalTokens,
          gpt52ContextTokens,
          claude46ContextTokens,
        }
      );
    }

    if (estimatedTotalTokens > gpt52ContextTokens * 0.8 && estimatedTotalTokens <= gpt52ContextTokens) {
      console.warn('[Editorial] Manuscript approaching GPT-5.2 context limit:', {
        estimatedTotalTokens,
        gpt52ContextTokens,
        percentage: ((estimatedTotalTokens / gpt52ContextTokens) * 100).toFixed(1) + '%',
      });
    }

    if (estimatedTotalTokens > gpt52ContextTokens && estimatedTotalTokens > MAX_MANUSCRIPT_TOKENS * 0.8) {
      console.warn('[Editorial] Manuscript approaching editorial input cap:', {
        estimatedTotalTokens,
        maxManuscriptTokens: MAX_MANUSCRIPT_TOKENS,
        percentage: ((estimatedTotalTokens / MAX_MANUSCRIPT_TOKENS) * 100).toFixed(1) + '%',
      });
    }

    const nicheDoc = getDocumentByType('niche');
    const charactersDoc = getDocumentByType('characters');
    const endingDoc = getDocumentByType('ending');
    const structureDoc = getDocumentByType('structure');

    console.log('[Editorial] Generating review with:', {
      manuscriptLength: manuscript.length,
      manuscriptWordCount: manuscript.split(/\s+/).length,
      chapterCount,
      hasNiche: !!nicheDoc,
      nicheLength: nicheDoc?.content?.length || 0,
      hasCharacters: !!charactersDoc,
      charactersLength: charactersDoc?.content?.length || 0,
      hasEnding: !!endingDoc,
      endingLength: endingDoc?.content?.length || 0,
      hasStructure: !!structureDoc,
      structureLength: structureDoc?.content?.length || 0,
      genre: project.genre,
    });

    console.log(
      '[Editorial] Manuscript will be included in prompt. First 200 chars:',
      manuscript.substring(0, 200)
    );

    const audienceParts = [project.niche, project.microniche].filter(Boolean) as string[];
    const intendedAudience = audienceParts.length > 0 ? audienceParts.join(' · ') : undefined;
    const approvedChapterVersions = Array.from(useProjectStore.getState().chapterVersions.values())
      .flat()
      .filter((version) => version.approved);
    const assembled = assembleContext({
      purpose: 'editorial',
      project,
      documents,
      chapters,
      approvedChapterVersions,
      editorialPass,
    });
    setContextWarnings(assembled.warnings);

    return {
      manuscript,
      chapterCount,
      assembledText: assembled.text,
      nicheReference: nicheDoc?.content,
      charactersReference: charactersDoc?.content,
      endingReference: endingDoc?.content,
      structureReference: structureDoc?.content,
      intendedAudience,
    };
  };

  async function persistEditorialDocVersion(content: string) {
    const latestThisType = documents
      .filter((d) => d.type === docTypeForPass)
      .sort((a, b) => b.version - a.version)[0];
    const nextVersion = (latestThisType?.version ?? 0) + 1;

    if (currentDocId) {
      await updateDocument(currentDocId, {
        content,
        version: nextVersion,
      });
    } else {
      const newDocId = await createDocument({
        projectId,
        type: docTypeForPass,
        content,
        version: nextVersion,
        approved: false,
      });
      setCurrentDocId(newDocId);
    }
  }

  const handleGenerate = async () => {
    console.log('Re-analyze button clicked');
    clearError();

    if (!canStartThisPass) {
      throw new Error(
        'Complete the previous editorial pass and its revisions before starting this pass.'
      );
    }

    setEditorialContent('');

    try {
      const prepared = await prepareManuscriptAndContextForEditorial();

      const result = await generate(
        'editorial',
        {
          manuscript: prepared.manuscript,
          genre: project.genre,
          assembledContext: prepared.assembledText,
          nicheReference: prepared.nicheReference,
          charactersReference: prepared.charactersReference,
          endingReference: prepared.endingReference,
          structureReference: prepared.structureReference,
          editorialPass,
          intendedAudience: prepared.intendedAudience,
          premise: project.premise,
          research: project.research,
        },
        editorialGenOpts
      );

      if (
        'modelSwitched' in result &&
        result.modelSwitched &&
        'switchMessage' in result &&
        typeof result.switchMessage === 'string'
      ) {
        setModelSwitchMessage(result.switchMessage);
      } else {
        setModelSwitchMessage(null);
      }

      setEditorialContent(result.content);
      setReportOrigin('prose');
      await persistEditorialDocVersion(result.content);
    } catch (err) {
      console.error('Error generating editorial review:', err);
      if (err instanceof Error) {
        throw err;
      }
      throw new Error('Failed to generate editorial review');
    }
  };

  const handleGenerateStructured = async () => {
    clearError();

    if (!canStartThisPass) {
      throw new Error(
        'Complete the previous editorial pass and its revisions before starting this pass.'
      );
    }

    setEditorialContent('');

    try {
      const prepared = await prepareManuscriptAndContextForEditorial();
      await deleteRevisionTasksForProjectAndPass(projectId, editorialPass);

      const result = await generate(
        'editorial-issues',
        {
          manuscript: prepared.manuscript,
          genre: project.genre,
          chapterCount: chapters.length,
          assembledContext: prepared.assembledText,
          nicheReference: prepared.nicheReference,
          charactersReference: prepared.charactersReference,
          endingReference: prepared.endingReference,
          structureReference: prepared.structureReference,
          editorialPass,
          intendedAudience: prepared.intendedAudience,
          premise: project.premise,
          research: project.research,
        },
        editorialGenOpts
      );

      if (
        'modelSwitched' in result &&
        result.modelSwitched &&
        'switchMessage' in result &&
        typeof result.switchMessage === 'string'
      ) {
        setModelSwitchMessage(result.switchMessage);
      } else {
        setModelSwitchMessage(null);
      }

      const revisionQueueData = (() => {
        try {
          return parseRevisionQueue(result.content);
        } catch (parseError) {
          console.error('[Editorial] Failed to parse structured editorial queue:', parseError);
          console.error('[Editorial] Raw response:', result.content);
          throw new Error(
            'Failed to parse editorial queue JSON. The AI response was not in the expected format.'
          );
        }
      })();

      if (!revisionQueueData.revisionTasks || !Array.isArray(revisionQueueData.revisionTasks)) {
        throw new Error('Invalid revision queue format. Expected revisionTasks array.');
      }

      await persistRevisionQueueFromParsed(projectId, editorialPass, revisionQueueData.revisionTasks);
      await loadEditorialIssues(projectId);
      await loadRevisionTasks(projectId);

      const markdownSummary = formatStructuredQueueMarkdown(
        EDITORIAL_PASS_LABELS[editorialPass],
        revisionQueueData
      );
      setEditorialContent(markdownSummary);
      setReportOrigin('structured');
      await persistEditorialDocVersion(markdownSummary);
    } catch (err) {
      console.error('Error generating structured editorial queue:', err);
      if (err instanceof Error) {
        throw err;
      }
      throw new Error('Failed to generate structured editorial queue');
    }
  };

  const handleContinueToRevision = async () => {
    try {
      clearError();

      if (!editorialContent || editorialContent.trim().length === 0) {
        throw new Error('No editorial review available. Please generate an editorial review first.');
      }

      if (currentDocId && !isApproved) {
        await approveDocument(currentDocId);
      }

      console.log('[Editorial] Continuing to revision...');

      if (editorialPass === 'final_report') {
        await deleteRevisionTasksForProjectAndPass(projectId, editorialPass);
        const sorted = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber);
        for (const ch of sorted) {
          await createRevisionTask({
            projectId,
            chapterNumber: ch.chapterNumber,
            editPass: 'final_report',
            issueIds: [],
            instructions:
              'Final editorial report pass: advisory only. No automated chapter revisions. See the Final report document.',
            acceptanceCriteria: ['Final report reviewed'],
            status: 'done',
          });
        }
      } else if (reportOrigin === 'structured') {
        await loadEditorialIssues(projectId);
        await loadRevisionTasks(projectId);
      } else {
        await deleteRevisionTasksForProjectAndPass(projectId, editorialPass);

        const result = await generate(
          'editorial',
          {
            createQueue: true,
            editorialReport: editorialContent,
            chapterCount: chapters.length,
            editorialPass,
          },
          editorialGenOpts
        );

        console.log('[Editorial] Revision queue response received:', {
          contentLength: result.content?.length || 0,
          hasContent: !!result.content,
        });

        const revisionQueueData = (() => {
          try {
            return parseRevisionQueue(result.content);
          } catch (parseError) {
            console.error('[Editorial] Failed to parse revision queue JSON:', parseError);
            console.error('[Editorial] Raw response:', result.content);
            throw new Error(
              'Failed to parse revision queue. The AI response was not in the expected format.'
            );
          }
        })();

        if (!revisionQueueData.revisionTasks || !Array.isArray(revisionQueueData.revisionTasks)) {
          throw new Error('Invalid revision queue format. Expected revisionTasks array.');
        }

        await persistRevisionQueueFromParsed(projectId, editorialPass, revisionQueueData.revisionTasks);
        await loadEditorialIssues(projectId);
        await loadRevisionTasks(projectId);

        console.log('[Editorial] Created revision tasks and editorial issues for pass', editorialPass);
      }

      console.log('[Editorial] All revision tasks created successfully');

      const nextStage = getNextStage('editorial');
      if (nextStage && project.currentStage === 'editorial') {
        await advanceStage(projectId, nextStage as WorkflowStage);
      }

      router.push(`/projects/${projectId}/stage/revision?pass=${editorialPass}`);
    } catch (err) {
      console.error('[Editorial] Error creating revision queue:', err);
      throw err;
    }
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
      activeStage="editorial"
      chapters={chapters}
      approvedChapterIds={approvedChapterIds}
      revisionTasks={revisionTasks}
      documents={documents}
      fourPassEditorial={!!project.fourPassEditorial}
      blurbFilled={!!project.blurb?.trim()}
      amazonDescriptionFilled={!!project.amazonDescription?.trim()}
    >
      <div className="flex flex-wrap gap-2 mb-6">
        {EDITORIAL_PASSES.map((p) => {
          const can = canStartEditorialPass(p, chapters, getApprovedStub, revisionTasks);
          const active = p === editorialPass;
          return (
            <Button
              key={p}
              variant={active ? 'primary' : 'secondary'}
              disabled={!can && !active}
              onClick={() => router.push(`/projects/${projectId}/stage/editorial?pass=${p}`)}
              className="text-sm"
            >
              {EDITORIAL_PASS_LABELS[p]}
            </Button>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Pass: <strong>{EDITORIAL_PASS_LABELS[editorialPass]}</strong>
        {!canStartThisPass && (
          <span className="block mt-1 text-amber-700">
            Complete the prior pass and approve all its chapter revisions before running this pass.
          </span>
        )}
      </p>
      <div className="mb-6 flex justify-end">
        <Button variant="secondary" onClick={handleSkipToExportFinal} className="text-sm">
          Skip editorial and export final
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

      <Card className="mb-6">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
          <CardTitle className="text-base">
            Structured issues — {EDITORIAL_PASS_LABELS[editorialPass]}
          </CardTitle>
          <Button type="button" variant="ghost" size="sm" onClick={refreshIssues} className="shrink-0">
            Refresh list
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2 text-muted-foreground">
              <span>Status</span>
              <select
                className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[var(--foreground)]"
                value={issueStatusFilter}
                onChange={(e) =>
                  setIssueStatusFilter(e.target.value as 'all' | 'open' | 'resolved')
                }
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-muted-foreground">
              <span>Chapter</span>
              <select
                className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[var(--foreground)]"
                value={issueChapterFilter === 'all' ? 'all' : String(issueChapterFilter)}
                onChange={(e) => {
                  const v = e.target.value;
                  setIssueChapterFilter(v === 'all' ? 'all' : Number(v));
                }}
              >
                <option value="all">All chapters</option>
                {[...chapters]
                  .sort((a, b) => a.chapterNumber - b.chapterNumber)
                  .map((ch) => (
                    <option key={ch.id} value={ch.chapterNumber}>
                      Ch. {ch.chapterNumber}: {ch.title}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {filteredPersistedIssues.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No stored issues for this pass yet. They appear after structured queue generation or after you continue from a prose report (revision queue persisted).
            </p>
          ) : (
            <ul className="space-y-3 max-h-[320px] overflow-y-auto text-sm">
              {filteredPersistedIssues.map((issue) => (
                <li
                  key={issue.id}
                  className="rounded-lg border border-[var(--border)] p-3 bg-[var(--background)]"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant={issue.status === 'open' ? 'warning' : 'success'}>
                      {issue.status}
                    </Badge>
                    <Badge variant="default">{issue.category}</Badge>
                    {issue.chapterNumber != null ? (
                      <span className="text-xs text-muted-foreground">Chapter {issue.chapterNumber}</span>
                    ) : null}
                    {issue.sceneId?.trim() ? (
                      <span className="text-xs text-muted-foreground">scene: {issue.sceneId}</span>
                    ) : null}
                  </div>
                  <p className="text-[var(--foreground)]">{issue.description}</p>
                  <p className="text-muted-foreground mt-1">
                    <span className="font-medium">Fix: </span>
                    {issue.recommendedFix}
                  </p>
                  {issue.locationHint?.trim() ? (
                    <p className="text-xs text-muted-foreground mt-1">Where: {issue.locationHint}</p>
                  ) : null}
                  {issue.manuscriptQuote?.trim() ? (
                    <blockquote className="mt-2 pl-3 border-l-2 border-[var(--muted-foreground)] text-xs text-muted-foreground italic whitespace-pre-wrap">
                      {issue.manuscriptQuote}
                    </blockquote>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      
      {/* Model Switch Message */}
      {modelSwitchMessage && (
        <div className="mb-6 p-4 bg-[rgba(59,130,246,0.1)] border border-blue-500 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-700 mb-1">Model Automatically Switched</p>
              <p className="text-sm text-blue-600 whitespace-pre-line">{modelSwitchMessage}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Loading */}
      {isGenerating && (
        <LoadingContent message="Analyzing your manuscript... This may take several minutes." />
      )}
      
      {/* Empty state */}
      {!isGenerating && !editorialContent && (
        <>
          {manuscriptWordCount > 0 && (
            <p className="mb-4 text-sm text-[var(--muted-foreground)]">
              Preflight estimate for this pass (includes manuscript context + prompt overhead, not exact):{' '}
              <strong className="text-[var(--foreground)]">{editorialPreflight}</strong>
            </p>
          )}
        <EmptyContent
          title="Generate Editorial Review"
          description="Approved chapter versions are stitched into one manuscript. Prefer Structured queue to generate issues and revision tasks in one model call plus a markdown digest. Use Prose report for narrative feedback first, then Continue runs a queue pass from that report."
          actionLabel="Prose Editorial Report"
          onAction={handleGenerate}
          isLoading={isGenerating}
          disabled={!canStartThisPass}
          secondaryLabel="Structured queue only"
          onSecondary={() => void handleGenerateStructured()}
          secondaryDisabled={!canStartThisPass}
        />
        </>
      )}
      
      {/* Editorial content */}
      {!isGenerating && editorialContent && (
        <>
          <div className="flex flex-wrap items-center gap-2 justify-between mb-6">
            <div className="text-sm text-muted-foreground space-y-1 max-w-2xl">
              <p>
                <strong className="text-foreground">Prose</strong> gets a readable report then a queue pass when you continue.{' '}
                <strong className="text-foreground">Structured</strong> persists the revision queue immediately; continue skips the duplicate LLM hop.
              </p>
              {reportOrigin === 'structured' ? (
                <p className="text-foreground/90">Showing markdown digest saved from structured output.</p>
              ) : null}
            </div>
          </div>
          {/* Full report */}
          <ContentDisplay content={editorialContent} className="mb-6" />
          
          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex flex-wrap gap-3">
              <Button
              variant="secondary" 
              onClick={handleGenerate} 
              disabled={isGenerating || !canStartThisPass}
              loading={isGenerating}
            >
              {!isGenerating && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Re-analyze (prose)
            </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleGenerateStructured()}
                disabled={isGenerating || !canStartThisPass}
                loading={isGenerating}
              >
                Structured queue
              </Button>
            </div>
            
            <Button onClick={handleContinueToRevision}>
              {editorialPass === 'final_report'
                ? 'Continue'
                : reportOrigin === 'structured'
                  ? 'Continue to revision'
                  : 'Create Revision Queue'}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          </div>
        </>
      )}
    </StageLayout>
  );
}
