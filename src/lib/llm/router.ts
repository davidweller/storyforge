import { generateWithOpenAI, streamWithOpenAI } from './openai';
import { generateWithClaude, streamWithClaude } from './anthropic';
import type { WorkflowStage } from '@/types';
import { 
  getModelById,
  getDefaultModel,
  getDefaultModelForStage, 
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
 * Determine the provider for a given model ID.
 * Falls back to 'openai' for unrecognised model IDs.
 */
function getProviderForModel(modelId: string): LLMProvider {
  if (OPENAI_MODELS.some((m) => m.id === modelId)) return 'openai';
  if (ANTHROPIC_MODELS.some((m) => m.id === modelId)) return 'anthropic';
  return 'openai';
}

interface ResolvedModel {
  modelId: string;
  provider: LLMProvider;
  maxTokens: number;
}

/**
 * Resolve the model, provider, and token budget for a stage + options pair.
 * Extracted to avoid duplication between generateForStage and streamForStage.
 */
function resolveModelForStage(stage: WorkflowStage, options: GenerateOptions): ResolvedModel {
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
  const maxTokens = options.maxTokens ?? modelConfig?.maxTokens ?? STAGE_MAX_TOKENS[stage];
  return { modelId, provider, maxTokens };
}

/**
 * Generate content using the appropriate LLM based on the stage.
 * Supports model override via options.model.
 */
export async function generateForStage(
  stage: WorkflowStage,
  prompt: string,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  const { modelId, provider, maxTokens } = resolveModelForStage(stage, options);

  // Get max tokens (from options, model config, or stage default)
  const modelConfig = getModelById(modelId);

  console.log('[Router] Using model:', {
    modelId,
    modelName: modelConfig?.name ?? 'Unknown',
    provider,
    stage,
    maxTokens,
  });

  const mergedOptions = { ...options, maxTokens, model: modelId };

  if (provider === 'openai') {
    const result = await generateWithOpenAI(prompt, mergedOptions);
    return { ...result, model: modelId, provider: 'openai' };
  } else {
    const result = await generateWithClaude(prompt, mergedOptions);
    return { ...result, model: modelId, provider: 'anthropic' };
  }
}

/**
 * Stream content using the appropriate LLM based on the stage.
 * Supports model override via options.model.
 */
export async function* streamForStage(
  stage: WorkflowStage,
  prompt: string,
  options: GenerateOptions = {}
): AsyncGenerator<string, GenerateResult, unknown> {
  const { modelId, provider, maxTokens } = resolveModelForStage(stage, options);
  const mergedOptions = { ...options, maxTokens, model: modelId };

  if (provider === 'openai') {
    const generator = streamWithOpenAI(prompt, mergedOptions);
    let result: IteratorResult<string, { tokensUsed: number }>;
    while (!(result = await generator.next()).done) {
      yield result.value;
    }
    return { content: '', tokensUsed: result.value.tokensUsed, model: modelId, provider: 'openai' };
  } else {
    const generator = streamWithClaude(prompt, mergedOptions);
    let result: IteratorResult<string, { tokensUsed: number }>;
    while (!(result = await generator.next()).done) {
      yield result.value;
    }
    return { content: '', tokensUsed: result.value.tokensUsed, model: modelId, provider: 'anthropic' };
  }
}

/**
 * Generate with an explicit provider and model choice.
 * Uses the provider's default model if options.model is not specified.
 */
export async function generate(
  provider: LLMProvider,
  prompt: string,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  // Derive default model from models.ts so it stays in sync with STAGE_DEFAULT_PROVIDERS
  const modelId = options.model ?? getDefaultModel(provider).id;
  
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
