import OpenAI from 'openai';
import { getModelById } from '@/lib/data/models';

let openRouterClient: OpenAI | null = null;
let alibabaClient: OpenAI | null = null;

function getOpenRouter(): OpenAI {
  if (!openRouterClient) {
    openRouterClient = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }
  return openRouterClient;
}

function getAlibabaModelStudio(): OpenAI {
  if (!alibabaClient) {
    alibabaClient = new OpenAI({
      apiKey: process.env.ALIBABA_MODEL_STUDIO_API_KEY,
      baseURL: process.env.ALIBABA_MODEL_STUDIO_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    });
  }
  return alibabaClient;
}

export interface OpenRouterGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  jsonMode?: boolean;
}

interface OpenRouterCallResult {
  content: string;
  tokensUsed: number;
  fallbackProvider?: 'alibaba-model-studio';
}

type OpenRouterReasoning = { effort: NonNullable<ReturnType<typeof resolveReasoningEffort>> };
type OpenRouterChatRequest = OpenAI.ChatCompletionCreateParamsNonStreaming & {
  reasoning?: OpenRouterReasoning;
};
type OpenRouterStreamRequest = OpenAI.ChatCompletionCreateParamsStreaming & {
  reasoning?: OpenRouterReasoning;
};
type ChatCompletionLike = {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { total_tokens?: number };
};
type ChatCompletionChunkLike = {
  choices?: Array<{ delta?: { content?: string | null } }>;
  usage?: { total_tokens?: number } | null;
};

function normalizeDeprecatedOpenRouterModel(modelId: string): string {
  const trimmed = modelId.trim();
  if (trimmed === 'qwen/qwen3.6-plus:free') return 'qwen/qwen3.6-plus';
  return trimmed;
}

function resolveOpenRouterApiModel(modelId: string): string {
  return normalizeDeprecatedOpenRouterModel(getModelById(modelId)?.apiModelId ?? modelId);
}

function openRouterModelCandidates(primaryModel: string): string[] {
  const envFallback = (process.env.OPENROUTER_QWEN_FALLBACK_MODELS || '')
    .split(',')
    .map((s) => normalizeDeprecatedOpenRouterModel(s))
    .filter(Boolean);

  const defaults = [
    'qwen/qwen3.6-plus',
    'qwen/qwen3-235b-a22b',
  ];

  return Array.from(new Set([primaryModel, ...envFallback, ...defaults]));
}

function resolveReasoningEffort(modelId: string):
  | 'none'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | undefined {
  return getModelById(modelId)?.openRouterReasoningEffort;
}

function resolveAlibabaFallbackModel(): string {
  return process.env.ALIBABA_MODEL_STUDIO_MODEL || 'qwen-plus-latest';
}

function shouldUseAlibabaFallback(error: unknown): boolean {
  if (!process.env.ALIBABA_MODEL_STUDIO_API_KEY) return false;
  if (!(error instanceof Error)) return true;
  const msg = error.message || '';
  return /openrouter|provider|rate limit|429|timeout|timed out|ECONNRESET|503|502|504|network|terminated|UND_ERR_SOCKET|socket/i.test(msg);
}

function isTransientNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message || '';
  const causeMsg =
    typeof (error as Error & { cause?: unknown }).cause === 'object'
      ? String((error as Error & { cause?: { message?: string; code?: string } }).cause?.message || (error as Error & { cause?: { message?: string; code?: string } }).cause?.code || '')
      : '';
  return /terminated|UND_ERR_SOCKET|ECONNRESET|socket|other side closed|timed out|timeout|network/i.test(
    `${msg} ${causeMsg}`
  );
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** DashScope / some proxies may omit `choices`; avoid `choices[0]` throwing when `choices` is undefined. */
function extractCompletionContent(response: { choices?: Array<{ message?: { content?: string | null } }> }): string {
  const raw = response.choices?.[0]?.message?.content;
  return typeof raw === 'string' ? raw : '';
}

