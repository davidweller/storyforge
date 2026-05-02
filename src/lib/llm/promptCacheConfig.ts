import type { WorkflowStage } from '@/types';
import { OPENAI_MODELS, ANTHROPIC_MODELS, OPENROUTER_MODELS, type LLMProvider } from '@/lib/data/models';

function readEnvBool(key: string, defaultValue: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === '') return defaultValue;
  return v === '1' || v.toLowerCase() === 'true';
}

export function getLLMProviderForModelId(modelId: string): LLMProvider {
  if (OPENAI_MODELS.some((m) => m.id === modelId)) return 'openai';
  if (ANTHROPIC_MODELS.some((m) => m.id === modelId)) return 'anthropic';
  if (OPENROUTER_MODELS.some((m) => m.id === modelId)) return 'openrouter';
  return 'openrouter';
}

const DRAFTING_CACHE_STAGES: ReadonlySet<WorkflowStage> = new Set([
  'chapters',
  'revision',
  'chapter-scene-plan',
  'chapter-scenes-prose',
  'chapter-polish',
  'chapter-summary',
  'chapter-scene-eval',
]);

const EDITORIAL_CACHE_STAGES: ReadonlySet<WorkflowStage> = new Set(['editorial', 'editorial-issues']);

/** Master switch: when false, no Anthropic prompt caching. */
export function anthropicPromptCachingGloballyEnabled(): boolean {
  return readEnvBool('ANTHROPIC_PROMPT_CACHING', true);
}

/** Chapter drafting, scene pipeline, summaries, eval — default on when global is on. */
export function anthropicPromptCachingDraftingEnabled(): boolean {
  return anthropicPromptCachingGloballyEnabled() && readEnvBool('ANTHROPIC_PROMPT_CACHING_DRAFTING', true);
}

/** Editorial reordered prompts — default off until explicitly enabled. */
export function anthropicPromptCachingEditorialEnabled(): boolean {
  return anthropicPromptCachingGloballyEnabled() && readEnvBool('ANTHROPIC_PROMPT_CACHING_EDITORIAL', false);
}

export function stageUsesAnthropicPromptCache(stage: WorkflowStage): boolean {
  if (!anthropicPromptCachingGloballyEnabled()) return false;
  if (DRAFTING_CACHE_STAGES.has(stage)) return anthropicPromptCachingDraftingEnabled();
  if (EDITORIAL_CACHE_STAGES.has(stage)) return anthropicPromptCachingEditorialEnabled();
  return false;
}

/** Editorial createQueue uses buildRevisionQueuePrompt — not a canon-cache candidate. */
export function shouldTryAnthropicPromptCache(
  stage: WorkflowStage,
  data: Record<string, unknown>,
): boolean {
  if (!stageUsesAnthropicPromptCache(stage)) return false;
  if (stage === 'editorial' && data.createQueue) return false;
  return true;
}
