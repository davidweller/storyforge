'use client';

import { use, useState, useEffect, useRef, useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProject } from '@/hooks/useProject';
import { useGenerate } from '@/hooks/useGenerate';
import { useProjectStore } from '@/stores/projectStore';
import { getNextStage, STAGE_ORDER, STAGE_NAMES } from '@/lib/utils';
import { getEstimatedMinutesForStep, FULL_AUTO_ESTIMATES_MINUTES } from '@/lib/fullAutoEstimates';
import { Button } from '@/components/ui';
import type { WorkflowStage, DocumentType, EditorialPass } from '@/types';
import { countWords, capOutlineWordTargets } from '@/lib/utils';
import { EDITORIAL_PASSES, documentTypeForEditorialPass } from '@/lib/editorial/passes';
import { TARGET_MANUSCRIPT_WORDS } from '@/lib/constants';
import { getEffectiveModelForStage } from '@/lib/data/models';
import { htmlToEditorialText } from '@/lib/utils/markdown';

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

// --- Parsing helpers (mirrored from stage pages) ---
interface EndingConcept {
  id: string;
  title: string;
  summary: string;
  emotionalPayoff: string;
  characterResolution: string;
  thematicStatement: string;
}

function parseEndingConcepts(content: string): EndingConcept[] {
  const concepts: EndingConcept[] = [];
  const sections = content.split(/(?=\d+\.\s)/).filter((s) => s.trim());
  if (sections.length <= 1) return concepts;
  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed || !/^\d+\.\s/.test(trimmed)) continue;
    const titleMatch = trimmed.match(/\*\*([^*]+)\*\*/);
    const firstLine = trimmed.split(/\n/)[0]?.replace(/^\d+\.\s*/, '').trim() || '';
    const title = titleMatch ? titleMatch[1].trim() : (firstLine || trimmed.slice(0, 80));
    if (!title) continue;
    const summaryMatch = trimmed.match(/Summary[:\s]*([^\n]+(?:\n(?!\d+\.\s|\*\*)[^\n]+)*)/i);
    const emotionalMatch = trimmed.match(/Emotional[^:]*[:\s]*([^\n]+)/i);
    const characterMatch = trimmed.match(/Character[^:]*[:\s]*([^\n]+)/i);
    const thematicMatch = trimmed.match(/Thematic[^:]*[:\s]*([^\n]+)/i);
    concepts.push({
      id: `ending-${concepts.length + 1}`,
      title,
      summary: summaryMatch?.[1]?.trim() || trimmed.slice(title.length, 200 + title.length).trim() || trimmed.slice(0, 200),
      emotionalPayoff: emotionalMatch?.[1]?.trim() || '',
      characterResolution: characterMatch?.[1]?.trim() || '',
      thematicStatement: thematicMatch?.[1]?.trim() || '',
    });
  }
  return concepts;
}

function parseTitleOptions(content: string): string[] {
  if (!content?.trim()) return [];
  return content
    .split(/\n/)
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, '').replace(/^[-*]\s*/, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, 15);
}

interface ChapterOutline {
  chapterNumber: number;
  title: string;
  beatReference: string;
  sceneGoal: string;
  pov?: string;
  wordTarget?: number;
}

function parseChapterOutlines(content: string): ChapterOutline[] {
  const outlines: ChapterOutline[] = [];
  // Prefer strict format: **Chapter N: Title**; fallback: line starting with Chapter N: (with or without **)
  const strictRegex = /\*\*Chapter\s+(\d+):\s*(.+?)\*\*/g;
  const lenientRegex = /^#{0,3}\s*\*{0,2}Chapter\s+(\d+):\s*(.+?)(?:\*{2})?\s*$/gm;
  const matches: Array<{ index: number; number: number; title: string; endIndex: number }> = [];
  let match;
  while ((match = strictRegex.exec(content)) !== null) {
    matches.push({
      index: match.index,
      number: parseInt(match[1], 10),
      title: (match[2]?.trim() || '').replace(/\*+$/, ''),
      endIndex: match.index + match[0].length,
    });
  }
  if (matches.length === 0) {
    while ((match = lenientRegex.exec(content)) !== null) {
      matches.push({
        index: match.index,
        number: parseInt(match[1], 10),
        title: (match[2]?.trim() || '').replace(/\*+$/, ''),
        endIndex: match.index + match[0].length,
      });
    }
  }
  // Sort by index so we can slice content between chapters
  matches.sort((a, b) => a.index - b.index);
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const startIndex = current.endIndex;
    const endIndex = next ? next.index : content.length;
    const chapterContent = content.substring(startIndex, endIndex);
    if (isNaN(current.number)) continue;
    // Allow **Label**: or - **Label**: or Label:
    const beatMatch = chapterContent.match(/(?:^[-*]\s*)?\*{0,2}Story Beat\(s\)\*{0,2}\s*:\s*(.+?)(?:\n|$)/im);
    const sceneGoalMatch = chapterContent.match(/(?:^[-*]\s*)?\*{0,2}Scene Goal\*{0,2}\s*:\s*(.+?)(?:\n|$)/im);
    const povMatch = chapterContent.match(/(?:^[-*]\s*)?\*{0,2}POV Character\*{0,2}\s*:\s*(.+?)(?:\n|$)/im);
    const wordTargetMatch = chapterContent.match(/(?:^[-*]\s*)?\*{0,2}Word Target\*{0,2}\s*:\s*~?(\d+)/im);
    outlines.push({
      chapterNumber: current.number,
      title: current.title,
      beatReference: beatMatch?.[1]?.trim() || '',
      sceneGoal: sceneGoalMatch?.[1]?.trim() || '',
      pov: povMatch?.[1]?.trim() || undefined,
      wordTarget: wordTargetMatch ? parseInt(wordTargetMatch[1], 10) : undefined,
    });
  }
  return outlines;
}

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

