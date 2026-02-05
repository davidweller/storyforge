// Available LLM models for content generation

export type LLMProvider = 'openai' | 'anthropic';

export interface LLMModel {
  id: string;
  name: string;
  provider: LLMProvider;
  description: string;
  maxTokens: number; // Max OUTPUT tokens
  maxContextTokens?: number; // Max INPUT context window
  isDefault?: boolean;
}

// OpenAI Models
export const OPENAI_MODELS: LLMModel[] = [
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2 Thinking',
    provider: 'openai',
    description: 'Advanced reasoning model with deep thinking capabilities',
    maxTokens: 16384, // Output limit
    maxContextTokens: 128000, // Input context window (128k tokens)
    isDefault: true,
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    description: 'Powerful general-purpose model',
    maxTokens: 16384,
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'openai',
    description: 'Faster and more cost-effective',
    maxTokens: 16384,
  },
  {
    id: 'gpt-4.1-nano',
    name: 'GPT-4.1 Nano',
    provider: 'openai',
    description: 'Fastest responses, best for simple tasks',
    maxTokens: 8192,
  },
];

// Anthropic Models
// Using actual model IDs from Anthropic API
export const ANTHROPIC_MODELS: LLMModel[] = [
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    description: 'Latest Claude model, excellent for creative writing',
    maxTokens: 16384, // Output limit
    maxContextTokens: 200000, // Input context window (200k tokens)
    isDefault: true,
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    description: 'Previous generation Claude model',
    maxTokens: 16384,
    maxContextTokens: 200000, // 200k context window
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    description: 'Fastest Claude model, great for quick tasks',
    maxTokens: 8192,
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    description: 'Most capable Claude 3 model',
    maxTokens: 16384,
  },
];

// All models combined
export const ALL_MODELS: LLMModel[] = [...OPENAI_MODELS, ...ANTHROPIC_MODELS];

// Get model by ID
export function getModelById(modelId: string): LLMModel | undefined {
  return ALL_MODELS.find((m) => m.id === modelId);
}

// Get default model for a provider
export function getDefaultModel(provider: LLMProvider): LLMModel {
  const models = provider === 'openai' ? OPENAI_MODELS : ANTHROPIC_MODELS;
  return models.find((m) => m.isDefault) || models[0];
}

// Get models by provider
export function getModelsByProvider(provider: LLMProvider): LLMModel[] {
  return provider === 'openai' ? OPENAI_MODELS : ANTHROPIC_MODELS;
}

// Default models per stage (provider assignment)
export const STAGE_DEFAULT_PROVIDERS: Record<string, LLMProvider> = {
  'setup': 'openai',
  'genre-research': 'openai',
  'niche': 'openai',
  'ending': 'anthropic',
  'characters': 'openai',
  'structure': 'openai',
  'title': 'openai',
  'chapter-outlines': 'openai',
  'chapters': 'anthropic',
  'compilation': 'openai',
  'editorial': 'openai',
  'revision': 'anthropic',
};

// Get default model for a stage
export function getDefaultModelForStage(stage: string): LLMModel {
  const provider = STAGE_DEFAULT_PROVIDERS[stage] || 'openai';
  return getDefaultModel(provider);
}

// LocalStorage key for model preferences
export const MODEL_PREFERENCES_KEY = 'storyforge_model_preferences';

// Get saved model preference for a stage
export function getSavedModelPreference(stage: string): string | null {
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
export function saveModelPreference(stage: string, modelId: string): void {
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
export function getEffectiveModelForStage(stage: string): LLMModel {
  const savedModelId = getSavedModelPreference(stage);
  if (savedModelId) {
    const model = getModelById(savedModelId);
    if (model) return model;
  }
  return getDefaultModelForStage(stage);
}
