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
}

interface OpenRouterCallResult {
  content: string;
  tokensUsed: number;
  fallbackProvider?: 'alibaba-model-studio';
}

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
  return /openrouter|provider|rate limit|429|timeout|timed out|ECONNRESET|503|502|504|network/i.test(msg);
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
    let response: any = null;
    let lastError: unknown = null;
    const candidates = openRouterModelCandidates(apiModel);

    for (const candidate of candidates) {
      try {
        response = await getOpenRouter().chat.completions.create({
          model: candidate,
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
        } as any);
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
    const response = await getAlibabaModelStudio().chat.completions.create({
      model: fallbackModel,
      messages,
      temperature,
      max_tokens: maxTokens,
    } as any);

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
    let stream: any = null;
    let lastError: unknown = null;
    const candidates = openRouterModelCandidates(apiModel);

    for (const candidate of candidates) {
      try {
        stream = await getOpenRouter().chat.completions.create({
          model: candidate,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
          ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
        } as any);
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
      if (chunk.usage) tokensUsed = chunk.usage.total_tokens;
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
    const response = await getAlibabaModelStudio().chat.completions.create({
      model: fallbackModel,
      messages,
      temperature,
      max_tokens: maxTokens,
    } as any);

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
