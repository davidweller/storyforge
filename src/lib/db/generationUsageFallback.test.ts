import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { appendGenerationUsageFallback, sumFallbackUsageForProject } from './generationUsageFallback';

describe('generationUsageFallback', () => {
  let prev: string | undefined;
  let tmp: string;

  beforeEach(() => {
    prev = process.env.STORYFORGE_DATA_DIR;
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-usage-'));
    process.env.STORYFORGE_DATA_DIR = tmp;
  });

  afterEach(() => {
    if (prev !== undefined) process.env.STORYFORGE_DATA_DIR = prev;
    else delete process.env.STORYFORGE_DATA_DIR;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('sums fallback lines for a projectId', () => {
    appendGenerationUsageFallback({
      projectId: 'p1',
      stage: 'title',
      model: 'x',
      provider: 'y',
      inputTokens: null,
      outputTokens: null,
      totalTokens: 100,
      runId: null,
      source: 'manual-stage',
    });
    appendGenerationUsageFallback({
      projectId: 'p1',
      stage: 'ending',
      model: 'x',
      provider: 'y',
      inputTokens: null,
      outputTokens: null,
      totalTokens: 50,
      runId: null,
      source: 'manual-stage',
    });
    appendGenerationUsageFallback({
      projectId: 'p2',
      stage: 'title',
      model: 'x',
      provider: 'y',
      inputTokens: null,
      outputTokens: null,
      totalTokens: 999,
      runId: null,
      source: 'manual-stage',
    });

    expect(sumFallbackUsageForProject('p1')).toEqual({ totalTokens: 150, callCount: 2 });
    expect(sumFallbackUsageForProject('p2')).toEqual({ totalTokens: 999, callCount: 1 });
  });
});
