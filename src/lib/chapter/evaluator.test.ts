import { describe, it, expect } from 'vitest';
import type { ChapterScenePlanDocument } from '@/lib/generation/schemas';
import {
  planSceneEvalChunks,
  mergeEvaluationResults,
  runDeterministicChapterEvaluation,
  sliceScenePlanForSegments,
} from './evaluator';

const dummyPlan = (sceneIds: string[]): ChapterScenePlanDocument => ({
  schemaVersion: 1,
  chapterNumber: 1,
  generatedAt: '1970-01-01T00:00:00.000Z',
  derivedFromChapterOutlines: { documentId: 'doc', version: 1, updatedAt: '1970-01-01T00:00:00.000Z' },
  scenes: sceneIds.map((id, order) => ({
    id,
    order,
    purpose: 'p',
    conflict: '',
    turningPoint: '',
    pov: '',
    setting: '',
    emotionalShift: '',
    beatsCovered: [],
    mustInclude: [],
  })),
});

describe('planSceneEvalChunks', () => {
  it('returns empty array when no segments', () => {
    expect(planSceneEvalChunks([], dummyPlan(['a']), '', 6000)).toEqual([]);
  });

  it('puts all segments in one chunk when under budget', () => {
    const segments = [{ sceneId: 'a', prose: 'Hello world short text.' }];
    const chunks = planSceneEvalChunks(segments, dummyPlan(['a']), 'canon', 6000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual(segments);
  });
});

describe('sliceScenePlanForSegments', () => {
  it('drops scenes not in chunk', () => {
    const plan = dummyPlan(['a', 'b']);
    const slice = sliceScenePlanForSegments(plan, [{ sceneId: 'b', prose: 'x' }]);
    expect(slice.scenes).toHaveLength(1);
    expect(slice.scenes[0]?.id).toBe('b');
  });
});

describe('mergeEvaluationResults', () => {
  it('concatenates checks from parts', () => {
    const merged = mergeEvaluationResults([
      {
        checks: [{ id: 'a', sceneId: 's1', pass: true, severity: 'info' as const, evidence: '', suggestion: '' }],
        summary: 'one',
      },
      {
        checks: [{ id: 'b', sceneId: 's2', pass: false, severity: 'warn' as const, evidence: 'x', suggestion: 'y' }],
        summary: 'two',
      },
    ]);
    expect(merged.checks).toHaveLength(2);
    expect(merged.summary).toContain('one');
    expect(merged.summary).toContain('two');
  });

  it('merges duplicate id+sceneId across parts (defensive)', () => {
    const merged = mergeEvaluationResults([
      {
        checks: [
          { id: 'same', sceneId: 's1', pass: true, severity: 'info' as const, evidence: 'a', suggestion: '' },
        ],
        summary: '',
      },
      {
        checks: [
          { id: 'same', sceneId: 's1', pass: false, severity: 'warn' as const, evidence: 'b', suggestion: 'fix' },
        ],
        summary: '',
      },
    ]);
    expect(merged.checks).toHaveLength(1);
    expect(merged.checks[0].pass).toBe(false);
    expect(merged.checks[0].severity).toBe('warn');
    expect(merged.checks[0].evidence).toContain('a');
    expect(merged.checks[0].evidence).toContain('b');
  });
});

describe('runDeterministicChapterEvaluation', () => {
  it('flags missing segment for a scene card', () => {
    const ev = runDeterministicChapterEvaluation({
      segments: [],
      sceneCards: [
        {
          id: 'sc1',
          order: 0,
          purpose: 'Open',
          conflict: '',
          turningPoint: '',
          pov: '',
          setting: '',
          emotionalShift: '',
          beatsCovered: [],
          mustInclude: [],
        },
      ],
    });
    const missing = ev.checks.find((c) => c.id.startsWith('missing-scene'));
    expect(missing?.pass).toBe(false);
    expect(missing?.sceneId).toBe('sc1');
  });
});
