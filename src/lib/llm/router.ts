import { generateWithOpenAI, streamWithOpenAI } from './openai';
import { generateWithClaude, streamWithClaude } from './anthropic';
import type { WorkflowStage } from '@/types';
import { 
  getModelById, 
  getDefaultModelForStage, 
  STAGE_DEFAULT_PROVIDERS,
  OPENAI_MODELS,
  ANTHROPIC_MODELS,
  type LLMProvider 
} from '@/lib/data/models';

export type { LLMProvider };

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  jsonMode?: boolean; // Only for OpenAI
  model?: string; // Model override
}

export interface GenerateResult {
  content: string;
  tokensUsed: number;
  model: string;
  provider: LLMProvider;
}

// Default max tokens per stage (can be overridden by model or options)
const STAGE_MAX_TOKENS: Record<WorkflowStage, number> = {
  'setup': 2048,
  'genre-research': 4096,
  'niche': 4096,
  'ending': 8192,
  'characters': 8192,
  'structure': 8192,
  'title': 4096,
  'chapter-outlines': 8192,
  'chapters': 16384,
  'compilation': 2048,
  'export-draft': 2048,
  'editorial': 8192,
  'revision': 16384,
  'export-final': 2048,
  'blurb': 1024,
  'amazon-description': 4096,
};

/**
 * Determine the provider for a given model ID
 */
function getProviderForModel(modelId: string): LLMProvider {
  if (OPENAI_MODELS.some((m) => m.id === modelId)) {
    return 'openai';
  }
  if (ANTHROPIC_MODELS.some((m) => m.id === modelId)) {
    return 'anthropic';
  }
  // Default to stage's default provider
  return 'openai';
}

/**
 * Generate content using the appropriate LLM based on the stage
 * Supports model override via options.model
 */
export async function generateForStage(
  stage: WorkflowStage,
  prompt: string,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  // Determine which model to use
  let modelId: string;
  let provider: LLMProvider;
  
  if (options.model) {
    // Use the specified model
    modelId = options.model;
    provider = getProviderForModel(modelId);
  } else {
    // Use stage default
    const defaultModel = getDefaultModelForStage(stage);
    modelId = defaultModel.id;
    provider = defaultModel.provider;
  }
  
  // Get max tokens (from options, model config, or stage default)
  const modelConfig = getModelById(modelId);
  const maxTokens = options.maxTokens || modelConfig?.maxTokens || STAGE_MAX_TOKENS[stage];
  
  console.log('[Router] Using model:', {
    modelId,
    modelName: modelConfig?.name || 'Unknown',
    provider,
    stage,
    maxTokens,
  });
  
  const mergedOptions = {
    ...options,
    maxTokens,
    model: modelId,
  };
  
  if (provider === 'openai') {
    const result = await generateWithOpenAI(prompt, mergedOptions);
    return {
      ...result,
      model: modelId,
      provider: 'openai',
    };
  } else {
    const result = await generateWithClaude(prompt, mergedOptions);
    return {
      ...result,
      model: modelId,
      provider: 'anthropic',
    };
  }
}

/**
 * Stream content using the appropriate LLM based on the stage
 * Supports model override via options.model
 */
export async function* streamForStage(
  stage: WorkflowStage,
  prompt: string,
  options: GenerateOptions = {}
): AsyncGenerator<string, GenerateResult, unknown> {
  // Determine which model to use
  let modelId: string;
  let provider: LLMProvider;
  
  if (options.model) {
    modelId = options.model;
    provider = getProviderForModel(modelId);
  } else {
    const defaultModel = getDefaultModelForStage(stage);
    modelId = defaultModel.id;
    provider = defaultModel.provider;
  }
  
  const modelConfig = getModelById(modelId);
  const maxTokens = options.maxTokens || modelConfig?.maxTokens || STAGE_MAX_TOKENS[stage];
  
  const mergedOptions = {
    ...options,
    maxTokens,
    model: modelId,
  };
  
  if (provider === 'openai') {
    const generator = streamWithOpenAI(prompt, mergedOptions);
    
    let result: IteratorResult<string, { tokensUsed: number }>;
    while (!(result = await generator.next()).done) {
      yield result.value;
    }
    
    return {
      content: '', // Content was streamed
      tokensUsed: result.value.tokensUsed,
      model: modelId,
      provider: 'openai',
    };
  } else {
    const generator = streamWithClaude(prompt, mergedOptions);
    
    let result: IteratorResult<string, { tokensUsed: number }>;
    while (!(result = await generator.next()).done) {
      yield result.value;
    }
    
    return {
      content: '', // Content was streamed
      tokensUsed: result.value.tokensUsed,
      model: modelId,
      provider: 'anthropic',
    };
  }
}

/**
 * Generate with explicit provider and model choice
 */
export async function generate(
  provider: LLMProvider,
  prompt: string,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  // Get default model for provider if not specified
  const modelId = options.model || (provider === 'openai' 
    ? OPENAI_MODELS.find((m) => m.isDefault)?.id || 'gpt-5.2'
    : ANTHROPIC_MODELS.find((m) => m.isDefault)?.id || 'claude-opus-4-5-20251101');
  
  if (provider === 'openai') {
    const result = await generateWithOpenAI(prompt, { ...options, model: modelId });
    return {
      ...result,
      model: modelId,
      provider: 'openai',
    };
  } else {
    const result = await generateWithClaude(prompt, { ...options, model: modelId });
    return {
      ...result,
      model: modelId,
      provider: 'anthropic',
    };
  }
}
