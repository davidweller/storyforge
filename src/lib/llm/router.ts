import { generateWithOpenAI, streamWithOpenAI, OpenAIGenerateOptions } from './openai';
import { generateWithClaude, streamWithClaude, AnthropicGenerateOptions } from './anthropic';
import type { WorkflowStage } from '@/types';
import { STAGE_MODELS } from '@/lib/utils';

export type LLMProvider = 'openai' | 'claude';

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  jsonMode?: boolean; // Only for OpenAI
}

export interface GenerateResult {
  content: string;
  tokensUsed: number;
  model: string;
  provider: LLMProvider;
}

// Model configurations per stage
const STAGE_CONFIGS: Record<WorkflowStage, { model: string; maxTokens: number }> = {
  'setup': { model: 'gpt-4-turbo-preview', maxTokens: 2048 },
  'genre-research': { model: 'gpt-4-turbo-preview', maxTokens: 4096 },
  'niche': { model: 'gpt-4-turbo-preview', maxTokens: 4096 },
  'ending': { model: 'claude-3-5-sonnet-20241022', maxTokens: 8192 },
  'characters': { model: 'gpt-4-turbo-preview', maxTokens: 8192 },
  'structure': { model: 'gpt-4-turbo-preview', maxTokens: 8192 },
  'chapters': { model: 'claude-3-5-sonnet-20241022', maxTokens: 16384 },
  'compilation': { model: 'gpt-4-turbo-preview', maxTokens: 2048 },
  'editorial': { model: 'gpt-4-turbo-preview', maxTokens: 8192 },
  'revision': { model: 'claude-3-5-sonnet-20241022', maxTokens: 16384 },
};

/**
 * Generate content using the appropriate LLM based on the stage
 */
export async function generateForStage(
  stage: WorkflowStage,
  prompt: string,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  const provider = STAGE_MODELS[stage];
  const config = STAGE_CONFIGS[stage];
  
  const mergedOptions = {
    ...options,
    maxTokens: options.maxTokens || config.maxTokens,
  };
  
  if (provider === 'openai') {
    const result = await generateWithOpenAI(prompt, {
      ...mergedOptions,
      model: config.model,
    });
    return {
      ...result,
      model: config.model,
      provider: 'openai',
    };
  } else {
    const result = await generateWithClaude(prompt, {
      ...mergedOptions,
      model: config.model,
    });
    return {
      ...result,
      model: config.model,
      provider: 'claude',
    };
  }
}

/**
 * Stream content using the appropriate LLM based on the stage
 */
export async function* streamForStage(
  stage: WorkflowStage,
  prompt: string,
  options: GenerateOptions = {}
): AsyncGenerator<string, GenerateResult, unknown> {
  const provider = STAGE_MODELS[stage];
  const config = STAGE_CONFIGS[stage];
  
  const mergedOptions = {
    ...options,
    maxTokens: options.maxTokens || config.maxTokens,
  };
  
  if (provider === 'openai') {
    const generator = streamWithOpenAI(prompt, {
      ...mergedOptions,
      model: config.model,
    });
    
    let result: IteratorResult<string, { tokensUsed: number }>;
    while (!(result = await generator.next()).done) {
      yield result.value;
    }
    
    return {
      content: '', // Content was streamed
      tokensUsed: result.value.tokensUsed,
      model: config.model,
      provider: 'openai',
    };
  } else {
    const generator = streamWithClaude(prompt, {
      ...mergedOptions,
      model: config.model,
    });
    
    let result: IteratorResult<string, { tokensUsed: number }>;
    while (!(result = await generator.next()).done) {
      yield result.value;
    }
    
    return {
      content: '', // Content was streamed
      tokensUsed: result.value.tokensUsed,
      model: config.model,
      provider: 'claude',
    };
  }
}

/**
 * Generate with explicit provider choice
 */
export async function generate(
  provider: LLMProvider,
  prompt: string,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  if (provider === 'openai') {
    const result = await generateWithOpenAI(prompt, options);
    return {
      ...result,
      model: 'gpt-4-turbo-preview',
      provider: 'openai',
    };
  } else {
    const result = await generateWithClaude(prompt, options);
    return {
      ...result,
      model: 'claude-3-5-sonnet-20241022',
      provider: 'claude',
    };
  }
}
