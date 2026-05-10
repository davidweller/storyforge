import { describe, expect, it } from 'vitest';
import { parseAPlusBrief } from '@/lib/generation/aplusSchemas';
import { buildAPlusBriefPrompt } from '@/lib/prompts/aplus';

describe('a-plus brief schema', () => {
  it('parses valid JSON payload', () => {
    const now = new Date().toISOString();
    const parsed = parseAPlusBrief(
      JSON.stringify({
        schemaVersion: 1,
        generatedAt: now,
        moduleType: 'hero-banner',
        promptDraft: 'Cinematic banner scene with moonlit castle and cloaked heroine, dramatic depth.',
        suggestedText: 'A kingdom on the brink',
        compositionNotes: ['foreground subject left third', 'deep atmospheric perspective'],
        negativeConstraints: ['no modern signage', 'no visible watermarks'],
      })
    );
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.moduleType).toBe('hero-banner');
    expect(parsed.promptDraft.length).toBeGreaterThan(20);
  });

  it('builds prompt with custom text directive context', () => {
    const prompt = buildAPlusBriefPrompt({
      genre: 'Fantasy',
      title: 'Ash Crown',
      canonContext: 'Story bible excerpt',
      coverToneBlock: 'Approved cover tone: cool blues, molten gold accents.',
      moduleType: 'quote-review',
      textMode: 'custom',
      customText: '“An unforgettable epic.”',
    });
    expect(prompt).toMatch(/Module type: quote-review/);
    expect(prompt).toMatch(/Render this exact text in-image/);
    expect(prompt).toMatch(/Approved front cover style reference/);
  });
});
