import OpenAI from 'openai';
import { OPENAI_MODELS, getModelById } from '@/lib/data/models';

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export interface OpenAIGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  jsonMode?: boolean;
}

// Models that use max_completion_tokens instead of max_tokens.
// Derived from models.ts (OPENAI_MODELS) by matching known reasoning model ID prefixes,
// so the list stays in sync with the model registry rather than being maintained separately.
const REASONING_MODEL_PREFIXES = OPENAI_MODELS
  .filter((m) => m.id.startsWith('gpt-5') || m.id.startsWith('o1') || m.id.startsWith('o3'))
  .map((m) => m.id);

function isReasoningModel(model: string): boolean {
  return REASONING_MODEL_PREFIXES.some((prefix) => model.startsWith(prefix));
}

export async function generateWithOpenAI(
  prompt: string,
  options: OpenAIGenerateOptions = {}
): Promise<{ content: string; tokensUsed: number }> {
  const {
    model = 'gpt-5.4',
    temperature = 0.7,
    maxTokens = 4096,
    systemPrompt,
    jsonMode = false,
  } = options;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  const messages: OpenAI.ChatCompletionMessageParam[] = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  
  messages.push({ role: 'user', content: prompt });

  // Reasoning models (o3-mini, o1, etc.) use different parameters
  const isReasoning = isReasoningModel(model);
  
  const modelDisplayName = getModelById(model)?.name ?? model;
  
  console.log('[OpenAI] Calling API:', {
    model: modelDisplayName,
    modelId: model,
    promptLength: prompt.length,
    systemPromptLength: systemPrompt?.length || 0,
    maxTokens,
    temperature: isReasoning ? 'N/A (reasoning model)' : temperature,
    isReasoning,
  });

  try {
    const response = await getOpenAI().chat.completions.create({
      model,
      messages,
      // Reasoning models don't support temperature
      ...(isReasoning ? {} : { temperature }),
      // Use max_completion_tokens for reasoning models, max_tokens for others
      ...(isReasoning 
        ? { max_completion_tokens: maxTokens }
        : { max_tokens: maxTokens }
      ),
      response_format: jsonMode ? { type: 'json_object' } : undefined,
    });

    console.log('[OpenAI] Response received:', {
      hasChoices: response.choices && response.choices.length > 0,
      hasContent: !!response.choices[0]?.message?.content,
      tokensUsed: response.usage?.total_tokens || 0,
    });

    const content = response.choices[0]?.message?.content || '';
    const tokensUsed = response.usage?.total_tokens || 0;

    if (!content || content.trim().length === 0) {
      throw new Error('OpenAI API returned empty content');
    }

    console.log('[OpenAI] Content extracted:', {
      contentLength: content.length,
      tokensUsed,
    });

    return { content, tokensUsed };
  } catch (error) {
    console.error('[OpenAI] API Error:', error);
    if (error instanceof Error) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }
    throw error;
  }
}

export async function* streamWithOpenAI(
  prompt: string,
  options: OpenAIGenerateOptions = {}
): AsyncGenerator<string, { tokensUsed: number }, unknown> {
  const {
    model = 'gpt-5.4',
    temperature = 0.7,
    maxTokens = 4096,
    systemPrompt,
  } = options;

  const messages: OpenAI.ChatCompletionMessageParam[] = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  
  messages.push({ role: 'user', content: prompt });

  // Reasoning models (o3-mini, o1, etc.) use different parameters
  const isReasoning = isReasoningModel(model);

  const stream = await getOpenAI().chat.completions.create({
    model,
    messages,
    // Reasoning models don't support temperature
    ...(isReasoning ? {} : { temperature }),
    // Use max_completion_tokens for reasoning models, max_tokens for others
    ...(isReasoning 
      ? { max_completion_tokens: maxTokens }
      : { max_tokens: maxTokens }
    ),
    stream: true,
  });

  let tokensUsed = 0;
  
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
    // Estimate tokens (actual count comes at the end)
    if (chunk.usage) {
      tokensUsed = chunk.usage.total_tokens;
    }
  }

  return { tokensUsed };
}

export { getOpenAI };
