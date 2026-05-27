'use client';

import { use, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProject } from '@/hooks/useProject';
import { useGenerate } from '@/hooks/useGenerate';
import { useProjectStore } from '@/stores/projectStore';
import { TipTapEditor } from '@/components/editor';
import { WorkflowNav } from '@/components/layout';
import { Button, Badge } from '@/components/ui';
import { ReviewChecklist } from '@/components/review/ReviewChecklist';
import { checklistItemsForKey } from '@/lib/review/checklists';
import { countWords, capOutlineWordTargets } from '@/lib/utils';
import { TARGET_MANUSCRIPT_WORDS, CHAPTER_POLISH_FEATURE_ENABLED } from '@/lib/constants';
import { htmlToEditorialText } from '@/lib/utils/markdown';
import type { ChapterVersion, SceneProseSegment, WorkflowStage } from '@/types';
import type { ChapterEvaluation } from '@/lib/generation/schemas';
import { parseChapterOutlines, parseChapterScenePlan } from '@/lib/generation/schemas';
import { assembleContext } from '@/lib/context/assembler';
import { chapterScenePlanStaleReason } from '@/lib/chapter/scenePlanStale';
import { runMergedChapterSceneEvaluation } from '@/lib/chapter/runMergedChapterSceneEvaluation';

interface ChapterPageProps {
  params: Promise<{ projectId: string; chapterId: string }>;
}

