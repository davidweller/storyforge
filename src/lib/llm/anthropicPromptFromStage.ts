import type Anthropic from '@anthropic-ai/sdk';
import type { WorkflowStage, EditorialPass } from '@/types';
import {
  buildChapterPromptParts,
  buildChapterRevisionPromptParts,
  buildChapterSummaryPromptParts,
} from '@/lib/prompts/chapters';
import {
  buildChapterScenePlanPromptParts,
  buildChapterSceneProsePromptParts,
  buildChapterPolishPromptParts,
  buildChapterSceneEvalPromptParts,
} from '@/lib/prompts/scenes';
import { buildEditorialPromptParts, buildEditorialIssuesQueuePromptParts } from '@/lib/prompts/editorial';
import {
  formatChapterDraftCanonBlock,
  formatRevisionPrimaryCanonBlock,
  formatSceneCanonBlock,
} from '@/lib/prompts/canonBlock';
import { formatSceneEvalCanonSection } from '@/lib/prompts/scenes';
import { buildAnthropicCachedSystemBlocks } from '@/lib/llm/anthropicCache';
import { getLLMProviderForModelId, shouldTryAnthropicPromptCache } from '@/lib/llm/promptCacheConfig';
import { ChapterOutlineSchema, SceneCardSchema } from '@/lib/generation/schemas';

const EDITORIAL_PASS_VALUES: EditorialPass[] = [
  'structural',
  'line',
  'copy',
  'proofread',
  'final_report',
];

function parseEditorialPass(value: unknown): EditorialPass {
  if (typeof value === 'string' && EDITORIAL_PASS_VALUES.includes(value as EditorialPass)) {
    return value as EditorialPass;
  }
  return 'structural';
}

type CanonBundle = { userPrompt: string; formattedCanon: string };