export async function generateWithOpenRouter(
  prompt: string,
  options: OpenRouterGenerateOptions = {}
): Promise<OpenRouterCallResult> {
  const {
    model = 'qwen-3.6-thinking-openrouter',
    temperature = 0.7,
    maxTokens = 4096,
    systemPrompt,
    jsonMode = false,
  } = options;

  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set in environment variables');
  }

  const apiModel = resolveOpenRouterApiModel(model);
  const reasoningEffort = resolveReasoningEffort(model);
  const messages: OpenAI.ChatCompletionMessageParam[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  try {
    let response: ChatCompletionLike | null = null;
    let lastError: unknown = null;
    const candidates = openRouterModelCandidates(apiModel);

    for (const candidate of candidates) {
      try {
        let attempt = 0;
        const maxAttempts = 2;
        while (attempt < maxAttempts) {
          try {
            const request: OpenRouterChatRequest = {
              model: candidate,
              messages,
              temperature,
              max_tokens: maxTokens,
              ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
              ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
            };
            response = await getOpenRouter().chat.completions.create(request);
            break;
          } catch (err) {
            attempt += 1;
            if (!isTransientNetworkError(err) || attempt >= maxAttempts) {
              throw err;
            }
            // Brief backoff for socket-reset/terminated races.
            await delay(600 * attempt);
          }
        }
        break;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : '';
        const noEndpoint = /No endpoints found/i.test(msg);
        if (!noEndpoint) throw err;
      }
    }

    if (!response) {
      throw (lastError instanceof Error ? lastError : new Error('OpenRouter request failed'));
    }

    const content = extractCompletionContent(response);
    const tokensUsed = response.usage?.total_tokens || 0;
    if (!content.trim()) {
      throw new Error('OpenRouter API returned empty content');
    }

    return { content, tokensUsed };
  } catch (error) {
    if (!shouldUseAlibabaFallback(error)) {
      throw error;
    }

    const fallbackModel = resolveAlibabaFallbackModel();
    console.warn('[OpenRouter] Falling back to Alibaba Model Studio:', {
      openRouterModel: apiModel,
      fallbackModel,
      reason: error instanceof Error ? error.message : 'unknown',
    });

    // DashScope compatible-mode does not use OpenRouter's `reasoning` extension; omit it.
    const fallbackRequest: OpenRouterChatRequest = {
      model: fallbackModel,
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    };
    const response = await getAlibabaModelStudio().chat.completions.create(fallbackRequest);

    const content = extractCompletionContent(response);
    const tokensUsed = response.usage?.total_tokens || 0;
    if (!content.trim()) {
      throw new Error(
        'Alibaba Model Studio fallback returned empty content (missing choices or empty message). ' +
          `Check ALIBABA_MODEL_STUDIO_MODEL and base URL. Raw keys: ${response && typeof response === 'object' ? Object.keys(response as object).join(', ') : 'n/a'}`
      );
    }

    return { content, tokensUsed, fallbackProvider: 'alibaba-model-studio' };
  }
}

export async function* streamWithOpenRouter(
  prompt: string,
  options: OpenRouterGenerateOptions = {}
): AsyncGenerator<string, { tokensUsed: number; fallbackProvider?: 'alibaba-model-studio' }, unknown> {
  const {
    model = 'qwen-3.6-thinking-openrouter',
    temperature = 0.7,
    maxTokens = 4096,
    systemPrompt,
  } = options;

  const apiModel = resolveOpenRouterApiModel(model);
  const reasoningEffort = resolveReasoningEffort(model);
  const messages: OpenAI.ChatCompletionMessageParam[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  try {
    let stream: AsyncIterable<ChatCompletionChunkLike> | null = null;
    let lastError: unknown = null;
    const candidates = openRouterModelCandidates(apiModel);

    for (const candidate of candidates) {
      try {
        let attempt = 0;
        const maxAttempts = 2;
        while (attempt < maxAttempts) {
          try {
            const request: OpenRouterStreamRequest = {
              model: candidate,
              messages,
              temperature,
              max_tokens: maxTokens,
              stream: true,
              ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
            };
            stream = await getOpenRouter().chat.completions.create(request);
            break;
          } catch (err) {
            attempt += 1;
            if (!isTransientNetworkError(err) || attempt >= maxAttempts) {
              throw err;
            }
            await delay(600 * attempt);
          }
        }
        break;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : '';
        const noEndpoint = /No endpoints found/i.test(msg);
        if (!noEndpoint) throw err;
      }
    }

    if (!stream) {
      throw (lastError instanceof Error ? lastError : new Error('OpenRouter stream request failed'));
    }

    let tokensUsed = 0;
    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) yield content;
      if (chunk.usage?.total_tokens) tokensUsed = chunk.usage.total_tokens;
    }

    return { tokensUsed };
  } catch (error) {
    if (!shouldUseAlibabaFallback(error)) {
      throw error;
    }

    const fallbackModel = resolveAlibabaFallbackModel();
    console.warn('[OpenRouter] Stream fallback to Alibaba Model Studio:', {
      openRouterModel: apiModel,
      fallbackModel,
      reason: error instanceof Error ? error.message : 'unknown',
    });

    // Keep the same streaming contract by degrading to a one-shot fallback.
    const fallbackRequest: OpenRouterChatRequest = {
      model: fallbackModel,
      messages,
      temperature,
      max_tokens: maxTokens,
    };
    const response = await getAlibabaModelStudio().chat.completions.create(fallbackRequest);

    const content = extractCompletionContent(response);
    const tokensUsed = response.usage?.total_tokens || 0;
    if (!content.trim()) {
      throw new Error('Alibaba Model Studio stream fallback returned empty content');
    }
    yield content;
    return { tokensUsed, fallbackProvider: 'alibaba-model-studio' };
  }
}

export { getOpenRouter };
