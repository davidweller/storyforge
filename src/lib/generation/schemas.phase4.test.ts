import { describe, it, expect } from 'vitest';
import { parseChapterEvaluation, parseChapterSceneProseOutput } from './schemas';

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
});
