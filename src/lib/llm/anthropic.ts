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
    model = 'claude-3-5-sonnet-20241022',
    temperature = 0.7,
    maxTokens = 4096,
    systemPrompt,
  } = options;

  const response = await getAnthropic().messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0].type === 'text' ? response.content[0].text : '';
  const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

  return { content, tokensUsed };
}

export async function* streamWithClaude(
  prompt: string,
  options: AnthropicGenerateOptions = {}
): AsyncGenerator<string, { tokensUsed: number }, unknown> {
  const {
    model = 'claude-3-5-sonnet-20241022',
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
