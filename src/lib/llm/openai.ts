import OpenAI from 'openai';

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

// Models that use max_completion_tokens instead of max_tokens
const REASONING_MODELS = ['o3-mini', 'o3', 'o1', 'o1-mini', 'o1-preview'];

function isReasoningModel(model: string): boolean {
  return REASONING_MODELS.some(m => model.startsWith(m));
}

export async function generateWithOpenAI(
  prompt: string,
  options: OpenAIGenerateOptions = {}
): Promise<{ content: string; tokensUsed: number }> {
  const {
    model = 'gpt-4-turbo-preview',
    temperature = 0.7,
    maxTokens = 4096,
    systemPrompt,
    jsonMode = false,
  } = options;

  const messages: OpenAI.ChatCompletionMessageParam[] = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  
  messages.push({ role: 'user', content: prompt });

  // Reasoning models (o3-mini, o1, etc.) use different parameters
  const isReasoning = isReasoningModel(model);
  
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

  const content = response.choices[0]?.message?.content || '';
  const tokensUsed = response.usage?.total_tokens || 0;

  return { content, tokensUsed };
}

export async function* streamWithOpenAI(
  prompt: string,
  options: OpenAIGenerateOptions = {}
): AsyncGenerator<string, { tokensUsed: number }, unknown> {
  const {
    model = 'gpt-4-turbo-preview',
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
