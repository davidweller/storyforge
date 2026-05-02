'use client';

import { use, useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProject } from '@/hooks/useProject';
import { useGenerate, type GenerateOptions } from '@/hooks/useGenerate';
import { useProjectStore } from '@/stores/projectStore';
import { getNextStage, STAGE_ORDER, STAGE_NAMES } from '@/lib/utils';
import { getEstimatedMinutesForStep, FULL_AUTO_ESTIMATES_MINUTES } from '@/lib/fullAutoEstimates';
import { Button } from '@/components/ui';
import type {
  WorkflowStage,
  DocumentType,
  EditorialPass,
  SceneProseSegment,
  ChapterVersion,
} from '@/types';
import { countWords, capOutlineWordTargets } from '@/lib/utils';
import { EDITORIAL_PASSES, documentTypeForEditorialPass } from '@/lib/editorial/passes';
import {
  TARGET_MANUSCRIPT_WORDS,
  CHAPTER_POLISH_FEATURE_ENABLED,
  FULL_AUTO_USE_SCENE_PIPELINE_DEFAULT,
} from '@/lib/constants';
import { getEffectiveModelForStage } from '@/lib/data/models';
import { htmlToEditorialText } from '@/lib/utils/markdown';
import { estimateFullAutoTokens, formatTokenRange } from '@/lib/cost/preflight';
import { AnthropicDraftLegCostHint } from '@/components/cost/AnthropicDraftLegCostHint';
import {
  clearFullAutoCheckpointPending,
  clearFullAutoRunMarkers,
  fullAutoCheckpointsEnabled,
  readFullAutoCheckpointPending,
  writeFullAutoCheckpointPending,
  writeFullAutoLastStep,
} from '@/lib/fullAuto/checkpointStorage';
import {
  parseChapterOutlines,
  parseEndingConcepts,
  parseRevisionQueue,
  parseRevisionVerification,
  parseTitleOptions,
  parseChapterScenePlan,
} from '@/lib/generation/schemas';
import { runMergedChapterSceneEvaluation } from '@/lib/chapter/runMergedChapterSceneEvaluation';
import {
  assembleContext,
  buildStoryBibleSourceRefs,
  getValidatedApprovedChapterOutlines,
  isCreativeBriefStale,
  isStoryBibleStale,
} from '@/lib/context/assembler';
import { persistRevisionQueueFromParsed } from '@/lib/editorial/persistRevisionQueue';
import { spliceSceneIntoChapter } from '@/lib/editorial/sceneSplice';
import * as firestore from '@/lib/db/client';

