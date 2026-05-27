import type { SceneProseSegment } from '@/types';
import type { SceneCard } from '@/lib/generation/schemas';
import type { ChapterEvaluation, ChapterScenePlanDocument } from '@/lib/generation/schemas';
import { estimateTokens } from '@/lib/utils';

function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

/** Deterministic pre-checks (no LLM). POV heuristic omitted in Phase 4 initial ship per plan. */
export function runDeterministicChapterEvaluation(params: {
  segments: SceneProseSegment[];
  sceneCards: SceneCard[];
  outlineWordTarget?: number;
}): ChapterEvaluation {
  const checks: ChapterEvaluation['checks'] = [];
  const fullText = params.segments.map((s) => s.prose).join('\n\n');
  const totalWords = countWords(fullText);

  if (params.outlineWordTarget && params.outlineWordTarget > 0) {
    const low = Math.floor(params.outlineWordTarget * 0.8);
    const high = Math.ceil(params.outlineWordTarget * 1.2);
    const pass = totalWords >= low && totalWords <= high;
    checks.push({
      id: 'word-total-outline',
      sceneId: params.sceneCards[0]?.id ?? 'scene-unknown',
      pass,
      severity: pass ? 'info' : 'warn',
      evidence: `Chapter word count ${totalWords}; outline target ${params.outlineWordTarget} (band ${low}–${high}).`,
      suggestion: pass ? '' : 'Adjust scene lengths or tighten/expand prose to approach the outline target.',
    });
  }

  for (const card of params.sceneCards) {
    const seg = params.segments.find((s) => s.sceneId === card.id);
    if (!seg) {
      checks.push({
        id: `missing-scene-${card.id}`,
        sceneId: card.id,
        pass: false,
        severity: 'fail',
        evidence: 'No prose segment stored for this scene card.',
        suggestion: 'Generate or paste prose for this scene.',
      });
      continue;
    }
    const w = countWords(seg.prose);
    const target = card.estimatedWords;
    if (target && target > 0) {
      const low = Math.floor(target * 0.65);
      const high = Math.ceil(target * 1.45);
      const pass = w >= low && w <= high;
      checks.push({
        id: `word-scene-${card.id}`,
        sceneId: card.id,
        pass,
        severity: pass ? 'info' : 'warn',
        evidence: `Scene word count ${w}; card estimate ${target} (relaxed band).`,
        suggestion: pass ? '' : 'Rebalance length vs adjacent scenes if pacing feels off.',
      });
    }
  }

  const paras = fullText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const last = paras[paras.length - 1] ?? '';
  const closingBeatThin = last.length > 0 && last.length < 50 && !/[?!…]/.test(last.slice(-3));
  checks.push({
    id: 'closing-beat-heuristic',
    sceneId: params.sceneCards[params.sceneCards.length - 1]?.id ?? params.sceneCards[0]?.id ?? 'scene-unknown',
    pass: !closingBeatThin,
    severity: 'info',
    evidence: closingBeatThin
      ? 'Final paragraph is very short and ends flat — quiet endings are fine; only sharpen if the beat needs more weight.'
      : 'Closing paragraph has moderate substance or punctuation tension.',
    suggestion: closingBeatThin
      ? 'If this chapter should land harder, sharpen the closing beat; otherwise a quiet ending may be correct.'
      : '',
  });

  return {
    checks,
    summary: 'Deterministic gates (word bands + closing-beat heuristic). Model rubric adds deeper checks.',
  };
}

const SEVERITY_RANK: Record<ChapterEvaluation['checks'][number]['severity'], number> = {
  fail: 3,
  warn: 2,
  info: 1,
};

/**
 * Concatenates evaluation parts (deterministic + each model chunk).
 *
 * Chunking in {@link planSceneEvalChunks} is **whole-segment**: each `SceneProseSegment`
 * is atomic, so a given `sceneId` appears in **at most one** chunk and cannot straddle
 * boundaries. If the same `(id, sceneId)` still appears twice (e.g. flaky model output),
 * entries are merged: `pass` is true only if both pass; severity is the higher of the two;
 * evidence/suggestion strings are joined.
 */
export function mergeEvaluationResults(parts: ChapterEvaluation[]): ChapterEvaluation {
  const flat = parts.flatMap((p) => p.checks);
  const summary = parts.map((p) => p.summary).filter(Boolean).join(' ');
  const mergedByKey = new Map<string, ChapterEvaluation['checks'][number]>();
  const keyOrder: string[] = [];

  for (const c of flat) {
    const key = `${c.id}\0${c.sceneId}`;
    const prev = mergedByKey.get(key);
    if (!prev) {
      mergedByKey.set(key, { ...c });
      keyOrder.push(key);
      continue;
    }
    const pass = prev.pass && c.pass;
    const severity =
      (SEVERITY_RANK[c.severity] ?? 0) > (SEVERITY_RANK[prev.severity] ?? 0)
        ? c.severity
        : prev.severity;
    mergedByKey.set(key, {
      ...prev,
      pass,
      severity,
      evidence: [prev.evidence, c.evidence].filter(Boolean).join(' | ') || prev.evidence,
      suggestion: [prev.suggestion, c.suggestion].filter(Boolean).join(' | ') || prev.suggestion,
    });
  }

  return {
    checks: keyOrder.map((k) => mergedByKey.get(k)!),
    summary,
  };
}

/**
 * Narrow the stored scene plan to only scene cards touched by prose in this chunk.
 */
export function sliceScenePlanForSegments(
  plan: ChapterScenePlanDocument,
  segmentChunk: SceneProseSegment[],
): ChapterScenePlanDocument {
  const ids = new Set(segmentChunk.map((s) => s.sceneId));
  return {
    ...plan,
    scenes: plan.scenes.filter((c) => ids.has(c.id)),
  };
}

/**
 * Groups scene segments into chunks for separate `chapter-scene-eval` calls.
 *
 * **Invariant:** chunks are built from whole {@link SceneProseSegment}s only—the prose of
 * one scene is never split across chunks. Overhead estimates use **sliced** scene-plan JSON
 * for the candidate chunk so multi-scene chapters pack more cleanly.
 */
export function planSceneEvalChunks(
  segments: SceneProseSegment[],
  scenePlan: ChapterScenePlanDocument,
  compactCanon: string,
  inputBudgetTokens: number,
): SceneProseSegment[][] {
  const canonTok = estimateTokens(compactCanon) + 800;
  if (!segments.length) return [];
  const chunks: SceneProseSegment[][] = [];
  let current: SceneProseSegment[] = [];
  let currentTok = 0;

  for (const seg of segments) {
    const segT = estimateTokens(seg.prose);
    if (current.length > 0) {
      const tentative = [...current, seg];
      const planTok = estimateTokens(JSON.stringify(sliceScenePlanForSegments(scenePlan, tentative)));
      if (currentTok + segT + planTok + canonTok > inputBudgetTokens) {
        chunks.push(current);
        current = [];
        currentTok = 0;
      }
    }
    current.push(seg);
    currentTok += estimateTokens(seg.prose);
  }
  if (current.length) chunks.push(current);
  return chunks.length ? chunks : [[]];
}
