import type { WorkflowStage } from '@/types';

type BodyData = Record<string, unknown>;

/**
 * When strictCardinality is enabled on the request, fail fast if model output does not match requested counts.
 */
export function strictCardinalityViolation(
  stage: WorkflowStage,
  data: BodyData,
  normalizedContent: string,
): string | null {
  const strict = data.strictCardinality === true;
  if (!strict) return null;

  let parsed: { endings?: unknown[]; titles?: unknown[] };

  try {
    const trimmed = normalizedContent.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = fenced?.[1]?.trim() || trimmed;
    parsed = JSON.parse(candidate) as { endings?: unknown[]; titles?: unknown[] };
  } catch {
    return 'Strict cardinality enabled but response is not JSON.';
  }

  if (stage === 'ending') {
    const exact = typeof data.endingConceptCount === 'number' ? data.endingConceptCount : null;
    if (exact == null || exact < 1) {
      return 'Strict cardinality requires data.endingConceptCount (positive integer) for ending stage.';
    }
    const n = Array.isArray(parsed.endings) ? parsed.endings.length : 0;
    if (n !== exact) {
      return `Strict cardinality: expected exactly ${exact} endings; got ${n}.`;
    }
  }

  if (stage === 'title') {
    const exact = typeof data.titleCount === 'number' ? data.titleCount : null;
    if (exact == null || exact < 1) {
      return 'Strict cardinality requires data.titleCount (positive integer) for title stage.';
    }
    const n = Array.isArray(parsed.titles) ? parsed.titles.length : 0;
    if (n !== exact) {
      return `Strict cardinality: expected exactly ${exact} titles; got ${n}.`;
    }
  }

  return null;
}
