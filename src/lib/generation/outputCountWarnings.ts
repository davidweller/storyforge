import type { WorkflowStage } from '@/types';

/** Mirrors POST /api/generate structured-output discriminants used for normalization. */
export type StructuredOutputKindForCountWarnings =
  | 'ending-concepts'
  | 'title'
  | 'chapter-outlines'
  | 'chapter-summary'
  | 'story-bible'
  | 'creative-brief'
  | 'revision-queue'
  | 'chapter-scene-plan'
  | 'chapter-scenes-prose'
  | 'chapter-scene-eval'
  | 'revision-verify';

type D = Record<string, unknown>;

/** Numeric expectations copied from stage prompts (`ending`, `title`, `chapter-outlines`, scenes, editorial queue). */
export const PROMPT_EXPECTED_OUTPUT_COUNTS = {
  endingConcepts: { min: 8, max: 10 },
  titleIdeas: { exact: 10 },
  /** Outlines prompt: ~20–30; warn only for clearly atypical extremes. */
  chapterOutlines: { warnBelow: 8, warnAbove: 42 },
  /** Scene-plan prompt: at least 2 (single-beat exception); typical 3–6. */
  sceneCards: { minUnlessSingleBeat: 2, typicalMax: 7 },
} as const;

export function structuredOutputCountWarnings(params: {
  kind: StructuredOutputKindForCountWarnings;
  stage: WorkflowStage;
  data: D;
  content: string;
}): string[] {
  const { kind, stage, data, content } = params;
  const out: string[] = [];

  if (!content?.trim()) return out;

  try {
    switch (kind) {
      case 'ending-concepts': {
        const parsed = JSON.parse(content) as { endings?: unknown[] };
        const n = Array.isArray(parsed.endings) ? parsed.endings.length : 0;
        const exact =
          typeof data.endingConceptCount === 'number' && data.endingConceptCount > 0
            ? data.endingConceptCount
            : null;
        const min =
          typeof data.endingConceptCountMin === 'number' && data.endingConceptCountMin > 0
            ? data.endingConceptCountMin
            : PROMPT_EXPECTED_OUTPUT_COUNTS.endingConcepts.min;
        const max =
          typeof data.endingConceptCountMax === 'number' && data.endingConceptCountMax > 0
            ? data.endingConceptCountMax
            : PROMPT_EXPECTED_OUTPUT_COUNTS.endingConcepts.max;
        if (exact != null) {
          if (n !== exact) {
            out.push(`Ending concepts: prompt asks for exactly ${exact} options; model returned ${n}.`);
          }
        } else if (n < min || n > max) {
          out.push(
            `Ending concepts: prompt asks for ${min}–${max} options; model returned ${n}.`
          );
        }
        break;
      }

      case 'title': {
        const parsed = JSON.parse(content) as { titles?: unknown[] };
        const n = Array.isArray(parsed.titles) ? parsed.titles.length : 0;
        const exact =
          typeof data.titleCount === 'number' && data.titleCount > 0 ? data.titleCount : null;
        const target = exact ?? PROMPT_EXPECTED_OUTPUT_COUNTS.titleIdeas.exact;
        if (n !== target) {
          out.push(`Title ideas: prompt asks for exactly ${target} options; model returned ${n}.`);
        }
        break;
      }

      case 'chapter-outlines': {
        const parsed = JSON.parse(content) as { chapters?: unknown[] };
        const n = Array.isArray(parsed.chapters) ? parsed.chapters.length : 0;
        const { warnBelow, warnAbove } = PROMPT_EXPECTED_OUTPUT_COUNTS.chapterOutlines;
        if (n > 0 && (n < warnBelow || n > warnAbove)) {
          out.push(
            `Chapter outlines: prompt targets ~20–30 chapters (allowing roughly ${warnBelow}–${warnAbove}); model returned ${n}.`
          );
        }
        break;
      }

      case 'revision-queue': {
        const expected =
          stage === 'editorial-issues'
            ? typeof data.chapterCount === 'number'
              ? data.chapterCount
              : NaN
            : stage === 'editorial' && data.createQueue === true
              ? typeof data.chapterCount === 'number'
                ? data.chapterCount
                : NaN
              : NaN;
        if (!Number.isFinite(expected) || expected < 1) break;
        const parsed = JSON.parse(content) as { revisionTasks?: unknown[] };
        const tasks = Array.isArray(parsed.revisionTasks) ? parsed.revisionTasks.length : 0;
        if (tasks !== expected) {
          out.push(
            `Revision queue: prompt asks for exactly one task object per manuscript chapter (${expected} expected); model returned ${tasks} revision task(s).`
          );
        }
        break;
      }

      case 'chapter-scene-plan': {
        const parsed = JSON.parse(content) as { scenePlan?: { scenes?: unknown[] } };
        const scenes =
          parsed.scenePlan && Array.isArray(parsed.scenePlan.scenes)
            ? parsed.scenePlan.scenes.length
            : 0;
        const { minUnlessSingleBeat, typicalMax } = PROMPT_EXPECTED_OUTPUT_COUNTS.sceneCards;
        if (scenes > 0 && scenes < minUnlessSingleBeat) {
          out.push(
            `Scene cards: prompt asks for at least ${minUnlessSingleBeat} scenes unless this chapter is intentionally a single beat; model returned ${scenes}.`
          );
        } else if (scenes > typicalMax) {
          out.push(
            `Scene cards: prompt treats typical chapters as 3–6 scenes; ${scenes} scenes may dilute pacing—confirm this is intentional.`
          );
        }
        break;
      }

      case 'chapter-scene-eval': {
        const parsed = JSON.parse(content) as { checks?: unknown[] };
        const n = Array.isArray(parsed.checks) ? parsed.checks.length : 0;
        if (n === 0) {
          out.push(`Chapter quality evaluation: expected non-empty checks array from the rubric; model returned none.`);
        }
        break;
      }

      case 'revision-verify': {
        const parsed = JSON.parse(content) as {
          checklist?: unknown[];
          satisfied?: boolean;
        };
        const checklistLen = Array.isArray(parsed.checklist) ? parsed.checklist.length : 0;
        if (checklistLen === 0 && typeof parsed.satisfied === 'boolean') {
          out.push(
            `Revision verification: checklist is empty; cannot confirm criteria were assessed.`
          );
        }
        break;
      }

      default:
        break;
    }
  } catch {
    /* Normalized outputs should parse; failures are surfaced elsewhere — avoid doubling errors. */
  }

  return out;
}
