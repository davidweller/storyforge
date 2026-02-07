'use client';

import { use, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProject } from '@/hooks/useProject';
import { useGenerate } from '@/hooks/useGenerate';
import { useProjectStore } from '@/stores/projectStore';
import { getNextStage, STAGE_ORDER, STAGE_NAMES } from '@/lib/utils';
import { getEstimatedMinutesForStep, FULL_AUTO_ESTIMATES_MINUTES } from '@/lib/fullAutoEstimates';
import { Button } from '@/components/ui';
import type { WorkflowStage, DocumentType } from '@/types';
import { countWords } from '@/lib/utils';

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
  const chapterRegex = /\*\*Chapter\s+(\d+):\s*(.+?)\*\*/g;
  const matches: Array<{ index: number; number: number; title: string; endIndex: number }> = [];
  let match;
  while ((match = chapterRegex.exec(content)) !== null) {
    matches.push({
      index: match.index,
      number: parseInt(match[1], 10),
      title: match[2]?.trim() || '',
      endIndex: match.index + match[0].length,
    });
  }
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const startIndex = current.endIndex;
    const endIndex = next ? next.index : content.length;
    const chapterContent = content.substring(startIndex, endIndex);
    if (isNaN(current.number)) continue;
    const beatMatch = chapterContent.match(/\*\*Story Beat\(s\)\*\*:\s*(.+?)(?:\n|$)/i);
    const sceneGoalMatch = chapterContent.match(/\*\*Scene Goal\*\*:\s*(.+?)(?:\n|$)/i);
    const povMatch = chapterContent.match(/\*\*POV Character\*\*:\s*(.+?)(?:\n|$)/i);
    const wordTargetMatch = chapterContent.match(/\*\*Word Target\*\*:\s*~?(\d+)/i);
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

const stageToDocType: Record<string, DocumentType> = {
  'genre-research': 'genre',
  niche: 'niche',
  ending: 'ending',
  characters: 'characters',
  structure: 'structure',
  'chapter-outlines': 'chapter-outlines',
};

