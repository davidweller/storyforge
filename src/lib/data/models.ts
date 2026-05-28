// Available LLM models for content generation

import type { WorkflowStage } from '@/types';

export type LLMProvider = 'openai' | 'anthropic' | 'openrouter';

export interface LLMModel {
  id: string;
  name: string;
  provider: LLMProvider;
  description: string;
  maxTokens: number; // Max OUTPUT tokens
  maxContextTokens?: number; // Max INPUT context window
  isDefault?: boolean;
  /** Anthropic API model ID when it differs from `id` (e.g. thinking preset). */
  apiModelId?: string;
  /** Anthropic extended thinking budget (must be less than max_tokens on the API request). */
  thinkingBudgetTokens?: number;
  /** OpenRouter reasoning effort for models that support dual thinking modes. */
  openRouterReasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
}

// OpenAI Models (GPT-5.2+ only)
export const OPENAI_MODELS: LLMModel[] = [
  {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    provider: 'openai',
    description: 'Flagship reasoning and coding model',
    maxTokens: 16384,
    maxContextTokens: 1_000_000,
    isDefault: true,
  },
  {
    id: 'gpt-5.4-mini',
    name: 'GPT-5.4 Mini',
    provider: 'openai',
    description: 'Lower latency and cost; strong for most workflows',
    maxTokens: 16384,
    maxContextTokens: 400_000,
  },
  {
    id: 'gpt-5.4-nano',
    name: 'GPT-5.4 Nano',
    provider: 'openai',
    description: 'Fastest GPT-5.4 family option for lighter tasks',
    maxTokens: 16384,
    maxContextTokens: 400_000,
  },
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    provider: 'openai',
    description: 'Reasoning-focused model (GPT-5.2 generation)',
    maxTokens: 16384,
    maxContextTokens: 128_000,
  },
];

/** Default models when `ending` stage branches (concepts vs expansion); see docs/model_recommendations.md */
export const ENDING_CONCEPTS_DEFAULT_MODEL_ID = 'claude-sonnet-4-6';
export const ENDING_EXPANSION_DEFAULT_MODEL_ID = 'claude-sonnet-4-6';

/** Default models when `editorial` branches by pass/workflow. */
export const EDITORIAL_WORKING_PASS_DEFAULT_MODEL_ID = 'claude-sonnet-4-6-thinking-medium';
export const EDITORIAL_REPORT_DEFAULT_MODEL_ID = 'claude-opus-4-6';
export const EDITORIAL_QUEUE_DEFAULT_MODEL_ID = 'claude-sonnet-4-6-thinking-medium';
export const CHAPTER_SCENE_EVAL_DEEP_DEFAULT_MODEL_ID = 'claude-opus-4-6';

/**
 * Anthropic catalog: Haiku 4.5 plus Sonnet/Opus presets (API IDs per docs/model_recommendations.md).
 * Thinking presets use extended thinking budgets; low-effort rows omit thinking.
 */
export const ANTHROPIC_MODELS: LLMModel[] = [
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    description: 'Fast, low-cost tasks (summaries, titles, simple JSON)',
    apiModelId: 'claude-haiku-4-5-20251001',
    maxTokens: 8192,
    maxContextTokens: 200_000,
  },
  {
    id: 'claude-opus-4-7-xhigh',
    name: 'Claude Opus 4.7 (xHigh thinking)',
    provider: 'anthropic',
    description: 'Primary chapter drafting — maximum reasoning depth',
    apiModelId: 'claude-opus-4-7',
    thinkingBudgetTokens: 48_000,
    maxTokens: 128_000,
    maxContextTokens: 1_000_000,
  },
  {
    id: 'claude-opus-4-7-high',
    name: 'Claude Opus 4.7 (High thinking)',
    provider: 'anthropic',
    description: 'Scene prose, editorial report — strong long-context reasoning',
    apiModelId: 'claude-opus-4-7',
    thinkingBudgetTokens: 32_000,
    maxTokens: 64_000,
    maxContextTokens: 1_000_000,
  },
  {
    id: 'claude-opus-4-7-medium',
    name: 'Claude Opus 4.7 (Medium thinking)',
    provider: 'anthropic',
    description: 'Polish, revision, ending expansion — bounded refinement',
    apiModelId: 'claude-opus-4-7',
    thinkingBudgetTokens: 24_000,
    maxTokens: 64_000,
    maxContextTokens: 1_000_000,
  },
  {
    id: 'claude-sonnet-4-6-thinking-medium',
    name: 'Claude Sonnet 4.6 (Medium thinking)',
    provider: 'anthropic',
    description: 'Structured reasoning preset for editorial and canon synthesis',
    apiModelId: 'claude-sonnet-4-6',
    thinkingBudgetTokens: 20_000,
    maxTokens: 32_768,
    maxContextTokens: 1_000_000,
  },
  {
    id: 'claude-sonnet-4-6-thinking-high',
    name: 'Claude Sonnet 4.6 (High thinking)',
    provider: 'anthropic',
    description: 'Heavier Sonnet reasoning; editorial fallback for long manuscripts',
    apiModelId: 'claude-sonnet-4-6',
    thinkingBudgetTokens: 32_000,
    maxTokens: 32_768,
    maxContextTokens: 1_000_000,
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    description: 'Sonnet without extended thinking — low-effort structured tasks',
    apiModelId: 'claude-sonnet-4-6',
    maxTokens: 64_000,
    maxContextTokens: 1_000_000,
    isDefault: true,
  },
  // Legacy / alternate ids (same API models; kept for saved UI preferences)
  {
    id: 'claude-sonnet-4-6-thinking',
    name: 'Claude Sonnet 4.6 (Thinking)',
    provider: 'anthropic',
    description: 'Legacy: Sonnet 4.6 with high thinking budget',
    apiModelId: 'claude-sonnet-4-6',
    thinkingBudgetTokens: 32_000,
    maxTokens: 32_768,
    maxContextTokens: 1_000_000,
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    description: 'Legacy Opus tier',
    apiModelId: 'claude-opus-4-6',
    maxTokens: 128_000,
    maxContextTokens: 1_000_000,
  },
  {
    id: 'claude-opus-4-6-thinking',
    name: 'Claude Opus 4.6 (Thinking)',
    provider: 'anthropic',
    description: 'Legacy Opus 4.6 with extended thinking',
    apiModelId: 'claude-opus-4-6',
    thinkingBudgetTokens: 32_000,
    maxTokens: 32_768,
    maxContextTokens: 1_000_000,
  },
];

