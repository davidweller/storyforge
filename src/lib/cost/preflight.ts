/**
 * Rough preflight token estimates for expensive runs. Includes per-stage template
 * overhead (system + instructions + JSON wrappers), not body text alone.
 */

import { getEffectiveModelForStage } from '@/lib/data/models';
import type { WorkflowStage } from '@/types';

/** Typical non-body prompt overhead per generate call (calibrate from `generation_usage` over time). */
export const STAGE_TEMPLATE_OVERHEAD_TOKENS: Partial<Record<WorkflowStage, number>> & { default: number } =
  {
    default: 4_500,
    'genre-research': 5_000,
    niche: 5_000,
    ending: 6_000,
    characters: 5_500,
    structure: 6_000,
    title: 4_000,
    'chapter-outlines': 7_000,
    chapters: 8_000,
    'chapter-summary': 4_000,
    editorial: 12_000,
    revision: 9_000,
    'revision-verify': 3_500,
    'story-bible': 10_000,
    'creative-brief': 5_000,
    'chapter-scene-plan': 7_000,
    'chapter-scenes-prose': 6_000,
    'chapter-polish': 8_000,
    'chapter-scene-eval': 5_000,
    blurb: 4_000,
    'amazon-description': 4_000,
  };

function overheadFor(stage: WorkflowStage): number {
  return STAGE_TEMPLATE_OVERHEAD_TOKENS[stage] ?? STAGE_TEMPLATE_OVERHEAD_TOKENS.default;
}

function callEstimate(stage: WorkflowStage): number {
  const model = getEffectiveModelForStage(stage);
  return overheadFor(stage) + model.maxTokens;
}

export interface FullAutoPreflightInput {
  /** Parsed chapter outline count (0 if unknown). */
  chapterCount: number;
  /** Optional: cumulative approved words for editorial sizing. */
  manuscriptWordCount?: number;
  /** Whether editorial + revision legs are expected (draft complete). */
  includePostDraft?: boolean;
}

export function estimateFullAutoTokens(input: FullAutoPreflightInput): {
  low: number;
  high: number;
  assumptions: string[];
} {
  const n = Math.max(0, input.chapterCount);
  const assumptions: string[] = [
    'Includes template/system overhead per stage (not body text only).',
    'Chapter count drives per-chapter generation; actuals vary with context size.',
  ];

  let subtotal = 0;
  const add = (stage: WorkflowStage, mult = 1) => {
    subtotal += callEstimate(stage) * mult;
  };

  add('genre-research');
  add('niche');
  add('ending', 2);
  add('characters');
  add('structure');
  add('title');
  add('chapter-outlines');
  add('story-bible');
  add('creative-brief');

  add('chapters', n);
  add('chapter-summary', n);

  if (input.includePostDraft && n > 0) {
    const words = input.manuscriptWordCount ?? 0;
    const bodyTok = words > 0 ? Math.ceil((words * 5) / 4) : 80_000;
    add('editorial', 2);
    assumptions.push('Post-draft leg assumes ~2 large editorial calls; long manuscripts cost more.');
    subtotal += Math.min(MAX_REASONABLE_EDITORIAL_INPUT, bodyTok);
  }

  add('blurb');
  add('amazon-description');

  const low = Math.round(subtotal * 0.85);
  const high = Math.round(subtotal * 1.25);
  return { low, high, assumptions };
}

const MAX_REASONABLE_EDITORIAL_INPUT = 120_000;

export function estimateEditorialPassTokens(manuscriptWordCount: number, passCount = 1): {
  low: number;
  high: number;
  assumptions: string[];
} {
  const words = Math.max(0, manuscriptWordCount);
  const bodyTok = words > 0 ? Math.ceil((words * 5) / 4) : 0;
  const perPass = callEstimate('editorial') + Math.min(MAX_REASONABLE_EDITORIAL_INPUT, bodyTok);
  const subtotal = perPass * passCount;
  return {
    low: Math.round(subtotal * 0.9),
    high: Math.round(subtotal * 1.2),
    assumptions: [
      'Includes manuscript-sized context and template overhead.',
      'Fallback or repair passes are not double-counted.',
    ],
  };
}

export function estimateApplyAllRevisionsTokens(taskCount: number): {
  low: number;
  high: number;
  assumptions: string[];
} {
  const n = Math.max(0, taskCount);
  const perTask = callEstimate('revision') + callEstimate('chapter-summary') + callEstimate('revision-verify');
  const subtotal = perTask * n;
  return {
    low: Math.round(subtotal * 0.85),
    high: Math.round(subtotal * 1.2),
    assumptions: [
      'Per queued task: revision + chapter summary + verification (order-of-magnitude).',
      'Scene-scoped tasks may differ; repair loops not double-counted.',
    ],
  };
}

export function formatTokenRange(low: number, high: number): string {
  if (low >= 1_000_000) {
    return `~${(low / 1_000_000).toFixed(1)}–${(high / 1_000_000).toFixed(1)}M tokens`;
  }
  if (low >= 10_000) {
    return `~${(low / 1000).toFixed(0)}–${(high / 1000).toFixed(0)}k tokens`;
  }
  return `~${low.toLocaleString()}–${high.toLocaleString()} tokens`;
}