type OverlayStatus = 'idle' | 'running' | 'complete' | 'error';

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
  const pipelineStarted = useRef(false);

  const setStep = useCallback(
    (label: string, stepIdx: number, total: number, minsThis: number, minsTotal: number) => {
      setCurrentStepLabel(label);
      setStepIndex(stepIdx);
      setTotalSteps(total);
      setTimeLeftThisStep(minsThis);
      setTimeLeftTotal(minsTotal);
    },
    []
  );

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
      setOverlayStatus('running');
      setError(null);
      clearError();

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
      };

      try {
        // Reload to get latest project/documents
        await loadProject(projectId);
        const proj = useProjectStore.getState().currentProject;
        if (!proj) throw new Error('Project not loaded');
        currentStage = proj.currentStage as WorkflowStage;

        let totalStepsEst = 0;
        const addEst = (key: string, count?: number) => {
          totalStepsEst += getEstimatedMinutesForStep(key, count);
        };

        // Document stages
        for (const stage of docStages) {
          if (STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]) < STAGE_ORDER.indexOf(currentStage)) continue;
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
          if (!proj.title) await updateProject(projectId, { title: first.title });
          const next = getNextStage('ending');
          if (next) await advanceStage(projectId, next as WorkflowStage);
          currentStage = (next || currentStage) as WorkflowStage;
          stepIdx += 2;
          await loadProject(projectId);
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
        }
        // Chapter-outlines
        if (currentStage === 'chapter-outlines') {
          await runDocStage('chapter-outlines');
          await loadProject(projectId);
        }
        // Chapters: create chapter records and generate each
        if (currentStage === 'chapters') {
          const outlinesDoc = getLatestDocumentByType('chapter-outlines');
          if (!outlinesDoc) throw new Error('No chapter outlines');
          const outlines = parseChapterOutlines(outlinesDoc.content);
          for (let i = 0; i < outlines.length; i++) {
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
            const allChs = useProjectStore.getState().chapters;
            const prevChapter = allChs.filter((c) => c.chapterNumber < outline.chapterNumber).sort((a, b) => b.chapterNumber - a.chapterNumber)[0];
            let previousChapterSummary: string | undefined;
            if (prevChapter) {
              const prevVer = getApprovedChapterVersion(prevChapter.id);
              if (prevVer) previousChapterSummary = prevVer.content.slice(0, 1000) + '...';
            }
            const chapterResult = await generate('chapters', {
              genre: project.genre,
              chapterNumber: outline.chapterNumber,
              chapterTitle: outline.title,
              beatReference: outline.beatReference,
              sceneGoal: outline.sceneGoal,
              pov: outline.pov,
              charactersReference: charactersDoc?.content || '',
              endingReference: endingDoc?.content || '',
              previousChapterSummary,
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
            stepIdx++;
          }
          const next = getNextStage('chapters');
          if (next) await advanceStage(projectId, next as WorkflowStage);
          currentStage = (next || currentStage) as WorkflowStage;
          await loadProject(projectId);
        }
        // Compilation, export-draft: advance only
        if (currentStage === 'compilation') {
          setStep(STAGE_NAMES['compilation'], stepIdx, 20, 0, 0);
          await advanceStage(projectId, 'export-draft');
          currentStage = 'export-draft';
          stepIdx++;
        }
        if (currentStage === 'export-draft') {
          setStep(STAGE_NAMES['export-draft'], stepIdx, 20, 0, 0);
          await advanceStage(projectId, 'editorial');
          currentStage = 'editorial';
          stepIdx++;
        }
        // Editorial: generate report then revision queue
        if (currentStage === 'editorial') {
          setStep(STAGE_NAMES['editorial'], stepIdx, 20, FULL_AUTO_ESTIMATES_MINUTES['editorial'] ?? 5, 0);
          const manuscript = useProjectStore
            .getState()
            .chapters.sort((a, b) => a.chapterNumber - b.chapterNumber)
            .map((ch) => {
              const ver = getApprovedChapterVersion(ch.id);
              return ver ? `## Chapter ${ch.chapterNumber}: ${ch.title}\n\n${ver.content}` : '';
            })
            .filter(Boolean)
            .join('\n\n');
          const editorialResult = await generate('editorial', {
            manuscript,
            genre: project.genre,
            chapterCount: useProjectStore.getState().chapters.length,
          });
          let editorialDocId: string | null = null;
          const latestEditorial = getLatestDocumentByType('editorial');
          if (latestEditorial) {
            await updateDocument(latestEditorial.id, { content: editorialResult.content });
            editorialDocId = latestEditorial.id;
          } else {
            editorialDocId = await createDocument({
              projectId,
              type: 'editorial',
              content: editorialResult.content,
              version: 1,
              approved: false,
            });
          }
          await approveDocument(editorialDocId!);
          const queueResult = await generate('editorial', {
            createQueue: true,
            editorialReport: editorialResult.content,
            chapterCount: useProjectStore.getState().chapters.length,
          });
          let revisionQueueData: {
            revisionTasks: Array<{
              chapterNumber: number;
              issueCount: number;
              issues: Array<{ category: string; description: string; location: string; fix: string }>;
              acceptanceCriteria: string[];
              summary: string;
            }>;
          };
          let jsonContent = queueResult.content;
          const jsonMatch = jsonContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
          if (jsonMatch) jsonContent = jsonMatch[1];
          revisionQueueData = JSON.parse(jsonContent);
          if (!revisionQueueData.revisionTasks || !Array.isArray(revisionQueueData.revisionTasks)) {
            throw new Error('Invalid revision queue format');
          }
          for (const taskData of revisionQueueData.revisionTasks) {
            const instructions = taskData.issues
              .map((i) => `${i.category}: ${i.description}\nLocation: ${i.location}\nFix: ${i.fix}`)
              .join('\n\n');
            const finalInstructions =
              taskData.issueCount > 0 ? instructions : taskData.summary || 'Review chapter for quality.';
            await createRevisionTask({
              projectId,
              chapterNumber: taskData.chapterNumber,
              issueIds: [],
              instructions: finalInstructions,
              acceptanceCriteria: taskData.acceptanceCriteria || [],
              status: taskData.issueCount > 0 ? 'queued' : 'done',
            });
          }
          await advanceStage(projectId, 'revision');
          currentStage = 'revision';
          stepIdx++;
          await loadProject(projectId);
          await loadRevisionTasks(projectId);
        }
        // Revision: apply each task
        const tasks = useProjectStore.getState().revisionTasks.filter((t) => t.status !== 'done');
        for (const task of tasks) {
          setStep(`Revision: Chapter ${task.chapterNumber}`, stepIdx, 20, FULL_AUTO_ESTIMATES_MINUTES['revision-per'] ?? 3, 0);
          const chapter = useProjectStore.getState().chapters.find((c) => c.chapterNumber === task.chapterNumber);
          const originalVersion = chapter ? getApprovedChapterVersion(chapter.id) : null;
          if (!chapter || !originalVersion) {
            await updateRevisionTask(task.id, { status: 'done' });
            continue;
          }
          await updateRevisionTask(task.id, { status: 'in_progress' });
          const charactersDoc = getDocumentByType('characters');
          const endingDoc = getDocumentByType('ending');
          const structureDoc = getDocumentByType('structure');
          const nicheDoc = getDocumentByType('niche');
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
            },
            { model: 'claude-sonnet-4-5' }
          );
          const newVer = (getLatestChapterVersion(chapter.id)?.version || 0) + 1;
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
    updateProject,
    clearError,
    retryTrigger,
  ]);

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

  return (
    <div style={{ position: 'relative', minHeight: 'calc(100vh - var(--header-height))' }}>
      {/* Blocking overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
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
          }}
        >
          {overlayStatus === 'running' && (
            <>
              <div className="w-14 h-14 border-4 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin mx-auto mb-6" />
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
              <p style={{ fontSize: '0.8125rem', color: 'var(--destructive)', marginTop: '1.5rem', fontWeight: 500 }}>
                Do not refresh or close this tab. You can resume from the project dashboard if you need to stop.
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
