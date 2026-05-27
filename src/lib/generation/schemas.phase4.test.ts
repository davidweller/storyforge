import { describe, it, expect } from 'vitest';
import {
  parseChapterEvaluation,
  parseChapterSceneProseOutput,
  parseGeneratedStoryBible,
  parseNicheOutput,
  parseStoryBible,
} from './schemas';

const validTropes = {
  mustInclude: Array.from({ length: 5 }, (_, index) => ({
    name: `must trope ${index + 1}`,
    rationale: 'Readers expect this promise.',
  })),
  considerIncluding: Array.from({ length: 3 }, (_, index) => ({
    name: `consider trope ${index + 1}`,
    rationale: 'This can differentiate the book.',
  })),
  avoid: Array.from({ length: 3 }, (_, index) => ({
    name: `avoid trope ${index + 1}`,
    reason: 'This turns the target reader away.',
  })),
};

describe('Phase 4 schemas', () => {
  it('parses chapter evaluation with sceneId on checks', () => {
    const raw = JSON.stringify({
      checks: [
        {
          id: 'hook',
          sceneId: 'scene-2',
          pass: false,
          severity: 'warn',
          evidence: 'Weak beat',
          suggestion: 'Sharpen tension',
        },
      ],
      summary: 'ok',
    });
    const parsed = parseChapterEvaluation(raw);
    expect(parsed.checks[0].sceneId).toBe('scene-2');
  });

  it('parses scene prose output', () => {
    const raw = JSON.stringify({ sceneId: 'scene-1', prose: 'The rain fell.' });
    const parsed = parseChapterSceneProseOutput(raw);
    expect(parsed.sceneId).toBe('scene-1');
    expect(parsed.prose).toContain('rain');
  });

  it('validates structured niche trope counts and fields', () => {
    const parsed = parseNicheOutput(JSON.stringify({
      niche: {
        schemaVersion: 1,
        readerAvatar: 'Reader',
        emotionalPromise: 'Promise',
        positioningStatement: 'Position',
        marketingHooks: ['Hook'],
        tropes: validTropes,
        summary: '## Summary',
      },
    }));
    expect(parsed.niche.tropes.mustInclude).toHaveLength(5);

    expect(() => parseNicheOutput(JSON.stringify({
      niche: {
        schemaVersion: 1,
        readerAvatar: 'Reader',
        emotionalPromise: 'Promise',
        positioningStatement: 'Position',
        marketingHooks: ['Hook'],
        tropes: { ...validTropes, mustInclude: validTropes.mustInclude.slice(0, 4) },
        summary: '## Summary',
      },
    }))).toThrow();

    expect(() => parseNicheOutput(JSON.stringify({
      niche: {
        schemaVersion: 1,
        readerAvatar: 'Reader',
        emotionalPromise: 'Promise',
        positioningStatement: 'Position',
        marketingHooks: ['Hook'],
        tropes: {
          ...validTropes,
          avoid: [{ name: 'avoid without reason' }, ...validTropes.avoid.slice(1)],
        },
        summary: '## Summary',
      },
    }))).toThrow();
  });

  it('accepts legacy story bible v1 but requires tropes for generated v2', () => {
    const legacy = {
      storyBible: {
        schemaVersion: 1,
        storyBibleVersion: 1,
        generatedAt: '2026-01-01T00:00:00.000Z',
        approvedAt: null,
        derivedFrom: [{ documentType: 'niche', documentId: 'n1', version: 1, updatedAt: '2026' }],
        logline: 'A logline.',
        genrePromise: 'Genre promise.',
        audiencePromise: 'Audience promise.',
        voiceAndStyle: {
          pov: 'third',
          tense: 'past',
          narrativeDistance: 'close',
          styleRules: [],
          avoid: [],
        },
        themes: [],
        characters: [],
        relationships: [],
        worldRules: [],
        timelineFacts: [],
        unresolvedThreads: [],
        endingPromises: [],
        forbiddenChanges: [],
      },
    };

    expect(parseStoryBible(JSON.stringify(legacy)).storyBible.schemaVersion).toBe(1);
    expect(() => parseGeneratedStoryBible(JSON.stringify(legacy))).toThrow();

    expect(parseGeneratedStoryBible(JSON.stringify({
      storyBible: {
        ...legacy.storyBible,
        schemaVersion: 2,
        tropesSource: 'structured-niche',
        tropes: validTropes,
      },
    })).storyBible.tropes.mustInclude).toHaveLength(5);
  });
});
