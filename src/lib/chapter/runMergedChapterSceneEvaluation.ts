import type { WorkflowStage } from '@/types';
import type { Project, ProjectDocument, Chapter, ChapterVersion, SceneProseSegment } from '@/types';
import type { ChapterEvaluation, ChapterScenePlanDocument } from '@/lib/generation/schemas';
import { parseChapterEvaluation } from '@/lib/generation/schemas';
import { assembleContext } from '@/lib/context/assembler';
import { CHAPTER_SCENE_EVAL_INPUT_TOKEN_BUDGET } from '@/lib/constants';
import {
  mergeEvaluationResults,
  planSceneEvalChunks,
  runDeterministicChapterEvaluation,
  sliceScenePlanForSegments,
} from '@/lib/chapter/evaluator';

export type ChapterGenerateFn = (
  stage: WorkflowStage,
  data: Record<string, unknown>
) => Promise<{ content: string }>;

/** Deterministic gates + chunked `chapter-scene-eval` merged into one result (chapter pipeline + post-fix re-eval). */
export async function runMergedChapterSceneEvaluation(params: {
  generate: ChapterGenerateFn;
  project: Project;
  documents: ProjectDocument[];
  chapters: Chapter[];
  approvedChapterVersions: ChapterVersion[];
  currentChapter: Chapter;
  scenePlan: ChapterScenePlanDocument;
  segments: SceneProseSegment[];
  chapterTitle: string;
  outlineWordTarget?: number;
}): Promise<ChapterEvaluation> {
  const {
    generate,
    project,
    documents,
    chapters,
    approvedChapterVersions,
    currentChapter,
    scenePlan,
    segments,
    chapterTitle,
    outlineWordTarget,
  } = params;

  const evalCanon = assembleContext({
    purpose: 'chapter-eval',
    project,
    documents,
    chapters,
    approvedChapterVersions,
    currentChapter,
    targetChapterNumber: currentChapter.chapterNumber,
  });

  const deterministic = runDeterministicChapterEvaluation({
    segments,
    sceneCards: scenePlan.scenes,
    outlineWordTarget,
  });

  const chunks = planSceneEvalChunks(
    segments,
    scenePlan,
    evalCanon.text,
    CHAPTER_SCENE_EVAL_INPUT_TOKEN_BUDGET,
  );

  const modelParts: ChapterEvaluation[] = [];
  for (const chunk of chunks) {
    const chunkText = chunk.map((s) => s.prose).join('\n\n');
    const chunkLabel = chunk.map((s) => s.sceneId).join(', ');
    const planSlice = sliceScenePlanForSegments(scenePlan, chunk);
    const scenePlanJson = JSON.stringify(planSlice);
    const evaluationMode =
      chunk.length === 1 && planSlice.scenes.length <= 1 ? 'standard' : 'lite';
    const er = await generate('chapter-scene-eval', {
      genre: project.genre,
      chapterNumber: currentChapter.chapterNumber,
      chapterTitle,
      scenePlanJson,
      chapterText: chunkText,
      compactCanon: evalCanon.text,
      chunkLabel,
      evaluationMode,
    });    modelParts.push(parseChapterEvaluation(er.content));
  }

  const modelMerged =
    modelParts.length > 0
      ? mergeEvaluationResults(modelParts)
      : { checks: [] as ChapterEvaluation['checks'], summary: '' };

  return mergeEvaluationResults([deterministic, modelMerged]);
}
