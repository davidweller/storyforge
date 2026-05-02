import { describe, expect, it } from 'vitest';
import {
  PROMPT_EXPECTED_OUTPUT_COUNTS,
  structuredOutputCountWarnings,
} from '@/lib/generation/outputCountWarnings';

describe('structuredOutputCountWarnings', () => {
  it('flags ending counts outside prompt range', () => {
    const low = structuredOutputCountWarnings({
      kind: 'ending-concepts',
      stage: 'ending',
      data: {},
      content: JSON.stringify({ endings: Array.from({ length: 7 }, () => ({ title: 'a', summary: 'b' })) }),
    });
    expect(low.some((w) => w.includes('Ending concepts'))).toBe(true);

    const ok = structuredOutputCountWarnings({
      kind: 'ending-concepts',
      stage: 'ending',
      data: {},
      content: JSON.stringify({
        endings: Array.from({ length: PROMPT_EXPECTED_OUTPUT_COUNTS.endingConcepts.min }, () => ({
          title: 't',
          summary: 's',
        })),
      }),
    });
    expect(ok).toHaveLength(0);
  });

  it('requires exactly ten title strings', () => {
    expect(
      structuredOutputCountWarnings({
        kind: 'title',
        stage: 'title',
        data: {},
        content: JSON.stringify({ titles: Array.from({ length: 9 }, (_, i) => `T${i}`) }),
      }).length,
    ).toBeGreaterThan(0);
    expect(
      structuredOutputCountWarnings({
        kind: 'title',
        stage: 'title',
        data: {},
        content: JSON.stringify({ titles: Array.from({ length: 10 }, (_, i) => `T${i}`) }),
      }),
    ).toHaveLength(0);
  });

  it('flags revision queue chapterCount mismatch', () => {
    const w = structuredOutputCountWarnings({
      kind: 'revision-queue',
      stage: 'editorial',
      data: { createQueue: true, chapterCount: 3 },
      content: JSON.stringify({ revisionTasks: [{ chapterNumber: 1, issueCount: 0, priority: 'none' }] }),
    });
    expect(w.some((x) => x.includes('revision task'))).toBe(true);
  });

  it('warns when scene plan has fewer than two scenes', () => {
    const w = structuredOutputCountWarnings({
      kind: 'chapter-scene-plan',
      stage: 'chapter-scene-plan',
      data: {},
      content: JSON.stringify({
        scenePlan: {
          schemaVersion: 1,
          chapterNumber: 1,
          generatedAt: '2020-01-01T00:00:00Z',
          derivedFromChapterOutlines: { documentId: 'x', version: 1, updatedAt: '2020' },
          scenes: [{ id: 's1', order: 0, purpose: 'p' }],
        },
      }),
    });
    expect(w.length).toBeGreaterThan(0);
  });
});
