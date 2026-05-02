import Anthropic from '@anthropic-ai/sdk';
import { getModelById } from '@/lib/data/models';

let anthropicClient: Anthropic | null = null;

/** SDK default is 10 minutes; long editorials / thinking models need more headroom. */
function anthropicTimeoutMs(): number {
  const raw = process.env.ANTHROPIC_TIMEOUT_MS;
  if (raw !== undefined && raw !== '') {
    const n = Number(raw);
    if (!Number.isNaN(n) && n >= 60_000) return n;
  }
  return 60 * 60 * 1000; // 1 hour
}

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: anthropicTimeoutMs(),
      maxRetries: 3,
    });
  }
  return anthropicClient;
}

export interface AnthropicGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  /** Anthropic does not support a native JSON mode equivalent to OpenAI's
   *  `response_format: { type: 'json_object' }`. When this is true, the caller
   *  must enforce structure via prompt text (e.g. "Output only valid JSON.").
   *  The field is accepted here so callers can pass a unified options object
   *  without casting, but it has no effect on the API request. */
  jsonMode?: boolean;
}

function resolveAnthropicModel(registryId: string): {
  apiModel: string;
  thinkingBudget: number | undefined;
  displayName: string;
} {
  const entry = getModelById(registryId);
  const apiModel = entry?.apiModelId ?? registryId;
  return {
    apiModel,
    thinkingBudget: entry?.thinkingBudgetTokens,
    displayName: entry?.name ?? registryId,
  };
}

function extractTextContent(content: Anthropic.Messages.Message['content']): string {
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === 'text') {
      parts.push(block.text);
    }
  }
  return parts.join('\n').trim();
}

export async function generateWithClaude(
  prompt: string,
  options: AnthropicGenerateOptions = {}
): Promise<{ content: string; tokensUsed: number }> {
  const {
    model: registryModelId = 'claude-sonnet-4-6-thinking-medium',
    temperature = 0.7,
    maxTokens = 4096,
    systemPrompt,
    jsonMode,
  } = options;

  const { apiModel, thinkingBudget, displayName } = resolveAnthropicModel(registryModelId);
  const useThinking = thinkingBudget != null && thinkingBudget >= 1024;

  if (jsonMode) {
    console.warn(
      '[Anthropic] jsonMode=true has no effect — Anthropic does not support a native JSON mode. ' +
      'Enforce JSON structure via prompt text (e.g. "Output only valid JSON.").'
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
  }

  console.log('[Anthropic] Calling API:', {
    model: displayName,
    modelId: apiModel,
    registryId: registryModelId,
    promptLength: prompt.length,
    systemPromptLength: systemPrompt?.length || 0,
    maxTokens,
    temperature: useThinking ? 'N/A (extended thinking)' : temperature,
    extendedThinking: useThinking,
  });

  try {
    // Anthropic requires streaming for operations that may run >10 minutes (large prompts / long outputs).
    // We consume the stream server-side and return the full text like a non-streaming call.
    const stream = getAnthropic().messages.stream({
      model: apiModel,
      max_tokens: maxTokens,
      ...(useThinking
        ? {
            thinking: { type: 'enabled', budget_tokens: thinkingBudget },
          }
        : { temperature }),
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const _event of stream) {
      // Drain events; assembled message comes from finalMessage().
    }

    const response = await stream.finalMessage();

    console.log('[Anthropic] Response received (stream):', {
      hasContent: response.content && response.content.length > 0,
      contentTypes: response.content?.map((b) => b.type),
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    if (!response.content || response.content.length === 0) {
      throw new Error('Anthropic API returned empty content');
    }

    const content = extractTextContent(response.content);

    if (!content || content.trim().length === 0) {
      throw new Error('Anthropic API returned empty text content');
    }

    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

    console.log('[Anthropic] Content extracted:', {
      contentLength: content.length,
      tokensUsed,
    });

    return { content, tokensUsed };
  } catch (error) {
    console.error('[Anthropic] API Error:', error);
    if (error instanceof Error) {
      const msg = error.message;
      const isAbortLike =
        /terminat|aborted|AbortError|ECONNRESET|ETIMEDOUT|socket hang up/i.test(msg) ||
        error.name === 'AbortError';
      if (isAbortLike) {
        throw new Error(
          `Anthropic request ended early (${msg}). This is often a timeout or network drop. ` +
            `Try raising ANTHROPIC_TIMEOUT_MS (default 3600000 ms) or, on Vercel, export maxDuration on /api/generate. ` +
            `See env.example.`
        );
      }
      throw new Error(`Anthropic API error: ${msg}`);
    }
    throw error;
  }
}

export async function* streamWithClaude(
  prompt: string,
  options: AnthropicGenerateOptions = {}
): AsyncGenerator<string, { tokensUsed: number }, unknown> {
  const {
    model: registryModelId = 'claude-sonnet-4-6-thinking-medium',
    temperature = 0.7,
    maxTokens = 4096,
    systemPrompt,
  } = options;

  const { apiModel, thinkingBudget } = resolveAnthropicModel(registryModelId);
  const useThinking = thinkingBudget != null && thinkingBudget >= 1024;

  const stream = getAnthropic().messages.stream({
    model: apiModel,
    max_tokens: maxTokens,
    ...(useThinking
      ? {
          thinking: { type: 'enabled', budget_tokens: thinkingBudget },
        }
      : { temperature }),
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });

  let tokensUsed = 0;

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
    if (event.type === 'message_delta' && event.usage) {
      tokensUsed = event.usage.output_tokens;
    }
  }

  const finalMessage = await stream.finalMessage();
  tokensUsed = finalMessage.usage.input_tokens + finalMessage.usage.output_tokens;

  return { tokensUsed };
}

export { getAnthropic };
