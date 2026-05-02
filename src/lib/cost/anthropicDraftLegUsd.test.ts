import { describe, it, expect } from 'vitest';
import {
  estimateAnthropicDraftLegUsd,
  scenePipelineCacheMissPremiumUsd,
  singlePassCacheMissPremiumUsd,
} from './anthropicDraftLegUsd';

describe('anthropicDraftLegUsd', () => {
  it('matches doc baselines for 25 chapters (scene pipeline + polish)', () => {
    const est = estimateAnthropicDraftLegUsd({
      chapterCount: 25,
      useScenePipeline: true,
      polishEnabled: true,
    });
    expect(est.fullAutoWithCaching).toBeCloseTo(14.76, 2);
    expect(est.manualWithoutCaching).toBeCloseTo(14.76 + scenePipelineCacheMissPremiumUsd(25), 2);
  });

  it('matches doc baselines for 25 chapters (single-pass)', () => {
    const est = estimateAnthropicDraftLegUsd({
      chapterCount: 25,
      useScenePipeline: false,
      polishEnabled: false,
    });
    expect(est.fullAutoWithCaching).toBeCloseTo(4.32, 2);
    expect(est.manualWithoutCaching).toBeCloseTo(4.32 + singlePassCacheMissPremiumUsd(25), 2);
  });
});