type OverlayStatus = 'idle' | 'running' | 'complete' | 'error';
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
    documents,
    chapters,
    revisionTasks,
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
  const [totalSteps, setTotalSteps] = useState(0);
  const [timeLeftThisStep, setTimeLeftThisStep] = useState(0);
  const [timeLeftTotal, setTimeLeftTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [controlActionPending, setControlActionPending] = useState<AutoControlAction>('none');
  const pipelineStarted = useRef(false);
  const controlActionRef = useRef<AutoControlAction>('none');
  const lastStepUpdate = useRef(0);
  const stepThrottleMs = 600;

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
    const inAutoRange =
      STAGE_ORDER.indexOf(project.currentStage as (typeof STAGE_ORDER)[number]) >= 0;
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
      overlayStatus === 'complete'
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
      clearError();
      setStep('Loading project…', 0, 20, 0, 0);

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
        const result = await generate(stage, data);
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
            } catch (rewindErr) {
              currentStage = 'chapters';
              await advanceStage(projectId, 'chapters');
              await loadProject(projectId);
            }
          }
        };

        await Promise.race([loadAndRewind(), timeoutPromise]);

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
          const conceptsResult = await generate('ending', {
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
          const expandResult = await generate('ending', {
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
          const titleResult = await generate('title', {
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
        }
        // Chapter-outlines (then run chapters in same pipeline run)
        if (currentStage === 'chapter-outlines') {
          await runDocStage('chapter-outlines');
          await loadProject(projectId);
          currentStage = 'chapters';
          throwIfControlRequested();
        }
        // Chapters: create chapter records and generate each (read from store so we see just-saved chapter-outlines)
        if (currentStage === 'chapters') {
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
            const chapterResult = await generate('chapters', {
              genre: project.genre,
              chapterNumber: outline.chapterNumber,
              chapterTitle: outline.title,
              beatReference: outline.beatReference,
              sceneGoal: outline.sceneGoal,
              pov: outline.pov,
              charactersReference: charactersDoc?.content || '',
              endingReference: endingDoc?.content || '',
              previousChapterSummaries,
              structureContext: structureDoc?.content || '',
              genreResearch: genreDoc?.content || '',
              nicheReference: nicheDoc?.content || '',
              wordTarget: outline.wordTarget || 3000,
            });
            const latestVer = getLatestChapterVersion(chapter.id);
            const newVer = (latestVer?.version || 0) + 1;
            const versionId = await createChapterVersion({
              chapterId: chapter.id,
              projectId,
              chapterNumber: chapter.chapterNumber,
              version: newVer,
              content: chapterResult.content,
              wordCount: countWords(chapterResult.content),
              approved: false,
            });
            await approveChapterVersion(versionId);
            const chapterSummaryResult = await generate('chapter-summary', {
              genre: project.genre,
              chapterNumber: chapter.chapterNumber,
              chapterTitle: chapter.title,
              chapterContent: chapterResult.content,
            });
            chapterSummaries.set(chapter.chapterNumber, {
              title: chapter.title,
              summary: chapterSummaryResult.content.trim(),
            });
            stepIdx++;
            throwIfControlRequested();
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

          const parseRevisionQueue = (content: string) => {
            let jsonContent = content;
            const jsonMatch = jsonContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
            if (jsonMatch) jsonContent = jsonMatch[1];
            const revisionQueueData = JSON.parse(jsonContent) as {
              revisionTasks: Array<{
                chapterNumber: number;
                issueCount: number;
                issues: Array<{
                  category: string;
                  description: string;
                  manuscriptQuote?: string;
                  location: string;
                  fix: string;
                }>;
                acceptanceCriteria: string[];
                summary: string;
              }>;
            };
            if (!revisionQueueData.revisionTasks || !Array.isArray(revisionQueueData.revisionTasks)) {
              throw new Error('Revision queue missing task list.');
            }
            return revisionQueueData;
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

            setStep(`Editorial: ${pass}`, stepIdx, 20, FULL_AUTO_ESTIMATES_MINUTES['editorial'] ?? 5, 0);
            let editorialResult;
            try {
              editorialResult = await generate('editorial', {
                manuscript,
                genre: editorialProject.genre,
                chapterCount: useProjectStore.getState().chapters.length,
                editorialPass: pass,
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
              queueResult = await generate('editorial', {
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
            for (const taskData of revisionQueueData.revisionTasks) {
              const instructions = (taskData.issues || [])
                .map((i) =>
                  [
                    `${i.category}: ${i.description}`,
                    i.manuscriptQuote ? `Original text: "${i.manuscriptQuote}"` : null,
                    `Location: ${i.location}`,
                    `Fix: ${i.fix}`,
                  ]
                    .filter(Boolean)
                    .join('\n')
                )
                .join('\n\n');
              const finalInstructions =
                taskData.issueCount > 0 ? instructions : taskData.summary || 'Review chapter for quality.';
              await createRevisionTask({
                projectId,
                chapterNumber: taskData.chapterNumber,
                editPass: pass,
                issueIds: [],
                instructions: finalInstructions,
                acceptanceCriteria: taskData.acceptanceCriteria || [],
                status: 'queued',
              });
            }
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
              const revResult = await generate(
                'revision',
                {
                  genre: project.genre,
                  chapterNumber: chapter.chapterNumber,
                  chapterTitle: chapter.title,
                  originalContent: originalVersion.content,
                  revisionInstructions: task.instructions,
                  acceptanceCriteria: task.acceptanceCriteria?.length ? task.acceptanceCriteria : ['Consistency with canon'],
                  charactersReference: charactersDoc?.content || '',
                  endingReference: endingDoc?.content || '',
                  structureReference: structureDoc?.content || '',
                  nicheReference: nicheDoc?.content || '',
                  previousChapterContext: prevApproved ? chapterSnapshot(prevApproved.content) : undefined,
                  nextChapterContext: nextApproved ? chapterSnapshot(nextApproved.content) : undefined,
                  editorialPass: pass,
                },
                { model: getEffectiveModelForStage('revision').id }
              );
              const sorted = [...versions].sort((a, b) => b.version - a.version);
              const newVer = (sorted[0]?.version || 0) + 1;
              const versionId = await createChapterVersion({
                chapterId: chapter.id,
                projectId,
                chapterNumber: chapter.chapterNumber,
                version: newVer,
                content: revResult.content,
                wordCount: countWords(revResult.content),
                approved: false,
              });
              await approveChapterVersion(versionId);
              await updateRevisionTask(task.id, { status: 'done' });
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
          const revResult = await generate(
            'revision',
            {
              genre: project.genre,
              chapterNumber: chapter.chapterNumber,
              chapterTitle: chapter.title,
              originalContent: originalVersion.content,
              revisionInstructions: task.instructions,
              acceptanceCriteria: task.acceptanceCriteria?.length ? task.acceptanceCriteria : ['Consistency with canon'],
              charactersReference: charactersDoc?.content || '',
              endingReference: endingDoc?.content || '',
              structureReference: structureDoc?.content || '',
              nicheReference: nicheDoc?.content || '',
              previousChapterContext: prevApproved ? chapterSnapshot(prevApproved.content) : undefined,
              nextChapterContext: nextApproved ? chapterSnapshot(nextApproved.content) : undefined,
              editorialPass: pass,
            },
            { model: getEffectiveModelForStage('revision').id }
          );
          const sorted = [...versions].sort((a, b) => b.version - a.version);
          const newVer = (sorted[0]?.version || 0) + 1;
          const versionId = await createChapterVersion({
            chapterId: chapter.id,
            projectId,
            chapterNumber: chapter.chapterNumber,
            version: newVer,
            content: revResult.content,
            wordCount: countWords(revResult.content),
            approved: false,
          });
          await approveChapterVersion(versionId);
          await updateRevisionTask(task.id, { status: 'done' });
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
        const blurbResult = await generate('blurb', {
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
        const amazonResult = await generate('amazon-description', {
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
        setOverlayStatus('complete');
        setCurrentStepLabel('Complete');
        setTimeLeftThisStep(0);
        setTimeLeftTotal(0);
        setTimeout(() => router.replace(`/projects/${projectId}`), 1500);
      } catch (err) {
        if (err instanceof AutoControlError) {
          if (err.action === 'stop') {
            await updateProject(projectId, { fullAutoMode: false });
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
          {overlayStatus === 'complete' && (
            <>
              <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--foreground)' }}>Complete</p>
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
