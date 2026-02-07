/**
 * Estimated durations (minutes) per Full Auto step for overlay timers.
 * Used to show "~X min left for this step" and "~Y min left total".
 */

export const FULL_AUTO_ESTIMATES_MINUTES: Record<string, number> = {
  'genre-research': 2,
  niche: 2,
  'ending-concepts': 2,
  'ending-expand': 3,
  characters: 3,
  structure: 4,
  title: 1,
  'chapter-outlines': 4,
  'chapter-per': 6, // per chapter
  compilation: 0,
  'export-draft': 0,
  editorial: 5,
  'revision-per': 3, // per revision task
  'export-final': 0,
  blurb: 1,
  'amazon-description': 1,
};

export function getEstimatedMinutesForStep(
  stepKind: string,
  count?: number
): number {
  const base = FULL_AUTO_ESTIMATES_MINUTES[stepKind] ?? 2;
  if (count !== undefined && count > 0) {
    return base * count;
  }
  return base;
}
