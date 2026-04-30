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

// Anthropic Models (Claude Sonnet / Opus 4.6 only; thinking presets = extended thinking)
export const ANTHROPIC_MODELS: LLMModel[] = [
  {
    id: 'claude-sonnet-4-6-thinking',
    name: 'Claude Sonnet 4.6 (Thinking)',
    provider: 'anthropic',
    description: 'Default: Sonnet 4.6 with extended thinking for reasoning-heavy generation',
    apiModelId: 'claude-sonnet-4-6',
    thinkingBudgetTokens: 32_000,
    maxTokens: 32_768,
    maxContextTokens: 1_000_000,
    isDefault: true,
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    description: 'Most capable Claude tier for complex writing and analysis',
    maxTokens: 128_000,
    maxContextTokens: 1_000_000,
  },
  {
    id: 'claude-opus-4-6-thinking',
    name: 'Claude Opus 4.6 (Thinking)',
    provider: 'anthropic',
    description: 'Same model with extended thinking enabled for harder reasoning',
    apiModelId: 'claude-opus-4-6',
    thinkingBudgetTokens: 32_000,
    maxTokens: 32_768,
    maxContextTokens: 1_000_000,
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    description: 'High quality and speed for long-form creative writing',
    maxTokens: 64_000,
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

// Default LLM provider per workflow stage.
// TypeScript will error if a WorkflowStage value is missing from this map.
export const STAGE_DEFAULT_PROVIDERS: Record<WorkflowStage, LLMProvider> = {
  'setup': 'openrouter',
  'genre-research': 'openrouter',
  'niche': 'openrouter',
  'ending': 'openrouter',
  'characters': 'openrouter',
  'structure': 'openrouter',
  'title': 'openrouter',
  'chapter-outlines': 'openrouter',
  'chapter-summary': 'openrouter',
  'chapter-scene-plan': 'openrouter',
  'chapter-scenes-prose': 'openrouter',
  'chapter-polish': 'openrouter',
  'chapter-scene-eval': 'openrouter',
  'story-bible': 'openrouter',
  'creative-brief': 'openrouter',
  'chapters': 'openrouter',
  'compilation': 'openrouter',
  'export-draft': 'openrouter',
  'editorial': 'openrouter',
  'revision': 'openrouter',
  'revision-verify': 'openrouter',
  'export-final': 'openrouter',
  'blurb': 'openrouter',
  'amazon-description': 'openrouter',
};

// Get default model for a stage
export function getDefaultModelForStage(stage: WorkflowStage): LLMModel {
  const provider = STAGE_DEFAULT_PROVIDERS[stage] ?? 'openrouter';
  return getDefaultModel(provider);
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
