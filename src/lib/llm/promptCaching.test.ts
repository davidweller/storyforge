import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAnthropicCachedSystemBlocks, anthropicCacheMinInputTokens } from '@/lib/llm/anthropicCache';
import { buildChapterPrompt, buildChapterPromptParts } from '@/lib/prompts/chapters';
import {
  mergeChapterDraftCanonIntoUserPrompt,
  formatChapterDraftCanonBlock,
} from '@/lib/prompts/canonBlock';
import { resolveAnthropicCachedPrompt } from '@/lib/llm/anthropicPromptFromStage';

describe('prompt caching', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('buildChapterPrompt matches merge of chapter parts (byte-stable layout)', () => {
    const params = {
      genre: 'fantasy',
      chapterNumber: 2,
      chapterTitle: 'The Gate',
      beatReference: 'Midpoint',
      sceneGoal: 'Cross the river',
      pov: 'Alice',
      assembledContext: 'Canon line one.\nCanon line two.',
      charactersReference: 'Bob is angry.',
      endingReference: 'They reconcile.',
      structureContext: 'Act II',
      wordTarget: 2000,
    };
    const parts = buildChapterPromptParts(params);
    const merged = mergeChapterDraftCanonIntoUserPrompt(
      parts.userPrompt,
      formatChapterDraftCanonBlock(parts.canon),
    );
    expect(buildChapterPrompt(params)).toBe(merged);
  });

  it('buildAnthropicCachedSystemBlocks returns undefined below min token threshold', () => {
    vi.stubEnv('ANTHROPIC_CACHE_MIN_INPUT_TOKENS', String(50_000));
    expect(
      buildAnthropicCachedSystemBlocks({
        staticSystem: 'Short',
        formattedCanon: 'Also short',
      }),
    ).toBeUndefined();
  });

  it('buildAnthropicCachedSystemBlocks returns ephemeral text block when above threshold', () => {
    vi.stubEnv('ANTHROPIC_CACHE_MIN_INPUT_TOKENS', '256');
    const filler = 'word '.repeat(400);
    const blocks = buildAnthropicCachedSystemBlocks({
      staticSystem: 'System',
      formattedCanon: filler,
    });
    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks).toHaveLength(1);
    expect(blocks![0]).toMatchObject({
      type: 'text',
      cache_control: { type: 'ephemeral' },
    });
  });

  it('resolveAnthropicCachedPrompt leaves prompt unchanged for OpenRouter model ids', () => {
    vi.stubEnv('ANTHROPIC_PROMPT_CACHING', '1');
    vi.stubEnv('ANTHROPIC_PROMPT_CACHING_DRAFTING', '1');
    const full = buildChapterPrompt({
      genre: 'fantasy',
      chapterNumber: 1,
      chapterTitle: 'A',
      beatReference: 'b',
      sceneGoal: 'g',
      assembledContext: 'x'.repeat(20_000),
      charactersReference: 'c',
      endingReference: 'e',
      structureContext: 's',
    });
    const out = resolveAnthropicCachedPrompt(
      'chapters',
      'qwen/qwen3.6-plus',
      {
        genre: 'fantasy',
        chapterNumber: 1,
        chapterTitle: 'A',
        beatReference: 'b',
        sceneGoal: 'g',
        assembledContext: 'x'.repeat(20_000),
        charactersReference: 'c',
        endingReference: 'e',
        structureContext: 's',
      },
      'SYS',
      full,
    );
    expect(out.prompt).toBe(full);
    expect(out.anthropicSystem).toBeUndefined();
  });

  it('resolveAnthropicCachedPrompt returns structured system for Anthropic + large merged prompt', () => {
    vi.stubEnv('ANTHROPIC_PROMPT_CACHING', '1');
    vi.stubEnv('ANTHROPIC_PROMPT_CACHING_DRAFTING', '1');
    vi.stubEnv('ANTHROPIC_CACHE_MIN_INPUT_TOKENS', '256');
    const canon = 'canon '.repeat(500);
    const full = buildChapterPrompt({
      genre: 'fantasy',
      chapterNumber: 1,
      chapterTitle: 'A',
      beatReference: 'b',
      sceneGoal: 'g',
      assembledContext: canon,
      charactersReference: 'c',
      endingReference: 'e',
      structureContext: 's',
    });
    const out = resolveAnthropicCachedPrompt(
      'chapters',
      'claude-opus-4-7-medium',
      {
        genre: 'fantasy',
        chapterNumber: 1,
        chapterTitle: 'A',
        beatReference: 'b',
        sceneGoal: 'g',
        assembledContext: canon,
        charactersReference: 'c',
        endingReference: 'e',
        structureContext: 's',
      },
      'CHAPTERS_SYSTEM',
      full,
    );
    expect(out.anthropicSystem).toBeDefined();
    expect(out.prompt.length).toBeLessThan(full.length);
  });

  it('anthropicCacheMinInputTokens reads env override', () => {
    vi.stubEnv('ANTHROPIC_CACHE_MIN_INPUT_TOKENS', '2048');
    expect(anthropicCacheMinInputTokens()).toBe(2048);
  });
});
