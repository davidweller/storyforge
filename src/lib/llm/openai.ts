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

  const response = await getOpenAI().chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
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

  const stream = await getOpenAI().chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
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