/** Memoized spinner in an isolated layer so parent re-renders/repaints don't reset or flicker the animation. */
const FullAutoSpinner = memo(function FullAutoSpinner() {
  return (
    <div
      key="full-auto-spinner-wrap"
      style={{
        isolation: 'isolate',
        transform: 'translateZ(0)',
        width: '3.5rem',
        height: '3.5rem',
        margin: '0 auto 1.5rem',
        flexShrink: 0,
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes fullAutoSpinnerRotate {
  from { transform: translateZ(0) rotate(0deg); }
  to { transform: translateZ(0) rotate(360deg); }
}
@-webkit-keyframes fullAutoSpinnerRotate {
  from { -webkit-transform: translateZ(0) rotate(0deg); }
  to { -webkit-transform: translateZ(0) rotate(360deg); }
}`,
        }}
      />
      <div
        className="border-4 border-[var(--border)] border-t-[var(--accent)] rounded-full"
        style={{
          width: '100%',
          height: '100%',
          animation: 'fullAutoSpinnerRotate 0.8s linear infinite',
          WebkitAnimation: 'fullAutoSpinnerRotate 0.8s linear infinite',
          willChange: 'transform',
        }}
      />
    </div>
  );
});

function chapterSnapshot(text: string, maxChars = 600): string {
  const normalized = htmlToEditorialText(text).trim();
  if (normalized.length <= maxChars) return normalized;
  return normalized.slice(0, maxChars) + '...';
}

const stageToDocType: Record<string, DocumentType> = {
  'genre-research': 'genre',
  niche: 'niche',
  ending: 'ending',
  characters: 'characters',
  structure: 'structure',
  'chapter-outlines': 'chapter-outlines',
};

type OverlayStatus = 'idle' | 'running' | 'checkpoint' | 'complete' | 'error';

type AutoControlAction = 'none' | 'pause' | 'stop';

class AutoControlError extends Error {
  action: Exclude<AutoControlAction, 'none'>;

  constructor(action: Exclude<AutoControlAction, 'none'>) {
    super(action === 'pause' ? 'Full auto paused' : 'Full auto stopped');
    this.name = 'AutoControlError';
    this.action = action;
  }
}

export default function FullAutoPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();
  const {
    project,
    loading: projectLoading,
    getDocumentByType,
    getLatestDocumentByType,
    getApprovedChapterVersion,
    getChapterVersions,
    getLatestChapterVersion,
  } = useProject(projectId);
  const store = useProjectStore.getState();
  const {
    createDocument,
    updateDocument,
    approveDocument,
    advanceStage,
    createChapter,
    createChapterVersion,
    approveChapterVersion,
    loadChapterVersions,
    loadRevisionTasks,
    createRevisionTask,
    updateRevisionTask,
    deleteRevisionTasksForProjectAndPass,
    updateProject,
    loadProject,
  } = store;
  const { generate, clearError } = useGenerate();

  const [overlayStatus, setOverlayStatus] = useState<OverlayStatus>('idle');
  const [currentStepLabel, setCurrentStepLabel] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [fullAutoRunWarnings, setFullAutoRunWarnings] = useState<string[]>([]);
  const [totalSteps, setTotalSteps] = useState(0);
  const [timeLeftThisStep, setTimeLeftThisStep] = useState(0);
  const [timeLeftTotal, setTimeLeftTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [controlActionPending, setControlActionPending] = useState<AutoControlAction>('none');
  const [fullAutoUsageSession, setFullAutoUsageSession] = useState({ runTotal: 0, lastStep: 0 });
  const [preflightHint, setPreflightHint] = useState<string | null>(null);
  const [checkpointGate, setCheckpointGate] = useState<{
    title: string;
    bullets: string[];
    resolve: () => void;
  } | null>(null);
  const pipelineStarted = useRef(false);
  const controlActionRef = useRef<AutoControlAction>('none');
  const lastStepUpdate = useRef(0);
  const stepThrottleMs = 600;

  const fullAutoCostChapterCount = useMemo(() => {
    const od = getLatestDocumentByType('chapter-outlines');
    if (!od?.content) return 1;
    try {
      const parsed = parseChapterOutlines(String(od.content));
      return Math.max(1, capOutlineWordTargets(parsed, TARGET_MANUSCRIPT_WORDS).length);
    } catch {
      return 8;
    }
  }, [getLatestDocumentByType]);

  const setStep = useCallback(
    (label: string, stepIdx: number, total: number, minsThis: number, minsTotal: number) => {
      const now = Date.now();
      if (now - lastStepUpdate.current >= stepThrottleMs || stepIdx === 0) {
        lastStepUpdate.current = now;
        setCurrentStepLabel(label);
        setStepIndex(stepIdx);
        setTotalSteps(total);
        setTimeLeftThisStep(minsThis);
        setTimeLeftTotal(minsTotal);
      }
    },
    []
  );

  const requestPause = useCallback(() => {
    if (controlActionRef.current !== 'none') return;
    controlActionRef.current = 'pause';
    setControlActionPending('pause');
  }, []);

  const requestStop = useCallback(() => {
    if (controlActionRef.current !== 'none') return;
    controlActionRef.current = 'stop';
    setControlActionPending('stop');
  }, []);

  const throwIfControlRequested = useCallback(() => {
    if (controlActionRef.current === 'pause') {
      throw new AutoControlError('pause');
    }
    if (controlActionRef.current === 'stop') {
      throw new AutoControlError('stop');
    }
  }, []);

  // Redirect if not in full auto or already done
  useEffect(() => {
    if (projectLoading || !project) return;
    const hasBlurb = !!project.blurb?.trim();
    const hasAmazon = !!project.amazonDescription?.trim();
    if (!project.fullAutoMode && overlayStatus === 'idle') {
      router.replace(`/projects/${projectId}`);
      return;
    }
    if (hasBlurb && hasAmazon && overlayStatus === 'idle') {
      store.updateProject(projectId, { fullAutoMode: false });
      router.replace(`/projects/${projectId}`);
    }
  }, [project, projectLoading, projectId, router, overlayStatus, store]);

  // Run pipeline once when project is ready and fullAutoMode
  useEffect(() => {
    if (
      projectLoading ||
      !project ||
      !project.fullAutoMode ||
      overlayStatus === 'complete' ||
      overlayStatus === 'checkpoint'
    )
      return;
    if (overlayStatus === 'error' && retryTrigger === 0) return;
    if (overlayStatus === 'error') pipelineStarted.current = false;
    if (pipelineStarted.current) return;

    const run = async () => {
      pipelineStarted.current = true;
      controlActionRef.current = 'none';
      setControlActionPending('none');
      setOverlayStatus('running');
      setError(null);
      setFullAutoRunWarnings([]);
      setFullAutoUsageSession({ runTotal: 0, lastStep: 0 });
      clearError();
      setStep('Loading project…', 0, 20, 0, 0);

      const fullAutoRunId =
        typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto
          ? globalThis.crypto.randomUUID()
          : `fa-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const genUsage = { projectId, runId: fullAutoRunId, usageSource: 'full-auto' as const };
      const generateTracked = async (
        stage: WorkflowStage,
        data: Record<string, unknown>,
        options?: GenerateOptions
      ) => {
        const r = await generate(stage, data, {
          suppressOutputCountWarnings: true,
          ...genUsage,
          ...options,
        });
        setFullAutoUsageSession((s) => ({
          runTotal: s.runTotal + r.tokensUsed,
          lastStep: r.tokensUsed,
        }));
        if (r.warnings?.length) {
          setFullAutoRunWarnings((prev) => [...prev, ...(r.warnings ?? []).map((w) => `[${stage}] ${w}`)]);
        }
        return r;
      };

      const checkpointsEnabled = fullAutoCheckpointsEnabled(projectId);

      const runCheckpoint = async (stepKey: string, title: string, bullets: string[]) => {
        writeFullAutoLastStep(projectId, stepKey);
        if (checkpointsEnabled) {
          writeFullAutoCheckpointPending(projectId, { stepKey, title, bullets });
        }
        if (!checkpointsEnabled) return;
        await new Promise<void>((resolve) => {
          setOverlayStatus('checkpoint');
          setCheckpointGate({ title, bullets, resolve });
        });
        clearFullAutoCheckpointPending(projectId);
        setCheckpointGate(null);
        setOverlayStatus('running');
      };

      try {
        const st = useProjectStore.getState();
        const od = st.documents
          .filter((d) => d.projectId === projectId && d.type === 'chapter-outlines')
          .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0];
        let n = 1;
        if (od?.content) {
          try {
            n = Math.max(1, parseChapterOutlines(String(od.content)).length);
          } catch {
            n = 8;
          }
        }
        const est = estimateFullAutoTokens({
          chapterCount: n,
          useScenePipelineForChapters: FULL_AUTO_USE_SCENE_PIPELINE_DEFAULT,
        });
        setPreflightHint(formatTokenRange(est.low, est.high));
      } catch {
        setPreflightHint(null);
      }

      let currentStage = project.currentStage as WorkflowStage;
      let stepIdx = 0;
      const docStages: WorkflowStage[] = [
        'genre-research',
        'niche',
        'ending',
        'characters',
        'structure',
        'title',
        'chapter-outlines',
      ];

      const getPayload = (stage: string): Record<string, unknown> => {
        const data: Record<string, unknown> = {
          premise: project.premise,
          genre: project.genre,
          research: project.research,
        };
        if (stage === 'niche') {
          const genreDoc = getDocumentByType('genre');
          if (genreDoc) data.genreResearch = genreDoc.content;
        } else if (stage === 'ending') {
          const nicheDoc = getDocumentByType('niche');
          if (nicheDoc) data.nicheReference = nicheDoc.content;
        } else if (stage === 'characters') {
          const nicheDoc = getDocumentByType('niche');
          const endingDoc = getDocumentByType('ending');
          if (nicheDoc) data.nicheReference = nicheDoc.content;
          if (endingDoc) data.endingReference = endingDoc.content;
        } else if (stage === 'structure') {
          const nicheDoc = getDocumentByType('niche');
          const endingDoc = getDocumentByType('ending');
          const charsDoc = getDocumentByType('characters');
          if (nicheDoc) data.nicheReference = nicheDoc.content;
          if (endingDoc) data.endingReference = endingDoc.content;
          if (charsDoc) data.charactersReference = charsDoc.content;
        } else if (stage === 'chapter-outlines') {
          const structureDoc = getDocumentByType('structure');
          const nicheDoc = getDocumentByType('niche');
          const endingDoc = getDocumentByType('ending');
          const charsDoc = getDocumentByType('characters');
          const genreDoc = getDocumentByType('genre');
          if (structureDoc) data.structureReference = structureDoc.content;
          if (nicheDoc) data.nicheReference = nicheDoc.content;
          if (endingDoc) data.endingReference = endingDoc.content;
          if (charsDoc) data.charactersReference = charsDoc.content;
          if (genreDoc) data.genreResearch = genreDoc.content;
        }
        return data;
      };

      const runDocStage = async (stage: WorkflowStage): Promise<void> => {
        throwIfControlRequested();
        const docType = stageToDocType[stage];
        if (!docType) return;
        const mins = getEstimatedMinutesForStep(stage === 'genre-research' ? 'genre-research' : stage);
        setStep(STAGE_NAMES[stage] || stage, stepIdx, totalSteps, mins, timeLeftTotal);
        const data = getPayload(stage);
        const result = await generateTracked(stage, data);
        const latest = getLatestDocumentByType(docType);
        if (latest) {
          await updateDocument(latest.id, {
            content: result.content,
            version: (latest.version || 0) + 1,
          });
          await approveDocument(latest.id);
        } else {
          const id = await createDocument({
            projectId,
            type: docType,
            content: result.content,
            version: 1,
            approved: false,
          });
          await approveDocument(id);
        }
        const next = getNextStage(stage);
        if (next && currentStage === stage) {
          await advanceStage(projectId, next as WorkflowStage);
          currentStage = next as WorkflowStage;
        }
        stepIdx++;
        throwIfControlRequested();
      };

      const latestDocOfType = (type: DocumentType, approvedOnly = false) =>
        useProjectStore.getState().documents
          .filter((d) => d.projectId === projectId && d.type === type && (!approvedOnly || d.approved))
          .sort((a, b) => b.version - a.version || b.updatedAt.getTime() - a.updatedAt.getTime())[0];

      const ensureCanonDocuments = async (): Promise<void> => {
        await loadProject(projectId);
        let state = useProjectStore.getState();
        let docs = state.documents.filter((d) => d.projectId === projectId);
        const outlinesGateAtCanon = getValidatedApprovedChapterOutlines(docs);
        if (!outlinesGateAtCanon.ok) {
          throw new Error(outlinesGateAtCanon.reason);
        }

        const currentProject = state.currentProject ?? project;
        const derivedFrom = buildStoryBibleSourceRefs(docs);

        if (derivedFrom.length === 0) {
          throw new Error('Cannot generate Story Bible because no approved planning documents are available.');
        }

        let latestStoryBible = latestDocOfType('story-bible');
        let approvedStoryBible = latestDocOfType('story-bible', true);
        const shouldGenerateStoryBible =
          !approvedStoryBible ||
          !latestStoryBible ||
          isStoryBibleStale(approvedStoryBible ?? latestStoryBible, docs);

        if (shouldGenerateStoryBible) {
          throwIfControlRequested();
          setStep('Story Bible canon', stepIdx, 20, 3, 0);
          const byType = (type: DocumentType) =>
            docs.find((doc) => doc.type === type && doc.approved)?.content;
          const result = await generateTracked('story-bible', {
            title: currentProject.title,
            premise: currentProject.premise,
            genre: currentProject.genre,
            niche: currentProject.niche,
            research: currentProject.research,
            derivedFrom,
            genreResearch: byType('genre'),
            nicheReference: byType('niche'),
            endingReference: byType('ending'),
            endingChoice: byType('ending-choice'),
            charactersReference: byType('characters'),
            structureReference: byType('structure'),
            chapterOutlinesReference: outlinesGateAtCanon.document.content,
          });

          let storyBibleId: string;
          if (latestStoryBible) {
            await updateDocument(latestStoryBible.id, {
              content: result.content,
              version: latestStoryBible.version + 1,
              approved: false,
            });
            storyBibleId = latestStoryBible.id;
          } else {
            storyBibleId = await createDocument({
              projectId,
              type: 'story-bible',
              content: result.content,
              version: 1,
              approved: false,
            });
          }
          await approveDocument(storyBibleId);
          stepIdx++;
          await loadProject(projectId);
        }

        state = useProjectStore.getState();
        docs = state.documents.filter((d) => d.projectId === projectId);
        latestStoryBible = latestDocOfType('story-bible');
        approvedStoryBible = latestDocOfType('story-bible', true);
        if (!approvedStoryBible) {
          throw new Error('Story Bible generation completed but no approved Story Bible could be loaded.');
        }

        const latestCreativeBrief = latestDocOfType('creative-brief');
        const approvedCreativeBrief = latestDocOfType('creative-brief', true);
        const shouldGenerateCreativeBrief =
          !approvedCreativeBrief ||
          !latestCreativeBrief ||
          isCreativeBriefStale(approvedCreativeBrief ?? latestCreativeBrief, approvedStoryBible);

        if (shouldGenerateCreativeBrief) {
          throwIfControlRequested();
          setStep('Creative Brief canon', stepIdx, 20, 1, 0);
          const result = await generateTracked('creative-brief', {
            storyBibleContent: approvedStoryBible.content,
            storyBibleDocumentId: approvedStoryBible.id,
            storyBibleVersion: approvedStoryBible.version,
            storyBibleUpdatedAt: approvedStoryBible.updatedAt.toISOString(),
          });

          let creativeBriefId: string;
          if (latestCreativeBrief) {
            await updateDocument(latestCreativeBrief.id, {
              content: result.content,
              version: latestCreativeBrief.version + 1,
              approved: false,
            });
            creativeBriefId = latestCreativeBrief.id;
          } else {
            creativeBriefId = await createDocument({
              projectId,
              type: 'creative-brief',
              content: result.content,
              version: 1,
              approved: false,
            });
          }
          await approveDocument(creativeBriefId);
          stepIdx++;
          await loadProject(projectId);
        }

        throwIfControlRequested();
      };

      try {
        // Timeout so we don't hang forever if load or rewind stalls (e.g. network/Firestore)
        const LOAD_TIMEOUT_MS = 35_000;
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Loading project timed out. Check your connection and try again.')), LOAD_TIMEOUT_MS);
        });

        const loadAndRewind = async () => {
          // Reload to get latest project/documents
          await loadProject(projectId);
          const proj = useProjectStore.getState().currentProject;
          if (!proj) throw new Error('Project not loaded');
          currentStage = proj.currentStage as WorkflowStage;

          // If we're past chapter-outlines but chapters weren't written (e.g. resume after error), rewind so we run chapter-outlines and/or chapters
          const stagesRequiringChapters: WorkflowStage[] = ['compilation', 'export-draft', 'editorial', 'revision', 'export-final'];
          if (stagesRequiringChapters.includes(currentStage)) {
            setStep('Checking chapters…', stepIdx, 20, 0, 0);
            try {
              const docs = useProjectStore.getState().documents;
              const outlinesDoc = docs
                .filter((d) => d.type === 'chapter-outlines')
                .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0];
              const hasOutlinesContent = typeof outlinesDoc?.content === 'string' && outlinesDoc.content.trim().length > 0;
              if (!hasOutlinesContent) {
                currentStage = 'chapter-outlines';
                await advanceStage(projectId, 'chapter-outlines');
                await loadProject(projectId);
              } else {
                const content = outlinesDoc!.content as string;
                const outlines = parseChapterOutlines(content);
                const chs = useProjectStore.getState().chapters;
                await Promise.all(chs.map((ch) => loadChapterVersions(ch.id)));
                const approvedVersions = new Map<string, boolean>();
                for (const ch of chs) {
                  const ver = getApprovedChapterVersion(ch.id);
                  approvedVersions.set(ch.id, !!ver);
                }
                const allChaptersWritten = outlines.length > 0 && outlines.every((outline) => {
                  const ch = chs.find((c) => c.chapterNumber === outline.chapterNumber);
                  return ch && approvedVersions.get(ch.id);
                });
                if (!allChaptersWritten) {
                  currentStage = 'chapters';
                  await advanceStage(projectId, 'chapters');
                  await loadProject(projectId);
                }
              }
            } catch {
              currentStage = 'chapters';
              await advanceStage(projectId, 'chapters');
              await loadProject(projectId);
            }
          }
        };

        await Promise.race([loadAndRewind(), timeoutPromise]);

        if (fullAutoCheckpointsEnabled(projectId)) {
          const pending = readFullAutoCheckpointPending(projectId);
          if (pending) {
            setOverlayStatus('checkpoint');
            await new Promise<void>((resolve) => {
              setCheckpointGate({ title: pending.title, bullets: pending.bullets, resolve });
            });
            clearFullAutoCheckpointPending(projectId);
            setCheckpointGate(null);
            setOverlayStatus('running');
          }
        } else {
          clearFullAutoCheckpointPending(projectId);
        }

        let totalStepsEst = 0;
        const addEst = (key: string, count?: number) => {
          totalStepsEst += getEstimatedMinutesForStep(key, count);
        };

        // Document stages
        for (const stage of docStages) {
          const order = STAGE_ORDER as readonly string[];
          if (order.indexOf(stage) < order.indexOf(currentStage)) continue;
          if (stage === 'ending') {
            addEst('ending-concepts');
            addEst('ending-expand');
          } else if (stage === 'title') addEst('title');
          else if (stage === 'chapter-outlines') addEst('chapter-outlines');
          else addEst(stage);
        }
        addEst('chapter-per', 12); // assume ~12 chapters
        addEst('story-bible', 1);
        addEst('creative-brief', 1);
        addEst('compilation');
        addEst('export-draft');
        addEst('editorial');
        addEst('revision-per', 5);
        addEst('export-final');
        addEst('blurb');
        addEst('amazon-description');
        const initialTotal = totalStepsEst;

        // Genre-research
        if (currentStage === 'genre-research') {
          await runDocStage('genre-research');
          await loadProject(projectId);
        }
        // Niche
        if (currentStage === 'niche') {
          await runDocStage('niche');
          await loadProject(projectId);
        }
        // Ending: concepts then expand first
        if (currentStage === 'ending') {
          throwIfControlRequested();
          setStep('Choose Your Ending (concepts)', stepIdx, 20, FULL_AUTO_ESTIMATES_MINUTES['ending-concepts'] ?? 2, initialTotal);
          const nicheDoc = getDocumentByType('niche');
          const conceptsResult = await generateTracked('ending', {
            premise: project.premise,
            genre: project.genre,
            nicheReference: nicheDoc?.content || '',
          });
          let endingDocId: string | null = null;
          const latestEnding = getLatestDocumentByType('ending');
          if (latestEnding) {
            await updateDocument(latestEnding.id, { content: conceptsResult.content, version: (latestEnding.version || 0) + 1 });
            endingDocId = latestEnding.id;
          } else {
            endingDocId = await createDocument({
              projectId,
              type: 'ending',
              content: conceptsResult.content,
              version: 1,
              approved: false,
            });
          }
          const concepts = parseEndingConcepts(conceptsResult.content);
          const first = concepts[0];
          if (!first) throw new Error('No ending concepts parsed');
          const latestChoice = getLatestDocumentByType('ending-choice');
          const choicePayload = JSON.stringify({
            id: first.id,
            title: first.title,
            summary: first.summary,
            emotionalPayoff: first.emotionalPayoff,
            characterResolution: first.characterResolution,
            thematicStatement: first.thematicStatement,
          });
          if (latestChoice) {
            await updateDocument(latestChoice.id, {
              content: choicePayload,
              version: (latestChoice.version || 0) + 1,
              approved: true,
            });
          } else {
            await createDocument({
              projectId,
              type: 'ending-choice',
              content: choicePayload,
              version: 1,
              approved: true,
            });
          }
          setStep('Choose Your Ending (expanding)', stepIdx, 20, FULL_AUTO_ESTIMATES_MINUTES['ending-expand'] ?? 3, initialTotal);
          const expandResult = await generateTracked('ending', {
            premise: project.premise,
            genre: project.genre,
            nicheReference: nicheDoc?.content || '',
            selectedEnding: `${first.title}\n\n${first.summary}\n\nEmotional Payoff: ${first.emotionalPayoff}\nCharacter Resolution: ${first.characterResolution}\nThematic Statement: ${first.thematicStatement}`,
          });
          if (endingDocId) {
            await updateDocument(endingDocId, { content: expandResult.content });
            await approveDocument(endingDocId);
          }
          if (!project.title) await updateProject(projectId, { title: first.title });
          const next = getNextStage('ending');
          if (next) await advanceStage(projectId, next as WorkflowStage);
          currentStage = (next || currentStage) as WorkflowStage;
          stepIdx += 2;
          await loadProject(projectId);
          throwIfControlRequested();
          await runCheckpoint('after-ending', 'Checkpoint: ending locked in', [
            'Review the expanded ending blueprint on the Ending stage.',
            'The server may already have saved canon — refresh the project if you are unsure.',
            'Continue when satisfied; Full Auto proceeds to characters and structure.',
          ]);
        }
        // Characters, structure
        if (currentStage === 'characters') {
          await runDocStage('characters');
          await loadProject(projectId);
        }
        if (currentStage === 'structure') {
          await runDocStage('structure');
          await loadProject(projectId);
        }
        // Title
        if (currentStage === 'title') {
          throwIfControlRequested();
          setStep(STAGE_NAMES['title'], stepIdx, 20, FULL_AUTO_ESTIMATES_MINUTES['title'] ?? 1, initialTotal);
          const structureDoc = getDocumentByType('structure');
          const endingDoc = getDocumentByType('ending');
          const charactersDoc = getDocumentByType('characters');
          const nicheDoc = getDocumentByType('niche');
          const titleResult = await generateTracked('title', {
            genre: project.genre,
            premise: project.premise,
            structureReference: structureDoc?.content ?? '',
            endingReference: endingDoc?.content ?? '',
            charactersReference: charactersDoc?.content ?? '',
            nicheReference: nicheDoc?.content ?? '',
          });
          const options = parseTitleOptions(titleResult.content);
          const chosen = options[0]?.trim() || project.title || 'Untitled';
          await updateProject(projectId, { title: chosen });
          const next = getNextStage('title');
          if (next) await advanceStage(projectId, next as WorkflowStage);
          currentStage = (next || currentStage) as WorkflowStage;
          stepIdx++;
          await loadProject(projectId);
          throwIfControlRequested();
          await runCheckpoint('after-title', 'Checkpoint: working title chosen', [
            'Confirm the auto-selected title fits your positioning.',
            'You can rename later, but it affects chapter context immediately.',
          ]);
        }
        // Chapter-outlines (then run chapters in same pipeline run)
        if (currentStage === 'chapter-outlines') {
          await runDocStage('chapter-outlines');
          await loadProject(projectId);
          currentStage = 'chapters';
          throwIfControlRequested();
          await runCheckpoint('after-outlines', 'Checkpoint: chapter outlines ready', [
            'Review chapter outlines before bulk prose generation.',
            'Adjust beats or word targets if the blueprint feels wrong.',
          ]);
        }
        // Chapters: create chapter records and generate each (read from store so we see just-saved chapter-outlines)
        if (currentStage === 'chapters') {
          await ensureCanonDocuments();
          const docs = useProjectStore.getState().documents;
          const outlinesDoc = docs
            .filter((d) => d.type === 'chapter-outlines')
            .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0];
          if (!outlinesDoc?.content) throw new Error('No chapter outlines. Complete the Chapter Outlines stage first, then resume Full Auto.');
          const parsed = parseChapterOutlines(String(outlinesDoc.content));
          const outlines = capOutlineWordTargets(parsed, TARGET_MANUSCRIPT_WORDS);
          if (outlines.length === 0) {
            throw new Error('Chapter outlines could not be parsed. Open Chapter Outlines, ensure the format is correct and save, then resume Full Auto.');
          }
          const chs = useProjectStore.getState().chapters;
          await Promise.all(chs.map((ch) => loadChapterVersions(ch.id)));
          // Read approved state directly from store (hook's getApprovedChapterVersion can be stale in async pipeline)
          const chapterVersionsMap = useProjectStore.getState().chapterVersions;
          const allChaptersAlreadyWritten = outlines.every((outline) => {
            const ch = chs.find((c) => c.chapterNumber === outline.chapterNumber);
            if (!ch) return false;
            const versions = chapterVersionsMap.get(ch.id) || [];
            return versions.some((v) => v.approved);
          });
          if (allChaptersAlreadyWritten) {
            setStep('Chapters already complete', stepIdx, 20, 0, 0);
            const next = getNextStage('chapters');
            if (next) await advanceStage(projectId, next as WorkflowStage);
            currentStage = (next || currentStage) as WorkflowStage;
            await loadProject(projectId);
          } else {
          const chapterSummaries = new Map<number, { title: string; summary: string }>();
          for (const existingChapter of chs) {
            const versions = chapterVersionsMap.get(existingChapter.id) || [];
            const approved = versions.find((v) => v.approved);
            if (approved?.notes?.trim()) {
              chapterSummaries.set(existingChapter.chapterNumber, {
                title: existingChapter.title,
                summary: approved.notes.trim(),
              });
            }
          }
          for (let i = 0; i < outlines.length; i++) {
            throwIfControlRequested();
            const outline = outlines[i];
            const chs = useProjectStore.getState().chapters;
            setStep(`Writing Chapter ${outline.chapterNumber} of ${outlines.length}`, stepIdx, 20, FULL_AUTO_ESTIMATES_MINUTES['chapter-per'] ?? 6, Math.max(0, initialTotal - stepIdx * 5));
            let chapter = chs.find((c) => c.chapterNumber === outline.chapterNumber);
            if (!chapter) {
              const chId = await createChapter({
                projectId,
                chapterNumber: outline.chapterNumber,
                title: outline.title,
                beatReference: outline.beatReference,
                sceneGoal: outline.sceneGoal,
                pov: outline.pov,
              });
              await loadProject(projectId);
              chapter = useProjectStore.getState().chapters.find((c) => c.id === chId);
            }
            if (!chapter) continue;
            await loadChapterVersions(chapter.id);
            const chapterVersionsHere = useProjectStore.getState().chapterVersions.get(chapter.id) ?? [];
            const alreadyApproved = chapterVersionsHere.find((v) => v.approved);
            if (alreadyApproved) {
              if (alreadyApproved.notes?.trim()) {
                chapterSummaries.set(chapter.chapterNumber, {
                  title: chapter.title,
                  summary: alreadyApproved.notes.trim(),
                });
              }
              stepIdx++;
              continue;
            }
            const structureDoc = getDocumentByType('structure');
            const charactersDoc = getDocumentByType('characters');
            const endingDoc = getDocumentByType('ending');
            const genreDoc = getDocumentByType('genre');
            const nicheDoc = getDocumentByType('niche');
            const previousChapterSummaries = Array.from(chapterSummaries.entries())
              .sort(([a], [b]) => b - a)
              .map(([chapterNumber, data]) => ({
                chapterNumber,
                title: data.title,
                summary: data.summary,
              }));
            const contextState = useProjectStore.getState();
            const approvedChapterVersions = Array.from(contextState.chapterVersions.values())
              .flat()
              .filter((version) => version.approved);
            const assembledContext = assembleContext({
              purpose: 'chapter-draft',
              project: contextState.currentProject ?? project,
              documents: contextState.documents,
              chapters: contextState.chapters,
              approvedChapterVersions,
              currentChapter: chapter,
              targetChapterNumber: outline.chapterNumber,
            });
            if (assembledContext.warnings.length > 0) {
              console.warn('[FullAuto] Canon context warnings:', assembledContext.warnings);
            }

            let draftPlain: string;
            let segments: SceneProseSegment[] | undefined;

            if (FULL_AUTO_USE_SCENE_PIPELINE_DEFAULT) {
              const sceneAssembled = assembleContext({
                purpose: 'scene-plan',
                project: contextState.currentProject ?? project,
                documents: contextState.documents,
                chapters: contextState.chapters,
                approvedChapterVersions,
                currentChapter: chapter,
                targetChapterNumber: outline.chapterNumber,
              });
              if (sceneAssembled.warnings.length > 0) {
                console.warn('[FullAuto] Scene plan context warnings:', sceneAssembled.warnings);
              }
              const outlinesSourceJson = JSON.stringify({
                documentId: outlinesDoc.id,
                version: outlinesDoc.version,
                updatedAt: outlinesDoc.updatedAt.toISOString(),
              });
              const outlineSliceJson = JSON.stringify(outline);
              const scenePlanResult = await generateTracked('chapter-scene-plan', {
                genre: project.genre,
                chapterNumber: outline.chapterNumber,
                outlinesSourceJson,
                outlineSliceJson,
                assembledContext: sceneAssembled.text,
              });
              let parsedScenePlan;
              try {
                parsedScenePlan = parseChapterScenePlan(scenePlanResult.content).scenePlan;
              } catch (e) {
                throw new Error(
                  `Full Auto could not parse scene plan for chapter ${outline.chapterNumber}. ${e instanceof Error ? e.message : String(e)}`,
                );
              }
              const planDocs = contextState.documents.filter(
                (d) =>
                  d.projectId === projectId &&
                  d.type === 'chapter-scene-plan' &&
                  d.chapterNumber === outline.chapterNumber,
              );
              const planNextVersion = planDocs.reduce((m, d) => Math.max(m, d.version), 0) + 1;
              await createDocument({
                projectId,
                type: 'chapter-scene-plan',
                chapterNumber: outline.chapterNumber,
                content: scenePlanResult.content,
                version: planNextVersion,
                approved: false,
              });
              await loadProject(projectId);
              const sceneBullets = [...parsedScenePlan.scenes]
                .sort((a, b) => a.order - b.order)
                .slice(0, 6)
                .map((s, idx) => `Scene ${idx + 1}: ${s.purpose}`);
              await runCheckpoint(
                `after-chapter-${outline.chapterNumber}-scene-plan`,
                `Checkpoint: Chapter ${outline.chapterNumber} scene plan`,
                [
                  ...sceneBullets,
                  'Review beats and scene splits before prose is generated.',
                  'You can edit the scene plan from Write Chapters, then resume Full Auto.',
                ],
              );
              throwIfControlRequested();

              let chapterTitle = chapter.title;
              const wordTargetChapter = outline.wordTarget ?? 3000;
              if (outline.title) chapterTitle = outline.title;

              const orderedScenes = [...parsedScenePlan.scenes].sort((a, b) => a.order - b.order);
              const segmentList: SceneProseSegment[] = [];
              for (let si = 0; si < orderedScenes.length; si++) {
                throwIfControlRequested();
                const sceneCard = orderedScenes[si];
                const storeNow = useProjectStore.getState();
                const approvedNow = Array.from(storeNow.chapterVersions.values())
                  .flat()
                  .filter((version) => version.approved);
                const proseAssembled = assembleContext({
                  purpose: 'chapter-draft',
                  project: storeNow.currentProject ?? project,
                  documents: storeNow.documents,
                  chapters: storeNow.chapters,
                  approvedChapterVersions: approvedNow,
                  currentChapter: chapter,
                  targetChapterNumber: outline.chapterNumber,
                });
                const neighborBefore =
                  si > 0 ? segmentList[si - 1]?.prose.slice(0, 400) : undefined;
                const neighborAfter =
                  si < orderedScenes.length - 1
                    ? `${orderedScenes[si + 1].purpose} (${orderedScenes[si + 1].setting})`
                    : undefined;
                const wt =
                  sceneCard.estimatedWords ??
                  Math.max(400, Math.floor(wordTargetChapter / Math.max(orderedScenes.length, 1)));
                const proseResult = await generateTracked('chapter-scenes-prose', {
                  genre: project.genre,
                  chapterNumber: outline.chapterNumber,
                  chapterTitle,
                  sceneCard,
                  assembledContext: proseAssembled.text,
                  neighborSummaryBefore: neighborBefore,
                  neighborSummaryAfter: neighborAfter,
                  wordTarget: wt,
                });
                const prosePayload = JSON.parse(proseResult.content) as { sceneId: string; prose: string };
                segmentList.push({ sceneId: prosePayload.sceneId, prose: prosePayload.prose });
              }

              let concatenated = segmentList.map((s) => s.prose).join('\n\n');

              if (CHAPTER_POLISH_FEATURE_ENABLED) {
                const storePolish = useProjectStore.getState();
                const approvedPolish = Array.from(storePolish.chapterVersions.values())
                  .flat()
                  .filter((version) => version.approved);
                const polishAssembled = assembleContext({
                  purpose: 'chapter-draft',
                  project: storePolish.currentProject ?? project,
                  documents: storePolish.documents,
                  chapters: storePolish.chapters,
                  approvedChapterVersions: approvedPolish,
                  currentChapter: chapter,
                  targetChapterNumber: outline.chapterNumber,
                });
                const polishResult = await generateTracked('chapter-polish', {
                  genre: project.genre,
                  chapterNumber: outline.chapterNumber,
                  chapterTitle,
                  concatenatedDraft: concatenated,
                  assembledContext: polishAssembled.text,
                });
                concatenated = polishResult.content.trim();
              }

              const storeEval = useProjectStore.getState();
              const approvedEval = Array.from(storeEval.chapterVersions.values())
                .flat()
                .filter((version) => version.approved);
              const mergedEvalGenerate = (stage: WorkflowStage, data: Record<string, unknown>) =>
                generateTracked(stage, data);
              const evaluation = await runMergedChapterSceneEvaluation({
                generate: mergedEvalGenerate,
                project: storeEval.currentProject ?? project,
                documents: storeEval.documents,
                chapters: storeEval.chapters,
                approvedChapterVersions: approvedEval,
                currentChapter: chapter,
                scenePlan: parsedScenePlan,
                segments: segmentList,
                chapterTitle,
                outlineWordTarget: outline.wordTarget,
              });
              if (evaluation.checks.some((c) => c.severity === 'fail' && !c.pass)) {
                console.warn(
                  `[FullAuto] Chapter ${outline.chapterNumber} evaluation reported failing checks; proceeding with approval.`,
                  evaluation.checks.filter((c) => c.severity === 'fail' && !c.pass),
                );
              }

              draftPlain = concatenated;
              segments = segmentList;
            } else {
              const chapterResult = await generateTracked('chapters', {
                genre: project.genre,
                chapterNumber: outline.chapterNumber,
                chapterTitle: outline.title,
                beatReference: outline.beatReference,
                sceneGoal: outline.sceneGoal,
                pov: outline.pov,
                assembledContext: assembledContext.text,
                charactersReference: charactersDoc?.content || '',
                endingReference: endingDoc?.content || '',
                previousChapterSummaries,
                structureContext: structureDoc?.content || '',
                genreResearch: genreDoc?.content || '',
                nicheReference: nicheDoc?.content || '',
                wordTarget: outline.wordTarget || 3000,
              });
              draftPlain = chapterResult.content;
              segments = undefined;
            }

            const chapterSummaryResult = await generateTracked('chapter-summary', {
              genre: project.genre,
              chapterNumber: chapter.chapterNumber,
              chapterTitle: chapter.title,
              chapterContent: draftPlain,
            });
            const chapterSummary = chapterSummaryResult.content.trim();
            const latestVer = getLatestChapterVersion(chapter.id);
            const newVer = (latestVer?.version || 0) + 1;
            const versionPayload: Omit<ChapterVersion, 'id' | 'createdAt'> = {
              chapterId: chapter.id,
              projectId,
              chapterNumber: chapter.chapterNumber,
              version: newVer,
              content: draftPlain,
              wordCount: countWords(draftPlain),
              approved: false,
              notes: chapterSummary,
              ...(latestVer?.id ? { parentVersionId: latestVer.id } : {}),
            };
            if (segments && segments.length > 0) versionPayload.sceneSegments = segments;
            const versionId = await createChapterVersion(versionPayload);
            await approveChapterVersion(versionId);
            chapterSummaries.set(chapter.chapterNumber, {
              title: chapter.title,
              summary: chapterSummary,
            });
            stepIdx++;
            throwIfControlRequested();
            if (outline.chapterNumber === 1) {
              await runCheckpoint('after-first-chapter', 'Checkpoint: first chapter approved', [
                'Read Chapter 1 for voice, POV, and tone.',
                'If the sample is wrong, pause Full Auto and fix before later chapters.',
              ]);
            }
          }
          const next = getNextStage('chapters');
          if (next) await advanceStage(projectId, next as WorkflowStage);
          currentStage = (next || currentStage) as WorkflowStage;
          await loadProject(projectId);
          }
        }
        // Compilation, export-draft: advance only
        if (currentStage === 'compilation') {
          throwIfControlRequested();
          setStep(STAGE_NAMES['compilation'], stepIdx, 20, 0, 0);
          await advanceStage(projectId, 'export-draft');
          currentStage = 'export-draft';
          stepIdx++;
        }
        if (currentStage === 'export-draft') {
          throwIfControlRequested();
          setStep(STAGE_NAMES['export-draft'], stepIdx, 20, 0, 0);
          await advanceStage(projectId, 'editorial');
          currentStage = 'editorial';
          stepIdx++;
        }
        // Editorial + revision: five passes (structural → line → copy → proofread → final_report); final_report is analyze + stub tasks only
        if (currentStage === 'editorial') {
          throwIfControlRequested();
          await loadProject(projectId);
          const editorialChapters = useProjectStore.getState().chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);

          const compileManuscriptFromStore = async (): Promise<string> => {
            await Promise.all(editorialChapters.map((ch) => loadChapterVersions(ch.id)));
            const chapterVersionsMap = useProjectStore.getState().chapterVersions;
            return editorialChapters
              .map((ch) => {
                const versions = chapterVersionsMap.get(ch.id) || [];
                const approved = versions.find((v) => v.approved);
                return approved ? `## Chapter ${ch.chapterNumber}: ${ch.title}\n\n${htmlToEditorialText(approved.content)}` : '';
              })
              .filter(Boolean)
              .join('\n\n');
          };

          for (const pass of EDITORIAL_PASSES as EditorialPass[]) {
            throwIfControlRequested();
            const manuscript = await compileManuscriptFromStore();
            if (!manuscript.trim()) {
              throw new Error('No manuscript available. Approved chapter content could not be loaded. Try opening Write Chapters, then resume Full Auto.');
            }
            await loadProject(projectId);
            const editorialStore = useProjectStore.getState();
            const editorialProject = editorialStore.currentProject;
            if (!editorialProject) {
              throw new Error('Project not loaded for editorial stage.');
            }
            const projDocs = editorialStore.documents.filter((d) => d.projectId === projectId);
            const pickDoc = (t: DocumentType) =>
              projDocs.filter((d) => d.type === t && d.approved).sort((a, b) => b.version - a.version)[0];
            const nicheDoc = pickDoc('niche');
            const charactersDoc = pickDoc('characters');
            const endingDoc = pickDoc('ending');
            const structureDoc = pickDoc('structure');
            const audienceParts = [editorialProject.niche, editorialProject.microniche].filter(Boolean) as string[];
            const intendedAudience = audienceParts.length > 0 ? audienceParts.join(' · ') : undefined;
            const editorialApprovedVersions = Array.from(editorialStore.chapterVersions.values())
              .flat()
              .filter((version) => version.approved);
            const editorialContext = assembleContext({
              purpose: 'editorial',
              project: editorialProject,
              documents: projDocs,
              chapters: editorialStore.chapters,
              approvedChapterVersions: editorialApprovedVersions,
              editorialPass: pass,
            });

            setStep(`Editorial: ${pass}`, stepIdx, 20, FULL_AUTO_ESTIMATES_MINUTES['editorial'] ?? 5, 0);
            let editorialResult;
            try {
              editorialResult = await generateTracked('editorial', {
                manuscript,
                genre: editorialProject.genre,
                chapterCount: useProjectStore.getState().chapters.length,
                editorialPass: pass,
                assembledContext: editorialContext.text,
                nicheReference: nicheDoc?.content,
                charactersReference: charactersDoc?.content,
                endingReference: endingDoc?.content,
                structureReference: structureDoc?.content,
                intendedAudience,
                premise: editorialProject.premise,
                research: editorialProject.research,
              });
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Unknown error';
              throw new Error(`Editorial analysis failed (${pass}): ${msg}`);
            }
            const docType = documentTypeForEditorialPass(pass);
            await loadProject(projectId);
            const docsOfType = useProjectStore.getState().documents
              .filter((d) => d.projectId === projectId && d.type === docType)
              .sort((a, b) => b.version - a.version);
            const latestPassDoc = docsOfType[0];
            let editorialDocId: string;
            if (latestPassDoc) {
              await updateDocument(latestPassDoc.id, {
                content: editorialResult.content,
                version: latestPassDoc.version + 1,
              });
              editorialDocId = latestPassDoc.id;
            } else {
              editorialDocId = await createDocument({
                projectId,
                type: docType,
                content: editorialResult.content,
                version: 1,
                approved: false,
              });
            }
            await approveDocument(editorialDocId);
            await deleteRevisionTasksForProjectAndPass(projectId, pass);

            if (pass === 'final_report') {
              for (const ch of editorialChapters) {
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
              await loadRevisionTasks(projectId);
              continue;
            }

            let queueResult;
            try {
              queueResult = await generateTracked('editorial', {
                createQueue: true,
                editorialReport: editorialResult.content,
                chapterCount: useProjectStore.getState().chapters.length,
                editorialPass: pass,
              });
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Unknown error';
              throw new Error(`Revision queue generation failed (${pass}): ${msg}`);
            }
            let revisionQueueData;
            try {
              revisionQueueData = parseRevisionQueue(queueResult.content);
            } catch {
              throw new Error(`Revision queue was not valid JSON (${pass}).`);
            }
            await persistRevisionQueueFromParsed(projectId, pass, revisionQueueData.revisionTasks);
            await useProjectStore.getState().loadEditorialIssues(projectId);
            await loadRevisionTasks(projectId);
            const tasksThisPass = useProjectStore.getState().revisionTasks.filter(
              (t) => t.editPass === pass && t.status !== 'done'
            );
            for (const task of tasksThisPass) {
              throwIfControlRequested();
              setStep(`Revision (${pass}): Ch. ${task.chapterNumber}`, stepIdx, 20, FULL_AUTO_ESTIMATES_MINUTES['revision-per'] ?? 3, 0);
              const chapter = useProjectStore.getState().chapters.find((c) => c.chapterNumber === task.chapterNumber);
              const versions = chapter ? useProjectStore.getState().chapterVersions.get(chapter.id) || [] : [];
              const originalVersion = versions.find((v) => v.approved);
              if (!chapter || !originalVersion) {
                await updateRevisionTask(task.id, { status: 'done' });
                continue;
              }
              await updateRevisionTask(task.id, { status: 'in_progress' });
              const docs = useProjectStore.getState().documents;
              const pick = (t: DocumentType) => docs.filter((d) => d.type === t && d.approved).sort((a, b) => b.version - a.version)[0];
              const charactersDoc = pick('characters');
              const endingDoc = pick('ending');
              const structureDoc = pick('structure');
              const nicheDoc = pick('niche');
              const orderedChapters = [...useProjectStore.getState().chapters].sort((a, b) => a.chapterNumber - b.chapterNumber);
              const chapterIndex = orderedChapters.findIndex((c) => c.id === chapter.id);
              const prevChapter = chapterIndex > 0 ? orderedChapters[chapterIndex - 1] : undefined;
              const nextChapter =
                chapterIndex >= 0 && chapterIndex < orderedChapters.length - 1
                  ? orderedChapters[chapterIndex + 1]
                  : undefined;
              const prevApproved = prevChapter
                ? (useProjectStore.getState().chapterVersions.get(prevChapter.id) || []).find((v) => v.approved)
                : undefined;
              const nextApproved = nextChapter
                ? (useProjectStore.getState().chapterVersions.get(nextChapter.id) || []).find((v) => v.approved)
                : undefined;
              const revisionState = useProjectStore.getState();
              const revisionApprovedVersions = Array.from(revisionState.chapterVersions.values())
                .flat()
                .filter((version) => version.approved);
              const revisionContext = assembleContext({
                purpose: 'chapter-revision',
                project: revisionState.currentProject ?? project,
                documents: revisionState.documents,
                chapters: revisionState.chapters,
                approvedChapterVersions: revisionApprovedVersions,
                currentChapter: chapter,
                targetChapterNumber: chapter.chapterNumber,
                revisionInstructions: task.instructions,
                editorialPass: pass,
              });
              const issues =
                task.issueIds.length > 0
                  ? await firestore.getEditorialIssuesByIds(task.issueIds)
                  : [];
              let sceneScoped = false;
              let activeSceneId: string | undefined;
              const segs = originalVersion.sceneSegments;
              if (segs?.length && issues.length > 0) {
                const sceneIds = issues.map((i) => i.sceneId).filter((x): x is string => !!x?.trim());
                if (sceneIds.length > 0 && sceneIds.every((id) => id === sceneIds[0])) {
                  const cand = sceneIds[0]!;
                  if (segs.some((s) => s.sceneId === cand)) {
                    sceneScoped = true;
                    activeSceneId = cand;
                  }
                }
              }
              const originalContentForModel =
                sceneScoped && activeSceneId && segs
                  ? (segs.find((s) => s.sceneId === activeSceneId)?.prose ?? originalVersion.content)
                  : originalVersion.content;

              const revResult = await generateTracked(
                'revision',
                {
                  genre: project.genre,
                  chapterNumber: chapter.chapterNumber,
                  chapterTitle: chapter.title,
                  originalContent: originalContentForModel,
                  revisionInstructions: task.instructions,
                  acceptanceCriteria: task.acceptanceCriteria?.length ? task.acceptanceCriteria : ['Consistency with canon'],
                  assembledContext: revisionContext.text,
                  charactersReference: charactersDoc?.content || '',
                  endingReference: endingDoc?.content || '',
                  structureReference: structureDoc?.content || '',
                  nicheReference: nicheDoc?.content || '',
                  previousChapterContext: prevApproved ? chapterSnapshot(prevApproved.content) : undefined,
                  nextChapterContext: nextApproved ? chapterSnapshot(nextApproved.content) : undefined,
                  editorialPass: pass,
                  ...(sceneScoped && activeSceneId ? { sceneRevisionSceneId: activeSceneId } : {}),
                },
                { model: getEffectiveModelForStage('revision').id }
              );
              if (!revResult.content?.trim()) {
                throw new Error(`Empty revision for chapter ${chapter.chapterNumber}`);
              }
              let revisedFull = revResult.content;
              let newSceneSegments: typeof originalVersion.sceneSegments = undefined;
              if (sceneScoped && activeSceneId && segs) {
                const spliced = spliceSceneIntoChapter(segs, activeSceneId, revResult.content.trim());
                revisedFull = spliced.content;
                newSceneSegments = spliced.segments;
              }
              const verifyExcerpt = sceneScoped ? revResult.content.trim() : revisedFull;

              const revisionSummaryResult = await generateTracked('chapter-summary', {
                genre: project.genre,
                chapterNumber: chapter.chapterNumber,
                chapterTitle: chapter.title,
                chapterContent: revisedFull,
              });
              const sorted = [...versions].sort((a, b) => b.version - a.version);
              const newVer = (sorted[0]?.version || 0) + 1;
              const versionId = await createChapterVersion({
                chapterId: chapter.id,
                projectId,
                chapterNumber: chapter.chapterNumber,
                version: newVer,
                content: revisedFull,
                wordCount: countWords(revisedFull),
                approved: false,
                notes: revisionSummaryResult.content.trim(),
                ...(newSceneSegments ? { sceneSegments: newSceneSegments } : {}),
              });
              const verifyRes = await generateTracked(
                'revision-verify',
                {
                  revisedContent: verifyExcerpt,
                  instructions: task.instructions,
                  issueDescriptions: issues.map((i) => i.description),
                },
                { model: getEffectiveModelForStage('revision-verify').id }
              );
              const verificationResult = parseRevisionVerification(verifyRes.content);
              if (verificationResult.satisfied) {
                await approveChapterVersion(versionId);
                for (const id of task.issueIds) {
                  await firestore.updateEditorialIssue(id, { status: 'resolved' });
                }
                await updateRevisionTask(task.id, { status: 'done' });
              } else {
                console.warn(
                  `[Full Auto] Verification failed (chapter ${task.chapterNumber}, pass ${pass}):`,
                  verificationResult.checklist,
                );
                setFullAutoRunWarnings((prev) => [
                  ...prev,
                  `Chapter ${task.chapterNumber} (${pass}): revision saved as draft; verification did not pass. Check console for checklist.`,
                ]);
                await updateRevisionTask(task.id, { status: 'queued' });
              }
              await loadChapterVersions(chapter.id);
              await useProjectStore.getState().loadEditorialIssues(projectId);
              stepIdx++;
              throwIfControlRequested();
            }
          }
          await advanceStage(projectId, 'revision');
          currentStage = 'revision';
          stepIdx++;
          await loadProject(projectId);
          await loadRevisionTasks(projectId);
        }
        // Any remaining revision tasks (e.g. resumed mid-pipeline)
        const tasks = useProjectStore.getState().revisionTasks.filter((t) => t.status !== 'done');
        for (const task of tasks) {
          throwIfControlRequested();
          setStep(`Revision: Chapter ${task.chapterNumber}`, stepIdx, 20, FULL_AUTO_ESTIMATES_MINUTES['revision-per'] ?? 3, 0);
          const chapter = useProjectStore.getState().chapters.find((c) => c.chapterNumber === task.chapterNumber);
          const versions = chapter ? useProjectStore.getState().chapterVersions.get(chapter.id) || [] : [];
          const originalVersion = versions.find((v) => v.approved);
          if (!chapter || !originalVersion) {
            await updateRevisionTask(task.id, { status: 'done' });
            continue;
          }
          await updateRevisionTask(task.id, { status: 'in_progress' });
          const docs = useProjectStore.getState().documents;
          const pick = (t: DocumentType) => docs.filter((d) => d.type === t && d.approved).sort((a, b) => b.version - a.version)[0];
          const charactersDoc = pick('characters');
          const endingDoc = pick('ending');
          const structureDoc = pick('structure');
          const nicheDoc = pick('niche');
          const pass = task.editPass;
          const orderedChapters = [...useProjectStore.getState().chapters].sort((a, b) => a.chapterNumber - b.chapterNumber);
          const chapterIndex = orderedChapters.findIndex((c) => c.id === chapter.id);
          const prevChapter = chapterIndex > 0 ? orderedChapters[chapterIndex - 1] : undefined;
          const nextChapter =
            chapterIndex >= 0 && chapterIndex < orderedChapters.length - 1
              ? orderedChapters[chapterIndex + 1]
              : undefined;
          const prevApproved = prevChapter
            ? (useProjectStore.getState().chapterVersions.get(prevChapter.id) || []).find((v) => v.approved)
            : undefined;
          const nextApproved = nextChapter
            ? (useProjectStore.getState().chapterVersions.get(nextChapter.id) || []).find((v) => v.approved)
            : undefined;
          const revisionState = useProjectStore.getState();
          const revisionApprovedVersions = Array.from(revisionState.chapterVersions.values())
            .flat()
            .filter((version) => version.approved);
          const revisionContext = assembleContext({
            purpose: 'chapter-revision',
            project: revisionState.currentProject ?? project,
            documents: revisionState.documents,
            chapters: revisionState.chapters,
            approvedChapterVersions: revisionApprovedVersions,
            currentChapter: chapter,
            targetChapterNumber: chapter.chapterNumber,
            revisionInstructions: task.instructions,
            editorialPass: pass,
          });
          const issues =
            task.issueIds.length > 0
              ? await firestore.getEditorialIssuesByIds(task.issueIds)
              : [];
          let sceneScoped = false;
          let activeSceneId: string | undefined;
          const segs = originalVersion.sceneSegments;
          if (segs?.length && issues.length > 0) {
            const sceneIds = issues.map((i) => i.sceneId).filter((x): x is string => !!x?.trim());
            if (sceneIds.length > 0 && sceneIds.every((id) => id === sceneIds[0])) {
              const cand = sceneIds[0]!;
              if (segs.some((s) => s.sceneId === cand)) {
                sceneScoped = true;
                activeSceneId = cand;
              }
            }
          }
          const originalContentForModel =
            sceneScoped && activeSceneId && segs
              ? (segs.find((s) => s.sceneId === activeSceneId)?.prose ?? originalVersion.content)
              : originalVersion.content;

          const revResult = await generateTracked(
            'revision',
            {
              genre: project.genre,
              chapterNumber: chapter.chapterNumber,
              chapterTitle: chapter.title,
              originalContent: originalContentForModel,
              revisionInstructions: task.instructions,
              acceptanceCriteria: task.acceptanceCriteria?.length ? task.acceptanceCriteria : ['Consistency with canon'],
              assembledContext: revisionContext.text,
              charactersReference: charactersDoc?.content || '',
              endingReference: endingDoc?.content || '',
              structureReference: structureDoc?.content || '',
              nicheReference: nicheDoc?.content || '',
              previousChapterContext: prevApproved ? chapterSnapshot(prevApproved.content) : undefined,
              nextChapterContext: nextApproved ? chapterSnapshot(nextApproved.content) : undefined,
              editorialPass: pass,
              ...(sceneScoped && activeSceneId ? { sceneRevisionSceneId: activeSceneId } : {}),
            },
            { model: getEffectiveModelForStage('revision').id }
          );
          if (!revResult.content?.trim()) {
            throw new Error(`Empty revision for chapter ${chapter.chapterNumber}`);
          }
          let revisedFull = revResult.content;
          let newSceneSegments: typeof originalVersion.sceneSegments = undefined;
          if (sceneScoped && activeSceneId && segs) {
            const spliced = spliceSceneIntoChapter(segs, activeSceneId, revResult.content.trim());
            revisedFull = spliced.content;
            newSceneSegments = spliced.segments;
          }
          const verifyExcerpt = sceneScoped ? revResult.content.trim() : revisedFull;

          const revisionSummaryResult = await generateTracked('chapter-summary', {
            genre: project.genre,
            chapterNumber: chapter.chapterNumber,
            chapterTitle: chapter.title,
            chapterContent: revisedFull,
          });
          const sorted = [...versions].sort((a, b) => b.version - a.version);
          const newVer = (sorted[0]?.version || 0) + 1;
          const versionId = await createChapterVersion({
            chapterId: chapter.id,
            projectId,
            chapterNumber: chapter.chapterNumber,
            version: newVer,
            content: revisedFull,
            wordCount: countWords(revisedFull),
            approved: false,
            notes: revisionSummaryResult.content.trim(),
            ...(newSceneSegments ? { sceneSegments: newSceneSegments } : {}),
          });
          const verifyRes = await generateTracked(
            'revision-verify',
            {
              revisedContent: verifyExcerpt,
              instructions: task.instructions,
              issueDescriptions: issues.map((i) => i.description),
            },
            { model: getEffectiveModelForStage('revision-verify').id }
          );
          const verificationResult = parseRevisionVerification(verifyRes.content);
          if (verificationResult.satisfied) {
            await approveChapterVersion(versionId);
            for (const id of task.issueIds) {
              await firestore.updateEditorialIssue(id, { status: 'resolved' });
            }
            await updateRevisionTask(task.id, { status: 'done' });
          } else {
            console.warn(
              `[Full Auto] Verification failed (chapter ${task.chapterNumber}, pass ${pass}):`,
              verificationResult.checklist,
            );
            setFullAutoRunWarnings((prev) => [
              ...prev,
              `Chapter ${task.chapterNumber} (${pass}): revision saved as draft; verification did not pass. Check console for checklist.`,
            ]);
            await updateRevisionTask(task.id, { status: 'queued' });
          }
          await loadChapterVersions(chapter.id);
          await useProjectStore.getState().loadEditorialIssues(projectId);
          stepIdx++;
          throwIfControlRequested();
        }
        if (currentStage === 'revision') {
          await advanceStage(projectId, 'export-final');
          currentStage = 'export-final';
        }
        // Export-final: advance (no-op for data)
        if (currentStage === 'export-final') {
          setStep(STAGE_NAMES['export-final'], stepIdx, 20, 0, 0);
          stepIdx++;
        }
        // Blurb (use latest project for title etc.)
        await loadProject(projectId);
        const projForMarketing = useProjectStore.getState().currentProject ?? project;
        setStep('Blurb', stepIdx, 20, FULL_AUTO_ESTIMATES_MINUTES['blurb'] ?? 1, 0);
        const genreDoc = getDocumentByType('genre');
        const nicheDoc = getDocumentByType('niche');
        const structureDoc = getDocumentByType('structure');
        const blurbResult = await generateTracked('blurb', {
          genre: projForMarketing.genre,
          niche: projForMarketing.niche,
          title: projForMarketing.title,
          premise: projForMarketing.premise,
          marketAnalysis: genreDoc?.content,
          readerTargeting: nicheDoc?.content,
          plotBlueprint: structureDoc?.content,
        });
        await updateProject(projectId, { blurb: blurbResult.content });
        stepIdx++;
        throwIfControlRequested();
        // Amazon description
        setStep('Amazon Description', stepIdx, 20, FULL_AUTO_ESTIMATES_MINUTES['amazon-description'] ?? 1, 0);
        const amazonResult = await generateTracked('amazon-description', {
          genre: projForMarketing.genre,
          niche: projForMarketing.niche,
          title: projForMarketing.title,
          premise: projForMarketing.premise,
          marketAnalysis: genreDoc?.content,
          readerTargeting: nicheDoc?.content,
          plotBlueprint: structureDoc?.content,
          blurb: blurbResult.content,
        });
        await updateProject(projectId, { amazonDescription: amazonResult.content });
        await updateProject(projectId, { fullAutoMode: false });
        clearFullAutoRunMarkers(projectId);
        setOverlayStatus('complete');
        setCurrentStepLabel('Complete');
        setTimeLeftThisStep(0);
        setTimeLeftTotal(0);
        setTimeout(() => router.replace(`/projects/${projectId}`), 1500);
      } catch (err) {
        if (err instanceof AutoControlError) {
          if (err.action === 'stop') {
            await updateProject(projectId, { fullAutoMode: false });
            clearFullAutoCheckpointPending(projectId);
            setCurrentStepLabel('Stopped');
          } else {
            setCurrentStepLabel('Paused');
          }
          setOverlayStatus('complete');
          setTimeLeftThisStep(0);
          setTimeLeftTotal(0);
          setTimeout(() => router.replace(`/projects/${projectId}`), 500);
          return;
        }
        const message = err instanceof Error ? err.message : 'Something went wrong';
        setError(message);
        setOverlayStatus('error');
      }
    };

    run();
  }, [
    projectLoading,
    project,
    projectId,
    overlayStatus,
    advanceStage,
    createDocument,
    updateDocument,
    approveDocument,
    generate,
    getDocumentByType,
    getLatestDocumentByType,
    getApprovedChapterVersion,
    getChapterVersions,
    getLatestChapterVersion,
    loadProject,
    loadChapterVersions,
    loadRevisionTasks,
    createChapter,
    createChapterVersion,
    approveChapterVersion,
    createRevisionTask,
    updateRevisionTask,
    deleteRevisionTasksForProjectAndPass,
    updateProject,
    clearError,
    retryTrigger,
  ]);

  // Only show loading spinner when idle and project not ready; once pipeline is running, never switch to spinner (avoids flash when loadProject sets loading: true)
  if (overlayStatus === 'idle' && (projectLoading || !project)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height))]">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 border-4 border-[var(--border)] border-t-[var(--accent)] rounded-full"
            style={{ animation: 'spin 1s linear infinite', willChange: 'transform' }}
          />
          <p className="text-[var(--muted-foreground)]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: 'calc(100vh - var(--header-height))' }}>
      {/* Blocking overlay - own layer to avoid flicker when page re-renders (e.g. store updates) */}
      <div
        key="full-auto-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          transform: 'translateZ(0)',
          willChange: 'transform',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '2.5rem',
            maxWidth: '480px',
            width: '100%',
            textAlign: 'center',
            minHeight: '200px',
          }}
        >
          {overlayStatus === 'idle' && (
            <p style={{ fontSize: '0.9375rem', color: 'var(--muted-foreground)' }}>Starting Full Auto...</p>
          )}
          {overlayStatus === 'running' && (
            <>
              <FullAutoSpinner />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--foreground)' }}>
                Full Auto Mode
              </h2>
              {preflightHint && (
                <>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginBottom: '0.75rem' }}>
                    Preflight estimate (order-of-magnitude, includes prompt overhead):{' '}
                    <strong style={{ color: 'var(--foreground)' }}>{preflightHint}</strong>
                  </p>
                  <AnthropicDraftLegCostHint
                    chapterCount={fullAutoCostChapterCount}
                    useScenePipeline={FULL_AUTO_USE_SCENE_PIPELINE_DEFAULT}
                    polishEnabled={CHAPTER_POLISH_FEATURE_ENABLED}
                    className="!mt-0 mb-3 text-left max-w-[420px] mx-auto [&_strong]:text-[var(--foreground)]"
                  />
                </>
              )}
              <p style={{ fontSize: '0.9375rem', color: 'var(--muted-foreground)', marginBottom: '1rem' }}>
                {currentStepLabel}
              </p>
              {totalSteps > 0 && (
                <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>
                  Step {stepIndex + 1} of ~{totalSteps}
                </p>
              )}
              {timeLeftThisStep > 0 && (
                <p style={{ fontSize: '0.875rem', color: 'var(--foreground)' }}>
                  ~{timeLeftThisStep} min left for this step
                </p>
              )}
              {timeLeftTotal > 0 && (
                <p style={{ fontSize: '0.875rem', color: 'var(--foreground)', marginTop: '0.25rem' }}>
                  ~{timeLeftTotal} min left total
                </p>
              )}
              {fullAutoUsageSession.runTotal > 0 && (
                <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginTop: '0.75rem' }}>
                  This run: ~{fullAutoUsageSession.runTotal.toLocaleString()} tokens
                  {fullAutoUsageSession.lastStep > 0 && (
                    <> · Last step: ~{fullAutoUsageSession.lastStep.toLocaleString()}</>
                  )}
                </p>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
                <Button
                  variant="secondary"
                  onClick={requestPause}
                  disabled={controlActionPending !== 'none'}
                >
                  {controlActionPending === 'pause' ? 'Pausing...' : 'Pause'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={requestStop}
                  disabled={controlActionPending !== 'none'}
                >
                  {controlActionPending === 'stop' ? 'Stopping...' : 'Stop'}
                </Button>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--destructive)', marginTop: '1.5rem', fontWeight: 500 }}>
                Pause or stop takes effect after the current in-flight step completes.
              </p>
            </>
          )}
          {overlayStatus === 'checkpoint' && checkpointGate && (
            <>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--foreground)' }}>
                {checkpointGate.title}
              </h2>
              <ul
                style={{
                  textAlign: 'left',
                  fontSize: '0.875rem',
                  color: 'var(--muted-foreground)',
                  marginBottom: '1.25rem',
                  paddingLeft: '1.25rem',
                }}
              >
                {checkpointGate.bullets.map((b) => (
                  <li key={b} style={{ marginBottom: '0.35rem' }}>
                    {b}
                  </li>
                ))}
              </ul>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
                <Button
                  onClick={() => {
                    checkpointGate.resolve();
                  }}
                >
                  Continue Full Auto
                </Button>
                <Link
                  href={`/projects/${projectId}`}
                  onClick={() => clearFullAutoCheckpointPending(projectId)}
                  style={{ fontSize: '0.875rem', color: 'var(--accent)' }}
                >
                  Exit to project hub
                </Link>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '1rem' }}>
                If you refresh while this gate is open, Full Auto opens the same checkpoint so you can continue.
                Closing the tab mid-step elsewhere may still leave work incomplete until you resume.
              </p>
            </>
          )}
          {overlayStatus === 'complete' && (
            <>
              <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--foreground)' }}>Complete</p>
              {fullAutoRunWarnings.length > 0 && (
                <div
                  style={{
                    textAlign: 'left',
                    marginTop: '1rem',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    background: 'rgba(212, 160, 58, 0.15)',
                    border: '1px solid rgba(212, 160, 58, 0.5)',
                    maxHeight: '200px',
                    overflowY: 'auto',
                  }}
                >
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.5rem' }}>
                    Revision warnings
                  </p>
                  <ul style={{ fontSize: '0.8125rem', color: 'var(--foreground)', paddingLeft: '1.25rem', margin: 0 }}>
                    {fullAutoRunWarnings.map((w, i) => (
                      <li key={i} style={{ marginBottom: '0.35rem' }}>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginTop: '0.5rem' }}>
                Redirecting to project...
              </p>
            </>
          )}
          {overlayStatus === 'error' && (
            <>
              <p style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--destructive)', marginBottom: '0.75rem' }}>
                Something went wrong
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '1.5rem' }}>
                {error}
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setError(null);
                    setOverlayStatus('idle');
                    pipelineStarted.current = false;
                    setRetryTrigger((n) => n + 1);
                  }}
                >
                  Retry
                </Button>
                <Link href={`/projects/${projectId}`}>
                  <Button variant="secondary">Stop and continue manually</Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
