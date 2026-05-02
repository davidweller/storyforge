import { describe, it, expect } from 'vitest';
import { buildChapterSceneEvalPrompt } from '@/lib/prompts/scenes';
import type { ChapterScenePlanDocument } from '@/lib/generation/schemas';

const bigPlan = (n: number): ChapterScenePlanDocument =>
  ({
    schemaVersion: 1,
    chapterNumber: 1,
    generatedAt: 't',
    derivedFromChapterOutlines: { documentId: 'd', version: 1, updatedAt: 't' },
    scenes: Array.from({ length: n }, (_, i) => ({
      id: `scene-${i}`,
      order: i,
      purpose: `Purpose ${i} `.repeat(20),
      conflict: '',
      turningPoint: '',
      pov: '',
      setting: '',
      emotionalShift: '',
      beatsCovered: [`beat-${i}`],
      mustInclude: [],
    })),
  }) satisfies ChapterScenePlanDocument;

describe('chapter eval prompt sizing', () => {
  it('lite mode shortens prompt vs deep rubric length', () => {
    const full = JSON.stringify(bigPlan(3));
    const lite = buildChapterSceneEvalPrompt({
      genre: 'Thriller',
      chapterNumber: 1,
      chapterTitle: 'Test',
      scenePlanJson: full,
      chapterText: 'Body.',
      compactCanon: 'Canon',
      chunkLabel: 'scene-1',
      evaluationMode: 'lite',
    });
    const deep = buildChapterSceneEvalPrompt({
      genre: 'Thriller',
      chapterNumber: 1,
      chapterTitle: 'Test',
      scenePlanJson: full,
      chapterText: 'Body.',
      compactCanon: 'Canon',
      chunkLabel: 'scene-1',
      evaluationMode: 'deep',
    });
    expect(lite.length).toBeGreaterThan(100);
    expect(deep.length).toBeGreaterThan(lite.length);
  });
});