// OpenRouter Models
export const OPENROUTER_MODELS: LLMModel[] = [
  {
    id: 'qwen-3.6-thinking-openrouter',
    name: 'Qwen 3.6 (Thinking, OpenRouter)',
    provider: 'openrouter',
    description: 'Default: Qwen 3.6 via OpenRouter with higher reasoning effort',
    apiModelId: 'qwen/qwen3.6-plus',
    openRouterReasoningEffort: 'high',
    maxTokens: 16384,
    maxContextTokens: 262_144,
    isDefault: true,
  },
  {
    id: 'qwen-3.6-openrouter',
    name: 'Qwen 3.6 (Non-thinking, OpenRouter)',
    provider: 'openrouter',
    description: 'Qwen 3.6 via OpenRouter with reasoning disabled for faster responses',
    apiModelId: 'qwen/qwen3.6-plus',
    openRouterReasoningEffort: 'none',
    maxTokens: 16384,
    maxContextTokens: 262_144,
  },
];

// All models combined
export const ALL_MODELS: LLMModel[] = [...OPENAI_MODELS, ...ANTHROPIC_MODELS, ...OPENROUTER_MODELS];

// Get model by ID
export function getModelById(modelId: string): LLMModel | undefined {
  return ALL_MODELS.find((m) => m.id === modelId);
}

// Get default model for a provider
export function getDefaultModel(provider: LLMProvider): LLMModel {
  const models =
    provider === 'openai'
      ? OPENAI_MODELS
      : provider === 'anthropic'
      ? ANTHROPIC_MODELS
      : OPENROUTER_MODELS;
  return models.find((m) => m.isDefault) || models[0];
}

// Get models by provider
export function getModelsByProvider(provider: LLMProvider): LLMModel[] {
  return provider === 'openai'
    ? OPENAI_MODELS
    : provider === 'anthropic'
    ? ANTHROPIC_MODELS
    : OPENROUTER_MODELS;
}

/**
 * Canonical default model registry id per workflow stage (docs/model_recommendations.md quick reference).
 * Branch-specific stages (`ending`, `editorial`, deep `chapter-scene-eval`) also use
 * the exported `*_DEFAULT_MODEL_ID` constants in `/api/generate` when the client does not pass `model`.
 */
