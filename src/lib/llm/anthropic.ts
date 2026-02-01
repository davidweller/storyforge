import Anthropic from '@anthropic-ai/sdk';

let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

export interface AnthropicGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export async function generateWithClaude(
  prompt: string,
  options: AnthropicGenerateOptions = {}
): Promise<{ content: string; tokensUsed: number }> {
  const {
    model = 'claude-sonnet-4-5',
    temperature = 0.7,
    maxTokens = 4096,
    systemPrompt,
  } = options;

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
  }

  // Get model display name for logging
  const modelDisplayName = model === 'claude-sonnet-4-5' ? 'Claude Sonnet 4.5' : model;
  
  console.log('[Anthropic] Calling API:', {
    model: modelDisplayName,
    modelId: model,
    promptLength: prompt.length,
    systemPromptLength: systemPrompt?.length || 0,
    maxTokens,
    temperature,
  });

  try {
    const response = await getAnthropic().messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    console.log('[Anthropic] Response received:', {
      hasContent: response.content && response.content.length > 0,
      contentType: response.content[0]?.type,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    if (!response.content || response.content.length === 0) {
      throw new Error('Anthropic API returned empty content');
    }

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    
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
      throw new Error(`Anthropic API error: ${error.message}`);
    }
    throw error;
  }
}

export async function* streamWithClaude(
  prompt: string,
  options: AnthropicGenerateOptions = {}
): AsyncGenerator<string, { tokensUsed: number }, unknown> {
  const {
    model = 'claude-sonnet-4-5',
    temperature = 0.7,
    maxTokens = 4096,
    systemPrompt,
  } = options;

  const stream = getAnthropic().messages.stream({
    model,
    max_tokens: maxTokens,
    temperature,
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
