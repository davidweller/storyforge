/**
 * Order-of-magnitude Anthropic API USD for the drafting-focused Full Auto leg
 * (planning through chapter summaries + marketing blurbs), aligned with
 * `docs/model_recommendations.md` (25-chapter baseline, assembled-context caching).
 *
 * Not invoice-grade: excludes editorial/revision and assumes recommended Claude presets.
 */

/** Nominal assembled-context block after Opus tokenizer adjustment (doc assumption). */
export const ASSEMBLED_CONTEXT_TOKENSCachedEstimate = 7200;

/** Input $/token delta: standard input ($5/MTok) vs cache read (~$0.50/MTok). */
const INPUT_PREMIUM_PER_TOKEN_USD = (5 - 0.5) / 1_000_000;

const PLANNING_USD = 0.67;
const MARKETING_USD = 0.04;
const SUMMARIES_USD_PER_25_CHAPTERS = 0.18;

/** Scene pipeline totals for 25 chapters, prompt caching on assembled context (doc). */
const SCENE_PIPELINE_CACHED_USD_PER_25_WITH_POLISH = 13.87;
const SCENE_PIPELINE_CACHED_USD_PER_25_NO_POLISH = 10.28;

/** Single-pass `chapters` stage, 25 chapters, caching on assembled context (doc). */
const SINGLE_PASS_CACHED_USD_PER_25 = 3.43;

const BASELINE_CHAPTERS = 25;

function summariesUsd(chapterCount: number): number {
  return (SUMMARIES_USD_PER_25_CHAPTERS / BASELINE_CHAPTERS) * Math.max(0, chapterCount);
}

/** Extra vs cached scene prose when every call pays full price on assembled context (doc: ~99 hits × …). */
export function scenePipelineCacheMissPremiumUsd(chapterCount: number): number {
  const n = Math.max(0, chapterCount);
  const proseCalls = 4 * n;
  const hitsIfCached = Math.max(0, proseCalls - 1);
  return hitsIfCached * ASSEMBLED_CONTEXT_TOKENSCachedEstimate * INPUT_PREMIUM_PER_TOKEN_USD;
}

/** Extra vs cached single-pass drafting when context is cold each chapter (doc: 24 × …). */
export function singlePassCacheMissPremiumUsd(chapterCount: number): number {
  const n = Math.max(0, chapterCount);
  if (n <= 1) return 0;
  return (n - 1) * ASSEMBLED_CONTEXT_TOKENSCachedEstimate * INPUT_PREMIUM_PER_TOKEN_USD;
}

export interface AnthropicDraftLegUsdEstimate {
  /** Continuous Full Auto–style run: warm prompt cache on reused bible/context. */
  fullAutoWithCaching: number;
  /** Spread manual sessions: little or no cache reuse on assembled context. */
  manualWithoutCaching: number;
}

export function estimateAnthropicDraftLegUsd(input: {
  chapterCount: number;
  useScenePipeline: boolean;
  polishEnabled: boolean;
}): AnthropicDraftLegUsdEstimate {
  const n = Math.max(1, input.chapterCount);
  const fixed = PLANNING_USD + MARKETING_USD + summariesUsd(n);

  if (input.useScenePipeline) {
    const per25 = input.polishEnabled
      ? SCENE_PIPELINE_CACHED_USD_PER_25_WITH_POLISH
      : SCENE_PIPELINE_CACHED_USD_PER_25_NO_POLISH;
    const draftingCached = (per25 / BASELINE_CHAPTERS) * n;
    const draftingManual = draftingCached + scenePipelineCacheMissPremiumUsd(n);
    return {
      fullAutoWithCaching: roundUsd(fixed + draftingCached),
      manualWithoutCaching: roundUsd(fixed + draftingManual),
    };
  }

  const draftingCached = (SINGLE_PASS_CACHED_USD_PER_25 / BASELINE_CHAPTERS) * n;
  const draftingManual = draftingCached + singlePassCacheMissPremiumUsd(n);
  return {
    fullAutoWithCaching: roundUsd(fixed + draftingCached),
    manualWithoutCaching: roundUsd(fixed + draftingManual),
  };
}

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatUsdApprox(value: number): string {
  const rounded = roundUsd(value);
  if (Number.isInteger(rounded)) {
    return `~$${rounded}`;
  }
  return `~$${rounded.toFixed(2)}`;
}