export const STAGE_DEFAULT_MODEL_IDS = {
  setup: 'claude-sonnet-4-6',
  'genre-research': 'claude-sonnet-4-6',
  niche: 'claude-sonnet-4-6',
  /** Concepts default; expansion uses {@link ENDING_EXPANSION_DEFAULT_MODEL_ID}. */
  ending: ENDING_CONCEPTS_DEFAULT_MODEL_ID,
  characters: 'claude-sonnet-4-6',
  structure: 'claude-sonnet-4-6',
  title: 'claude-sonnet-4-6',
  'chapter-outlines': 'claude-sonnet-4-6',
  'chapter-summary': 'claude-sonnet-4-6',
  'chapter-scene-plan': 'claude-sonnet-4-6',
  'chapter-scenes-prose': 'claude-sonnet-4-6',
  'chapter-polish': 'claude-sonnet-4-6',
  'chapter-scene-eval': 'claude-sonnet-4-6',
  'story-bible': 'claude-sonnet-4-6-thinking-medium',
  'creative-brief': 'claude-sonnet-4-6',
  chapters: 'claude-sonnet-4-6',
  compilation: 'claude-sonnet-4-6',
  'export-draft': 'claude-sonnet-4-6',
  /** Working edit passes default; final report uses {@link EDITORIAL_REPORT_DEFAULT_MODEL_ID}. */
  editorial: EDITORIAL_WORKING_PASS_DEFAULT_MODEL_ID,
  'editorial-issues': 'claude-sonnet-4-6-thinking-medium',
  revision: 'claude-sonnet-4-6',
  'revision-verify': 'claude-sonnet-4-6',
  'export-final': 'claude-sonnet-4-6',
  blurb: 'claude-sonnet-4-6',
  'amazon-description': 'claude-sonnet-4-6',
  'a-plus-brief': 'claude-sonnet-4-6-thinking-medium',
  'cover-brief': 'claude-sonnet-4-6-thinking-medium',
  'back-cover-brief': 'claude-sonnet-4-6-thinking-medium',
  'serial-setup': 'claude-sonnet-4-6',
  'serial-source': 'claude-sonnet-4-6',
  'serial-mapping': 'claude-sonnet-4-6',
  'serial-hook-score': 'claude-sonnet-4-6',
  'serial-repartition': 'claude-sonnet-4-6',
  'serial-enhance': 'claude-sonnet-4-6',
  'serial-feedback': 'claude-sonnet-4-6',
  'serial-feedback-impact': 'claude-sonnet-4-6',
  'serial-revision': 'claude-sonnet-4-6',
  'serial-export': 'claude-sonnet-4-6',
} as const satisfies Record<WorkflowStage, string>;

// Default LLM provider per workflow stage (mirrors registry ids — all Anthropic for generation stages).
export const STAGE_DEFAULT_PROVIDERS: Record<WorkflowStage, LLMProvider> = {
  setup: 'anthropic',
  'genre-research': 'anthropic',
  niche: 'anthropic',
  ending: 'anthropic',
  characters: 'anthropic',
  structure: 'anthropic',
  title: 'anthropic',
  'chapter-outlines': 'anthropic',
  'chapter-summary': 'anthropic',
  'chapter-scene-plan': 'anthropic',
  'chapter-scenes-prose': 'anthropic',
  'chapter-polish': 'anthropic',
  'chapter-scene-eval': 'anthropic',
  'story-bible': 'anthropic',
  'creative-brief': 'anthropic',
  chapters: 'anthropic',
  compilation: 'anthropic',
  'export-draft': 'anthropic',
  editorial: 'anthropic',
  'editorial-issues': 'anthropic',
  revision: 'anthropic',
  'revision-verify': 'anthropic',
  'export-final': 'anthropic',
  blurb: 'anthropic',
  'amazon-description': 'anthropic',
  'a-plus-brief': 'anthropic',
  'cover-brief': 'anthropic',
  'back-cover-brief': 'anthropic',
  'serial-setup': 'anthropic',
  'serial-source': 'anthropic',
  'serial-mapping': 'anthropic',
  'serial-hook-score': 'anthropic',
  'serial-repartition': 'anthropic',
  'serial-enhance': 'anthropic',
  'serial-feedback': 'anthropic',
  'serial-feedback-impact': 'anthropic',
  'serial-revision': 'anthropic',
  'serial-export': 'anthropic',
};

// Get default model for a stage
export function getDefaultModelForStage(stage: WorkflowStage): LLMModel {
  const id = STAGE_DEFAULT_MODEL_IDS[stage];
  return getModelById(id) ?? getDefaultModel('anthropic');
}

// LocalStorage key for model preferences
export const MODEL_PREFERENCES_KEY = 'storyforge_model_preferences';

// Get saved model preference for a stage
export function getSavedModelPreference(stage: WorkflowStage): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const prefs = localStorage.getItem(MODEL_PREFERENCES_KEY);
    if (prefs) {
      const parsed = JSON.parse(prefs);
      return parsed[stage] || null;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

// Save model preference for a stage
export function saveModelPreference(stage: WorkflowStage, modelId: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const prefs = localStorage.getItem(MODEL_PREFERENCES_KEY);
    const parsed = prefs ? JSON.parse(prefs) : {};
    parsed[stage] = modelId;
    localStorage.setItem(MODEL_PREFERENCES_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore errors
  }
}

// Get the effective model for a stage (saved preference or default)
export function getEffectiveModelForStage(stage: WorkflowStage): LLMModel {
  const savedModelId = getSavedModelPreference(stage);
  if (savedModelId) {
    const model = getModelById(savedModelId);
    if (model) return model;
  }
  return getDefaultModelForStage(stage);
}
