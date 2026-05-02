import { afterEach, describe, expect, it, vi } from 'vitest';

const generateWithClaude = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ content: '{"ok":true}', tokensUsed: 10 }),
);

vi.mock('@/lib/llm/anthropic', () => ({
  generateWithClaude,
  streamWithClaude: vi.fn(),
  getAnthropic: vi.fn(),
}));

vi.mock('@/lib/llm/openai', () => ({
  generateWithOpenAI: vi.fn(),
  streamWithOpenAI: vi.fn(),
}));

vi.mock('@/lib/llm/openrouter', () => ({
  generateWithOpenRouter: vi.fn(),
  streamWithOpenRouter: vi.fn(),
}));

import { generateForStage } from '@/lib/llm/router';

/** Native Anthropic registry id (router resolves provider from model). */
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

describe('generateForStage — JSON repair must not use cached system blocks', () => {
  afterEach(() => {
    generateWithClaude.mockClear();
  });

  it('repair-style options pass only string systemPrompt; anthropicSystem stays unset for cache', async () => {
    await generateForStage('chapter-summary', 'fix this json', {
      model: ANTHROPIC_MODEL,
      systemPrompt: 'You repair malformed JSON outputs. Return only valid JSON that satisfies the requested schema.',
      temperature: 0,
      jsonMode: true,
      anthropicSystem: undefined,
    });

    expect(generateWithClaude).toHaveBeenCalledTimes(1);
    const [, options] = generateWithClaude.mock.calls[0];
    expect(options.systemPrompt).toBe(
      'You repair malformed JSON outputs. Return only valid JSON that satisfies the requested schema.',
    );
    expect(options.anthropicSystem).toBeUndefined();
  });

  it('after a cached main call, repair call still has no structured anthropicSystem', async () => {
    const cachedBlock = [
      {
        type: 'text' as const,
        text: 'instructions\n---\ncanon',
        cache_control: { type: 'ephemeral' as const },
      },
    ];

    await generateForStage('chapters', 'main user prompt', {
      model: ANTHROPIC_MODEL,
      systemPrompt: 'CHAPTERS_SYSTEM',
      anthropicSystem: cachedBlock,
    });

    await generateForStage('chapters', 'repair prompt body', {
      model: ANTHROPIC_MODEL,
      systemPrompt: 'You repair malformed JSON outputs. Return only valid JSON that satisfies the requested schema.',
      temperature: 0,
      jsonMode: true,
      anthropicSystem: undefined,
    });

    expect(generateWithClaude).toHaveBeenCalledTimes(2);
    const repairOptions = generateWithClaude.mock.calls[1][1];
    expect(repairOptions.anthropicSystem).toBeUndefined();
  });
});