export function canonBundleForStage(stage: WorkflowStage, data: Record<string, unknown>): CanonBundle | null {
  switch (stage) {
    case 'chapters':
      return (() => {
        const p = buildChapterPromptParts({
          genre: data.genre as string,
          chapterNumber: data.chapterNumber as number,
          chapterTitle: data.chapterTitle as string,
          beatReference: data.beatReference as string,
          sceneGoal: data.sceneGoal as string,
          pov: data.pov as string | undefined,
          assembledContext: data.assembledContext as string | undefined,
          charactersReference: data.charactersReference as string,
          endingReference: data.endingReference as string,
          previousChapterSummaries: data.previousChapterSummaries as
            | Array<{ chapterNumber: number; title: string; summary: string }>
            | undefined,
          structureContext: data.structureContext as string,
          genreResearch: data.genreResearch as string | undefined,
          nicheReference: data.nicheReference as string | undefined,
          wordTarget: data.wordTarget as number | undefined,
        });
        return {
          userPrompt: p.userPrompt,
          formattedCanon: p.canon ? formatChapterDraftCanonBlock(p.canon) : '',
        };
      })();
    case 'revision':
      return (() => {
        const p = buildChapterRevisionPromptParts({
          originalChapter: data.originalContent as string,
          revisionInstructions: (data.revisionInstructions as string) || 'Review and improve the chapter.',
          acceptanceCriteria: Array.isArray(data.acceptanceCriteria) ? (data.acceptanceCriteria as string[]) : [],
          assembledContext: data.assembledContext as string | undefined,
          charactersReference: (data.charactersReference as string) || '',
          endingReference: (data.endingReference as string) || '',
          structureReference: data.structureReference as string | undefined,
          nicheReference: data.nicheReference as string | undefined,
          previousChapterContext: data.previousChapterContext as string | undefined,
          nextChapterContext: data.nextChapterContext as string | undefined,
          editorialPass: parseEditorialPass(data.editorialPass),
          sceneScoped:
            typeof data.sceneRevisionSceneId === 'string' && data.sceneRevisionSceneId.trim()
              ? { sceneId: data.sceneRevisionSceneId as string }
              : undefined,
        });
        return {
          userPrompt: p.userPrompt,
          formattedCanon: p.canon ? formatRevisionPrimaryCanonBlock(p.canon) : '',
        };
      })();
    case 'chapter-scene-plan':
      return (() => {
        let outlineChapter: import('@/lib/generation/schemas').ChapterOutline | undefined;
        const slice = data.outlineSliceJson as string | undefined;
        if (slice?.trim()) {
          try {
            outlineChapter = ChapterOutlineSchema.parse(JSON.parse(slice));
          } catch {
            outlineChapter = undefined;
          }
        }
        const p = buildChapterScenePlanPromptParts({
          genre: data.genre as string,
          chapterNumber: data.chapterNumber as number,
          outlineChapter,
          assembledContext: data.assembledContext as string | undefined,
          outlinesSourceJson: data.outlinesSourceJson as string,
        });
        return {
          userPrompt: p.userPrompt,
          formattedCanon: p.canon ? formatSceneCanonBlock(p.canon) : '',
        };
      })();
    case 'chapter-scenes-prose':
      return (() => {
        const p = buildChapterSceneProsePromptParts({
          genre: data.genre as string,
          chapterNumber: data.chapterNumber as number,
          chapterTitle: data.chapterTitle as string,
          sceneCard: SceneCardSchema.parse(data.sceneCard),
          neighborSummaryBefore: data.neighborSummaryBefore as string | undefined,
          neighborSummaryAfter: data.neighborSummaryAfter as string | undefined,
          assembledContext: data.assembledContext as string | undefined,
          wordTarget: data.wordTarget as number | undefined,
        });
        return {
          userPrompt: p.userPrompt,
          formattedCanon: p.canon ? formatSceneCanonBlock(p.canon) : '',
        };
      })();
    case 'chapter-polish':
      return (() => {
        const p = buildChapterPolishPromptParts({
          genre: data.genre as string,
          chapterNumber: data.chapterNumber as number,
          chapterTitle: data.chapterTitle as string,
          concatenatedDraft: data.concatenatedDraft as string,
          assembledContext: data.assembledContext as string | undefined,
        });
        return {
          userPrompt: p.userPrompt,
          formattedCanon: p.canon ? formatSceneCanonBlock(p.canon) : '',
        };
      })();
    case 'chapter-summary':
      return (() => {
        const p = buildChapterSummaryPromptParts({
          genre: data.genre as string,
          chapterNumber: data.chapterNumber as number,
          chapterTitle: data.chapterTitle as string,
          chapterContent: data.chapterContent as string,
        });
        return { userPrompt: p.userPrompt, formattedCanon: '' };
      })();
    case 'chapter-scene-eval':
      return (() => {
        const p = buildChapterSceneEvalPromptParts({
          genre: data.genre as string,
          chapterNumber: data.chapterNumber as number,
          chapterTitle: data.chapterTitle as string,
          scenePlanJson: data.scenePlanJson as string,
          chapterText: data.chapterText as string,
          compactCanon: (data.compactCanon as string | undefined) ?? '',
          chunkLabel: data.chunkLabel as string | undefined,
          evaluationMode:
            data.evaluationMode === 'lite' || data.evaluationMode === 'standard' || data.evaluationMode === 'deep'
              ? data.evaluationMode
              : undefined,
        });
        return {
          userPrompt: p.userPrompt,
          formattedCanon: p.canon ? formatSceneEvalCanonSection(p.canon) : '',
        };
      })();
    case 'editorial':
      return (() => {
        const p = buildEditorialPromptParts({
          manuscript: data.manuscript as string,
          genre: data.genre as string,
          assembledContext: data.assembledContext as string | undefined,
          nicheReference: data.nicheReference as string | undefined,
          charactersReference: data.charactersReference as string | undefined,
          endingReference: data.endingReference as string | undefined,
          structureReference: data.structureReference as string | undefined,
          editorialPass: parseEditorialPass(data.editorialPass),
          intendedAudience: typeof data.intendedAudience === 'string' ? data.intendedAudience : undefined,
          premise: typeof data.premise === 'string' ? data.premise : undefined,
          research: typeof data.research === 'string' ? data.research : undefined,
        });
        return { userPrompt: p.userPrompt, formattedCanon: p.canon };
      })();
    case 'editorial-issues':
      return (() => {
        const p = buildEditorialIssuesQueuePromptParts({
          manuscript: data.manuscript as string,
          genre: data.genre as string,
          chapterCount: data.chapterCount as number,
          editorialPass: parseEditorialPass(data.editorialPass),
          assembledContext: data.assembledContext as string | undefined,
          nicheReference: data.nicheReference as string | undefined,
          charactersReference: data.charactersReference as string | undefined,
          endingReference: data.endingReference as string | undefined,
          structureReference: data.structureReference as string | undefined,
          intendedAudience: typeof data.intendedAudience === 'string' ? data.intendedAudience : undefined,
          premise: typeof data.premise === 'string' ? data.premise : undefined,
          research: typeof data.research === 'string' ? data.research : undefined,
        });
        return { userPrompt: p.userPrompt, formattedCanon: p.canon };
      })();
    default:
      return null;
  }
}

/**
 * When native Anthropic + caching env allowlist matches, returns structured `system` and split user prompt.
 * Otherwise returns `fullPrompt` unchanged and no `anthropicSystem`.
 */
export function resolveAnthropicCachedPrompt(
  stage: WorkflowStage,
  modelId: string,
  data: Record<string, unknown>,
  systemPrompt: string,
  fullPrompt: string,
): { prompt: string; anthropicSystem?: Anthropic.Messages.MessageCreateParams['system'] } {
  if (!modelId) return { prompt: fullPrompt };
  if (getLLMProviderForModelId(modelId) !== 'anthropic') return { prompt: fullPrompt };
  if (!shouldTryAnthropicPromptCache(stage, data)) return { prompt: fullPrompt };

  const bundle = canonBundleForStage(stage, data);
  if (!bundle) return { prompt: fullPrompt };

  const blocks = buildAnthropicCachedSystemBlocks({
    staticSystem: systemPrompt,
    formattedCanon: bundle.formattedCanon,
  });

  if (!blocks) return { prompt: fullPrompt };

  return { prompt: bundle.userPrompt, anthropicSystem: blocks };
}