export default function ChapterPage({ params }: ChapterPageProps) {
  const { projectId, chapterId } = use(params);
  const router = useRouter();
  
  const {
    project,
    documents,
    chapters,
    chapterVersions,
    loading: projectLoading,
    error: projectError,
    getDocumentByType,
    getChapterVersions,
    getLatestChapterVersion,
    getApprovedChapterVersion,
    createDocument,
    refresh,
  } = useProject(projectId);
  const { loadChapterVersions, createChapterVersion, updateChapterVersion, approveChapterVersion, error: storeError } =
    useProjectStore();
  const { generate, isGenerating, error: generateError, clearError } = useGenerate();
  
  const [content, setContent] = useState('');
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [contextWarnings, setContextWarnings] = useState<string[]>([]);
  const [sceneSegments, setSceneSegments] = useState<SceneProseSegment[]>([]);
  const [evaluation, setEvaluation] = useState<ChapterEvaluation | null>(null);
  const [runPolishThisGen, setRunPolishThisGen] = useState(false);
  const [scenePipelineStep, setScenePipelineStep] = useState<string | null>(null);
  const [draftSaveState, setDraftSaveState] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baselineContentRef = useRef('');
  /** Body used for time-based draft checkpoints (new chapter_versions row). */
  const lastCheckpointBodyRef = useRef('');
  const contentLiveRef = useRef('');
  const draftSaveStateRef = useRef(draftSaveState);
  const currentVersionIdRef = useRef<string | null>(null);
  const snapshotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Find the current chapter
  const chapter = chapters.find((c) => c.id === chapterId);

  const chapterUsageOpts = useMemo(
    () => ({ projectId, usageSource: 'chapter-editor' as const }),
    [projectId]
  );

  const mergedEvalGenerate = useMemo(
    () => (stage: WorkflowStage, data: Record<string, unknown>) =>
      generate(stage, data, chapterUsageOpts),
    [generate, chapterUsageOpts]
  );

  const outlinesDocApproved = useMemo(
    () => documents.find((d) => d.type === 'chapter-outlines' && d.approved),
    [documents]
  );

  const latestScenePlanDoc = useMemo(() => {
    if (!chapter) return undefined;
    return documents
      .filter((d) => d.type === 'chapter-scene-plan' && d.chapterNumber === chapter.chapterNumber)
      .sort((a, b) => b.version - a.version)[0];
  }, [documents, chapter]);

  const scenePlanStaleReasonMemo = useMemo(
    () => chapterScenePlanStaleReason(latestScenePlanDoc, outlinesDocApproved),
    [latestScenePlanDoc, outlinesDocApproved]
  );

  const parsedScenePlan = useMemo(() => {
    if (!latestScenePlanDoc?.content.trim()) return null;
    try {
      return parseChapterScenePlan(latestScenePlanDoc.content).scenePlan;
    } catch {
      return null;
    }
  }, [latestScenePlanDoc]);
  
  // Load chapter versions
  useEffect(() => {
    if (chapterId) {
      loadChapterVersions(chapterId);
    }
  }, [chapterId, loadChapterVersions]);
  
  // Load version content - prefer approved, fallback to latest
  useEffect(() => {
    if (!chapterId) return;
    
    // Get versions for this chapter
    const versions = getChapterVersions(chapterId);
    
    if (versions.length > 0) {
      // Prefer approved version, otherwise use latest (first in array, already sorted desc)
      const approvedVersion = versions.find(v => v.approved);
      const versionToUse = approvedVersion || versions[0];
      
      if (versionToUse) {
        const timeoutId = setTimeout(() => {
          const nextContent = versionToUse.content;
          setContent(nextContent);
          baselineContentRef.current = nextContent;
          setDraftSaveState('saved');
          setLastSavedAt(null);
          if (autosaveTimerRef.current) {
            clearTimeout(autosaveTimerRef.current);
            autosaveTimerRef.current = null;
          }
          setCurrentVersionId(versionToUse.id);
          setSceneSegments(versionToUse.sceneSegments ?? []);
          setEvaluation(null);
          lastCheckpointBodyRef.current = nextContent.trim();
        }, 0);
        return () => clearTimeout(timeoutId);
      }
    } else {
      // No versions yet - clear content to show generate screen
      const timeoutId = setTimeout(() => {
        setContent('');
        baselineContentRef.current = '';
        setDraftSaveState('saved');
        setLastSavedAt(null);
        if (autosaveTimerRef.current) {
          clearTimeout(autosaveTimerRef.current);
          autosaveTimerRef.current = null;
        }
        setCurrentVersionId(null);
        setSceneSegments([]);
        setEvaluation(null);
        lastCheckpointBodyRef.current = '';
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [chapterId, getChapterVersions, chapterVersions]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (draftSaveState === 'dirty') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [draftSaveState]);

  contentLiveRef.current = content;
  draftSaveStateRef.current = draftSaveState;
  currentVersionIdRef.current = currentVersionId;

  const scenePipelineBusyRef = useRef(false);
  scenePipelineBusyRef.current = !!scenePipelineStep;
  const sceneSegmentsRef = useRef(sceneSegments);
  sceneSegmentsRef.current = sceneSegments;

  /** Periodic draft checkpoints: new chapter_versions row so history survives bad merges (in addition to debounced in-place updates). */
  useEffect(() => {
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
      snapshotIntervalRef.current = null;
    }
    if (!chapterId || !chapter) return;

    snapshotIntervalRef.current = setInterval(() => {
      if (getApprovedChapterVersion(chapterId)) return;
      if (draftSaveStateRef.current !== 'saved') return;
      if (scenePipelineBusyRef.current || isGenerating) return;

      const body = contentLiveRef.current.trim();
      if (!body || body === lastCheckpointBodyRef.current) return;

      const vid = currentVersionIdRef.current;
      if (!vid) return;

      const latest = getLatestChapterVersion(chapterId);
      if (!latest || latest.id !== vid) return;

      void (async () => {
        try {
          const seg = sceneSegmentsRef.current;
          const nextVer = latest.version + 1;
          const plain = contentLiveRef.current;
          const newId = await createChapterVersion({
            chapterId,
            projectId,
            chapterNumber: chapter.chapterNumber,
            version: nextVer,
            content: plain,
            wordCount: countWords(plain),
            approved: false,
            parentVersionId: latest.id,
            notes: latest.notes ?? undefined,
            sceneSegments: seg.length > 0 ? seg : undefined,
          });
          lastCheckpointBodyRef.current = body;
          baselineContentRef.current = plain;
          setCurrentVersionId(newId);
          setLastSavedAt(new Date());
        } catch {
          /* leave interval running */
        }
      })();
    }, 120_000);

    return () => {
      if (snapshotIntervalRef.current) {
        clearInterval(snapshotIntervalRef.current);
        snapshotIntervalRef.current = null;
      }
    };
  }, [
    chapter,
    chapterId,
    projectId,
    createChapterVersion,
    getApprovedChapterVersion,
    getLatestChapterVersion,
    isGenerating,
  ]);
  
  if (projectLoading || !project || !chapter) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '3rem', height: '3rem', border: '4px solid #e5e5e5', borderTopColor: '#3b82f6', borderRadius: '9999px', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#737373' }}>Loading chapter...</p>
        </div>
      </div>
    );
  }
  
  const approvedVersion = getApprovedChapterVersion(chapterId);
  const isApproved = !!approvedVersion;
  const wordCount = countWords(content);
  const approvedStoryBible = getDocumentByType('story-bible');
  const approvedCreativeBrief = getDocumentByType('creative-brief');
  
  // Get adjacent chapters for navigation
  const currentIndex = chapters.findIndex((c) => c.id === chapterId);
  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;

  const scenePipelineBusy = !!scenePipelineStep;

  const chapterChecklistExtras = useMemo(
    () =>
      evaluation?.checks
        .filter((c) => !c.pass && (c.evidence || c.suggestion))
        .slice(0, 6)
        .map((c) => `[${c.sceneId}] ${c.evidence || c.suggestion || c.id}`) ?? [],
    [evaluation]
  );

  /** Blocks approve when the Phase 4 panel ran evaluation and any rubric row is severity `fail` and not passing. */
  const evalHasBlockingFailures =
    evaluation?.checks.some((c) => c.severity === 'fail' && !c.pass) ?? false;

  const handleGenerateScenePlan = async () => {
    if (!outlinesDocApproved) return;
    clearError();
    setScenePipelineStep('scene-plan');
    try {
      const approvedChapterVersions = Array.from(chapterVersions.values())
        .flat()
        .filter((version) => version.approved);
      const assembled = assembleContext({
        purpose: 'scene-plan',
        project,
        documents,
        chapters,
        approvedChapterVersions,
        currentChapter: chapter,
        targetChapterNumber: chapter.chapterNumber,
      });
      setContextWarnings(assembled.warnings);
      const outlines = capOutlineWordTargets(parseChapterOutlines(outlinesDocApproved.content), TARGET_MANUSCRIPT_WORDS);
      const outline = outlines.find((o) => o.chapterNumber === chapter.chapterNumber);
      const outlinesSourceJson = JSON.stringify({
        documentId: outlinesDocApproved.id,
        version: outlinesDocApproved.version,
        updatedAt: outlinesDocApproved.updatedAt.toISOString(),
      });
      const result = await generate('chapter-scene-plan', {
        genre: project.genre,
        chapterNumber: chapter.chapterNumber,
        outlinesSourceJson,
        outlineSliceJson: outline ? JSON.stringify(outline) : undefined,
        assembledContext: assembled.text,
        tropes: assembled.tropes,
      }, chapterUsageOpts);
      const plans = documents.filter(
        (d) => d.type === 'chapter-scene-plan' && d.chapterNumber === chapter.chapterNumber
      );
      const nextVersion = plans.reduce((m, d) => Math.max(m, d.version), 0) + 1;
      await createDocument({
        projectId,
        type: 'chapter-scene-plan',
        chapterNumber: chapter.chapterNumber,
        content: result.content,
        version: nextVersion,
        approved: false,
      });
      await refresh();
    } catch {
      /* hook error */
    } finally {
      setScenePipelineStep(null);
    }
  };

  const handleScenePipelineProse = async () => {
    if (!parsedScenePlan || scenePlanStaleReasonMemo || !outlinesDocApproved) return;
    clearError();
    setScenePipelineStep('scenes');
    setEvaluation(null);
    try {
      const approvedChapterVersions = Array.from(chapterVersions.values())
        .flat()
        .filter((version) => version.approved);
      const outlines = capOutlineWordTargets(parseChapterOutlines(outlinesDocApproved.content), TARGET_MANUSCRIPT_WORDS);
      const outline = outlines.find((o) => o.chapterNumber === chapter.chapterNumber);
      let chapterTitle = chapter.title;
      const wordTargetChapter = outline?.wordTarget ?? 3000;
      if (outline?.title) chapterTitle = outline.title;

      const segments: SceneProseSegment[] = [];
      const orderedScenes = [...parsedScenePlan.scenes].sort((a, b) => a.order - b.order);

      for (let i = 0; i < orderedScenes.length; i++) {
        const sceneCard = orderedScenes[i];
        const assembled = assembleContext({
          purpose: 'chapter-draft',
          project,
          documents,
          chapters,
          approvedChapterVersions,
          currentChapter: chapter,
          targetChapterNumber: chapter.chapterNumber,
        });
        setContextWarnings(assembled.warnings);
        const neighborBefore =
          i > 0 ? segments[i - 1]?.prose.slice(0, 400) : undefined;
        const neighborAfter =
          i < orderedScenes.length - 1
            ? `${orderedScenes[i + 1].purpose} (${orderedScenes[i + 1].setting})`
            : undefined;
        const wt =
          sceneCard.estimatedWords ??
          Math.max(400, Math.floor(wordTargetChapter / Math.max(orderedScenes.length, 1)));

        const result = await generate('chapter-scenes-prose', {
          genre: project.genre,
          chapterNumber: chapter.chapterNumber,
          chapterTitle,
          sceneCard,
          assembledContext: assembled.text,
          tropes: assembled.tropes,
          neighborSummaryBefore: neighborBefore,
          neighborSummaryAfter: neighborAfter,
          wordTarget: wt,
        }, chapterUsageOpts);
        const prosePayload = JSON.parse(result.content) as { sceneId: string; prose: string };
        segments.push({ sceneId: prosePayload.sceneId, prose: prosePayload.prose });
      }

      let draftPlain = segments.map((s) => s.prose).join('\n\n');

      if (CHAPTER_POLISH_FEATURE_ENABLED && runPolishThisGen) {
        setScenePipelineStep('polish');
        const polishAssembled = assembleContext({
          purpose: 'chapter-draft',
          project,
          documents,
          chapters,
          approvedChapterVersions,
          currentChapter: chapter,
          targetChapterNumber: chapter.chapterNumber,
        });
        const polishResult = await generate('chapter-polish', {
          genre: project.genre,
          chapterNumber: chapter.chapterNumber,
          chapterTitle,
          concatenatedDraft: draftPlain,
          assembledContext: polishAssembled.text,
        }, chapterUsageOpts);
        draftPlain = polishResult.content.trim();
      }

      setScenePipelineStep('persist');
      const latestVersion = getLatestChapterVersion(chapterId);
      const newVersion = (latestVersion?.version || 0) + 1;
      const versionData: Omit<ChapterVersion, 'id' | 'createdAt'> = {
        chapterId,
        projectId,
        chapterNumber: chapter.chapterNumber,
        version: newVersion,
        content: draftPlain,
        wordCount: countWords(draftPlain),
        approved: false,
        sceneSegments: segments,
      };
      if (latestVersion?.id) versionData.parentVersionId = latestVersion.id;
      const versionId = await createChapterVersion(versionData);
      setCurrentVersionId(versionId);
      setContent(draftPlain);
      setSceneSegments(segments);
      baselineContentRef.current = draftPlain;
      setDraftSaveState('saved');
      setLastSavedAt(new Date());
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      setScenePipelineStep('evaluate');
      const merged = await runMergedChapterSceneEvaluation({
        generate: mergedEvalGenerate,
        project,
        documents,
        chapters,
        approvedChapterVersions,
        currentChapter: chapter,
        scenePlan: parsedScenePlan,
        segments,
        chapterTitle,
        outlineWordTarget: outline?.wordTarget,
      });
      setEvaluation(merged);
      await loadChapterVersions(chapterId);
    } catch {
      /* handled by hook */
    } finally {
      setScenePipelineStep(null);
    }
  };

  const handleApplyEvalFix = async (check: ChapterEvaluation['checks'][number]) => {
    if (!currentVersionId || !check.sceneId) return;
    clearError();
    const segment = sceneSegments.find((s) => s.sceneId === check.sceneId);
    if (!segment) return;
    setScenePipelineStep(`fix-${check.id}`);
    try {
      const approvedChapterVersions = Array.from(chapterVersions.values())
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
      });
      const charactersDoc = getDocumentByType('characters');
      const endingDoc = getDocumentByType('ending');
      const structureDoc = getDocumentByType('structure');
      const nicheDoc = getDocumentByType('niche');
      const rev = await generate('revision', {
        originalContent: segment.prose,
        sceneRevisionSceneId: check.sceneId,
        revisionInstructions: check.suggestion || check.evidence || 'Improve this scene per evaluation.',
        acceptanceCriteria: [check.suggestion, check.evidence].filter(Boolean) as string[],
        assembledContext: assembled.text,
        tropes: assembled.tropes,
        charactersReference: charactersDoc?.content ?? '',
        endingReference: endingDoc?.content ?? '',
        structureReference: structureDoc?.content,
        nicheReference: nicheDoc?.content,
      }, chapterUsageOpts);
      const newProse = rev.content.trim();
      const newSegments = sceneSegments.map((s) =>
        s.sceneId === check.sceneId ? { ...s, prose: newProse } : s
      );
      const newContent = newSegments.map((s) => s.prose).join('\n\n');
      await updateChapterVersion(currentVersionId, {
        content: newContent,
        wordCount: countWords(newContent),
        sceneSegments: newSegments,
      });
      setSceneSegments(newSegments);
      setContent(newContent);
      baselineContentRef.current = newContent;
      setDraftSaveState('saved');
      setLastSavedAt(new Date());
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      let chapterTitleForEval = chapter.title;
      let outlineWordTarget: number | undefined;
      if (outlinesDocApproved) {
        const ol = capOutlineWordTargets(parseChapterOutlines(outlinesDocApproved.content), TARGET_MANUSCRIPT_WORDS);
        const outlineSlice = ol.find((o) => o.chapterNumber === chapter.chapterNumber);
        if (outlineSlice?.title) chapterTitleForEval = outlineSlice.title;
        outlineWordTarget = outlineSlice?.wordTarget;
      }

      if (parsedScenePlan) {
        setScenePipelineStep('evaluate');
        const merged = await runMergedChapterSceneEvaluation({
          generate: mergedEvalGenerate,
          project,
          documents,
          chapters,
          approvedChapterVersions,
          currentChapter: chapter,
          scenePlan: parsedScenePlan,
          segments: newSegments,
          chapterTitle: chapterTitleForEval,
          outlineWordTarget,
        });
        setEvaluation(merged);
      } else {
        setEvaluation(null);
      }

      await loadChapterVersions(chapterId);
    } finally {
      setScenePipelineStep(null);
    }
  };
  
  // Handle chapter generation
  const handleGenerate = async () => {
    clearError();
    
    try {
      const structureDoc = getDocumentByType('structure');
      const charactersDoc = getDocumentByType('characters');
      const endingDoc = getDocumentByType('ending');
      const genreDoc = getDocumentByType('genre');
      const nicheDoc = getDocumentByType('niche');
      const outlinesDoc = getDocumentByType('chapter-outlines');
      
      // Try to get chapter details from outlines first, fall back to chapter record
      let chapterTitle = chapter.title;
      let beatReference = chapter.beatReference;
      let sceneGoal = chapter.sceneGoal;
      let pov = chapter.pov;
      let wordTarget = 3000;
      
      if (outlinesDoc) {
        const parsed = parseChapterOutlines(outlinesDoc.content);
        const outlines = capOutlineWordTargets(parsed, TARGET_MANUSCRIPT_WORDS);
        const outline = outlines.find(o => o.chapterNumber === chapter.chapterNumber);
        if (outline) {
          chapterTitle = outline.title || chapterTitle;
          beatReference = outline.beatReference || beatReference;
          sceneGoal = outline.sceneGoal || sceneGoal;
          pov = outline.pov || pov;
          wordTarget = outline.wordTarget || wordTarget;
        }
      }
      
      // Send continuity in the shape the generation API expects.
      let previousChapterSummaries: Array<{ chapterNumber: number; title: string; summary: string }> | undefined;
      if (prevChapter) {
        const prevVersion = getApprovedChapterVersion(prevChapter.id);
        if (prevVersion) {
          const previousText = htmlToEditorialText(prevVersion.content).trim();
          previousChapterSummaries = [{
            chapterNumber: prevChapter.chapterNumber,
            title: prevChapter.title,
            summary: prevVersion.notes || (previousText.length > 1000 ? `${previousText.slice(0, 1000)}...` : previousText),
          }];
        }
      }

      const approvedChapterVersions = Array.from(chapterVersions.values())
        .flat()
        .filter((version) => version.approved);
      const assembled = assembleContext({
        purpose: 'chapter-draft',
        project,
        documents,
        chapters,
        approvedChapterVersions,
        currentChapter: chapter,
        targetChapterNumber: chapter.chapterNumber,
      });
      setContextWarnings(assembled.warnings);
      
      const result = await generate('chapters', {
        genre: project.genre,
        chapterNumber: chapter.chapterNumber,
        chapterTitle,
        beatReference,
        sceneGoal,
        pov,
        assembledContext: assembled.text,
        tropes: assembled.tropes,
        charactersReference: charactersDoc?.content || '',
        endingReference: endingDoc?.content || '',
        previousChapterSummaries,
        structureContext: structureDoc?.content || '',
        genreResearch: genreDoc?.content || '',
        nicheReference: nicheDoc?.content || '',
        wordTarget,
      }, chapterUsageOpts);
      
      setContent(result.content);
      
      // Create new version
      const latestVersion = getLatestChapterVersion(chapterId);
      const newVersion = (latestVersion?.version || 0) + 1;
      
      const versionData: Omit<ChapterVersion, 'id' | 'createdAt'> = {
        chapterId,
        projectId,
        chapterNumber: chapter.chapterNumber,
        version: newVersion,
        content: result.content,
        wordCount: countWords(result.content),
        approved: false,
      };
      
      // Only include parentVersionId if it exists (Firestore doesn't allow undefined)
      if (latestVersion?.id) {
        versionData.parentVersionId = latestVersion.id;
      }
      
      const versionId = await createChapterVersion(versionData);
      setCurrentVersionId(versionId);
      baselineContentRef.current = result.content;
      setDraftSaveState('saved');
      setLastSavedAt(new Date());
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    } catch {
      // Error handled by hook
    }
  };
  
  // Handle approval
  const handleApprove = async () => {
    if (!currentVersionId) return;
    
    try {
      const summaryResult = await generate('chapter-summary', {
        genre: project.genre,
        chapterNumber: chapter.chapterNumber,
        chapterTitle: chapter.title,
        chapterContent: content,
      }, chapterUsageOpts);
      await updateChapterVersion(currentVersionId, { notes: summaryResult.content.trim() });
      await approveChapterVersion(currentVersionId);
      
      // Navigate to next chapter or back to chapters list
      if (nextChapter) {
        router.push(`/projects/${projectId}/chapter/${nextChapter.id}`);
      } else {
        router.push(`/projects/${projectId}/stage/chapters`);
      }
    } catch {
      // Handle error
    }
  };
  
  // Handle content change — debounced autosave for draft versions only
  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
      if (!currentVersionId || isApproved || isGenerating || scenePipelineBusy) return;

      if (newContent === baselineContentRef.current) {
        setDraftSaveState('saved');
        return;
      }

      setDraftSaveState('dirty');
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = setTimeout(() => {
        autosaveTimerRef.current = null;
        const vid = currentVersionId;
        if (!vid) return;
        setDraftSaveState('saving');
        void (async () => {
          try {
            await updateChapterVersion(vid, {
              content: newContent,
              wordCount: countWords(newContent),
            });
            baselineContentRef.current = newContent;
            setLastSavedAt(new Date());
            setDraftSaveState('saved');
          } catch {
            setDraftSaveState('dirty');
          }
        })();
      }, 1500);
    },
    [currentVersionId, isApproved, isGenerating, scenePipelineBusy, updateChapterVersion]
  );
  
  // Get approved chapter IDs for sidebar
  const approvedChapterIds = new Set<string>();
  for (const ch of chapters) {
    if (getApprovedChapterVersion(ch.id)) {
      approvedChapterIds.add(ch.id);
    }
  }
  
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
      {/* Sidebar */}
      <WorkflowNav
        projectId={projectId}
        projectTitle={project.title}
        currentStage={project.currentStage}
        chapters={chapters}
        approvedChapterIds={approvedChapterIds}
        blurbFilled={!!project.blurb?.trim()}
        amazonDescriptionFilled={!!project.amazonDescription?.trim()}
      />
      
      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ borderBottom: '1px solid #e5e5e5', backgroundColor: '#ffffff', padding: '1.5rem 3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#171717' }}>
                  Chapter {chapter.chapterNumber}: {chapter.title}
                </h1>
                <Badge variant={isApproved ? 'success' : 'default'}>
                  {isApproved ? 'Approved' : 'Draft'}
                </Badge>
                <Badge variant="info">Claude</Badge>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#737373' }}>
                {chapter.beatReference} • {wordCount.toLocaleString()} words
              </p>
              {!isApproved && currentVersionId && (
                <p
                  style={{
                    fontSize: '0.8125rem',
                    color: draftSaveState === 'dirty' ? '#b45309' : '#737373',
                    marginTop: '0.35rem',
                  }}
                >
                  {draftSaveState === 'saving' && 'Saving draft…'}
                  {draftSaveState === 'dirty' && 'Unsaved changes (autosave in ~1.5s — updates the open draft)'}
                  {draftSaveState === 'saved' &&
                    (lastSavedAt
                      ? `Draft saved at ${lastSavedAt.toLocaleTimeString()} · checkpoints every ~2 min while editing`
                      : 'Draft in sync · checkpoints every ~2 min while editing')}
                </p>
              )}
            </div>
            
            {/* Chapter navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {prevChapter && (
                <Link href={`/projects/${projectId}/chapter/${prevChapter.id}`}>
                  <Button variant="ghost" size="sm">
                    <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Prev
                  </Button>
                </Link>
              )}
              {nextChapter && (
                <Link href={`/projects/${projectId}/chapter/${nextChapter.id}`}>
                  <Button variant="ghost" size="sm">
                    Next
                    <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
        
        {/* Error display */}
        {(projectError || generateError || storeError) && (
          <div style={{ margin: '1rem 3rem 0', padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px' }}>
            <p style={{ fontSize: '0.875rem', color: '#dc2626' }}>{projectError || generateError || storeError}</p>
          </div>
        )}

        {(!approvedStoryBible || !approvedCreativeBrief || contextWarnings.length > 0) && (
          <div style={{ margin: '1rem 3rem 0', padding: '1rem', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px' }}>
            <p style={{ fontSize: '0.875rem', color: '#92400e', fontWeight: 600, marginBottom: '0.35rem' }}>
              Canon context warning
            </p>
            <p style={{ fontSize: '0.875rem', color: '#92400e' }}>
              {!approvedStoryBible
                ? 'No approved Story Bible is available yet. Chapter generation will fall back to approved planning documents.'
                : !approvedCreativeBrief
                  ? 'No approved Creative Brief is available yet. Chapter generation will fall back to Story Bible sections.'
                  : contextWarnings[0]}
            </p>
          </div>
        )}

        <div style={{ margin: '1rem 3rem 0', padding: '1rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.5rem' }}>
            Scene pipeline
          </p>
          {scenePlanStaleReasonMemo && (
            <p style={{ fontSize: '0.875rem', color: '#b45309', marginBottom: '0.75rem' }}>
              Scene plan is stale ({scenePlanStaleReasonMemo}): chapter outlines changed since this plan. Regenerate the scene plan before generating scene prose.
            </p>
          )}
          {parsedScenePlan && (
            <ul style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '0.75rem', paddingLeft: '1.25rem' }}>
              {[...parsedScenePlan.scenes].sort((a, b) => a.order - b.order).map((s) => (
                <li key={s.id}>{s.purpose}</li>
              ))}
            </ul>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={isGenerating || !!scenePipelineStep || isApproved || !outlinesDocApproved}
              onClick={handleGenerateScenePlan}
            >
              Generate scene plan
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={
                isGenerating ||
                !!scenePipelineStep ||
                isApproved ||
                !parsedScenePlan ||
                !!scenePlanStaleReasonMemo
              }
              onClick={handleScenePipelineProse}
            >
              Generate prose from scenes
            </Button>
            {CHAPTER_POLISH_FEATURE_ENABLED && (
              <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={runPolishThisGen}
                  onChange={(e) => setRunPolishThisGen(e.target.checked)}
                  disabled={!!scenePipelineStep || isApproved}
                />
                Run polish this generation
              </label>
            )}
          </div>
          {evalHasBlockingFailures && (
            <p style={{ fontSize: '0.8125rem', color: '#991b1b', marginTop: '0.75rem', fontWeight: 600 }}>
              One or more checks are severity “fail”. Fix them or use Apply fix before approving this chapter.
            </p>
          )}
          {evaluation && evaluation.checks.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.35rem' }}>
                Quality checks
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {evaluation.checks.map((c) => (
                  <li
                    key={`${c.id}-${c.sceneId}`}
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.35rem 0',
                      borderBottom: '1px solid #e2e8f0',
                      color: c.pass ? '#15803d' : c.severity === 'fail' ? '#b91c1c' : '#a16207',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>[{c.sceneId}]</span> {c.evidence || c.id}
                    {!c.pass && (
                      <Button
                        variant="ghost"
                        size="sm"
                        style={{ marginLeft: '0.5rem' }}
                        disabled={!!scenePipelineStep || isApproved}
                        onClick={() => handleApplyEvalFix(c)}
                      >
                        Apply fix
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {/* Editor */}
        <div style={{ flex: 1, padding: '2rem 3rem', display: 'flex', flexDirection: 'column' }}>
          {isGenerating || scenePipelineBusy ? (
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e5e5', borderRadius: '12px', padding: '3rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                <div style={{ width: '3rem', height: '3rem', border: '4px solid #e5e5e5', borderTopColor: '#3b82f6', borderRadius: '9999px', animation: 'spin 1s linear infinite' }} />
                <p style={{ color: '#737373' }}>
                  {scenePipelineStep ? `Scene pipeline: ${scenePipelineStep}…` : 'Writing chapter…'}
                </p>
                <p style={{ fontSize: '0.875rem', color: '#737373' }}>This may take a few minutes...</p>
              </div>
            </div>
          ) : content ? (
            <TipTapEditor
              content={content}
              onChange={handleContentChange}
              editable={!isApproved}
              placeholder="Start writing your chapter..."
            />
          ) : (
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e5e5', borderRadius: '12px', padding: '4rem', textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '4rem', height: '4rem', backgroundColor: '#f5f5f5', borderRadius: '9999px', marginBottom: '1rem' }}>
                <svg style={{ width: '2rem', height: '2rem', color: '#737373' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#171717', marginBottom: '0.5rem' }}>
                Generate Chapter {chapter.chapterNumber}
              </h2>
              <p style={{ color: '#737373', marginBottom: '1.5rem', maxWidth: '28rem', marginLeft: 'auto', marginRight: 'auto' }}>
                Let AI write this chapter based on your story structure, characters, and ending.
              </p>
                <Button onClick={handleGenerate} size="lg" disabled={!!scenePipelineStep}>
                <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Chapter
              </Button>
            </div>
          )}
        </div>
        
        {/* Action bar */}
        {content && (
          <div style={{ borderTop: '1px solid #e5e5e5', backgroundColor: '#ffffff', padding: '1.5rem 3rem' }}>
            {!isApproved && (
              <ReviewChecklist
                title="Review before approving this chapter"
                items={checklistItemsForKey('chapter-approval', { chapterExtras: chapterChecklistExtras })}
                className="mb-4"
              />
            )}
            {evalHasBlockingFailures && (
              <div
                style={{
                  marginBottom: '1rem',
                  padding: '0.75rem 1rem',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  color: '#991b1b',
                }}
              >
                Approve is disabled until no remaining checks have severity <strong>fail</strong> (rerun the scene pipeline or apply fixes so evaluation passes those rows).
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Secondary actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Button
                  variant="secondary"
                  onClick={handleGenerate}
                  disabled={isGenerating || !!scenePipelineStep || isApproved}
                >
                  <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate
                </Button>
              </div>
              
              {/* Visual separator */}
              <div style={{ height: '2rem', width: '1px', backgroundColor: '#e5e5e5', margin: '0 1rem' }} />
              
              {/* Primary action */}
              {isApproved ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981' }}>
                  <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span style={{ fontWeight: 500 }}>Approved</span>
                </div>
              ) : (
                <Button
                  onClick={handleApprove}
                  disabled={isGenerating || !!scenePipelineStep || !content || evalHasBlockingFailures}
                  size="lg"
                >
                  <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Approve Chapter
                </Button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
