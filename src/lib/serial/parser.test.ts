import { describe, expect, it } from 'vitest';
import { parseSerialMarkdown, buildStructuralDiff } from '@/lib/serial/parser';
import { validateSerialMapping } from '@/lib/serial/mapping';
import { renderRoyalRoadMarkdown } from '@/lib/serial/export';

describe('serial parser and utilities', () => {
  it('parses chapters/scenes and counts words', () => {
    const parsed = parseSerialMarkdown(`# Chapter 1: Start

Hello there
***
Second scene text

# Chapter 2: Next
More words here`);
    expect(parsed.chapterCount).toBe(2);
    expect(parsed.sceneCount).toBe(3);
    expect(parsed.chapters[0]?.scenes.length).toBe(2);
    expect(parsed.totalWords).toBeGreaterThan(0);
  });

  it('builds structural diff with deltas', () => {
    const a = parseSerialMarkdown(`# Chapter 1
One two three`);
    const b = parseSerialMarkdown(`# Chapter 1
One two three four five

# Chapter 2
Extra`);
    const diff = buildStructuralDiff(a, b);
    expect(diff.chapterCountDelta).toBe(1);
    expect(diff.chaptersAdded).toContain(2);
  });

  it('validates mapping constraints', () => {
    const invalid = validateSerialMapping(
      [{ ordinal: 1, title: 'A', sceneIds: ['s1'], estimatedWordCount: 5000, boundaryHookScore: 6 }],
      2000,
      3500,
      4500
    );
    expect(invalid.valid).toBe(false);
    expect(invalid.validationErrors.some((e) => e.includes('hardMax'))).toBe(true);
  });

  it('renders RR markdown with normalized breaks and notes', () => {
    const md = renderRoyalRoadMarkdown({
      preNote: 'Before note',
      chapterContent: 'Line 1\n---\nLine 2',
      postNote: 'After note',
    });
    expect(md).toContain('> Before note');
    expect(md).toContain('\n***\n');
    expect(md).toContain('> After note');
  });
});
