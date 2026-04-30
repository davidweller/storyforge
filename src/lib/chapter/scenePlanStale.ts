import type { ProjectDocument } from '@/types';
import { parseChapterScenePlan } from '@/lib/generation/schemas';

/** True when the scene plan was derived from an older approved outlines artifact than the current one. */
export function isChapterScenePlanStale(
  scenePlanDoc: ProjectDocument | undefined | null,
  outlinesDoc: ProjectDocument | undefined | null,
): boolean {
  if (!scenePlanDoc?.content.trim() || scenePlanDoc.type !== 'chapter-scene-plan') return false;
  if (!outlinesDoc?.approved) return true;
  try {
    const plan = parseChapterScenePlan(scenePlanDoc.content).scenePlan;
    const d = plan.derivedFromChapterOutlines;
    return (
      d.documentId !== outlinesDoc.id
      || d.version !== outlinesDoc.version
      || d.updatedAt !== outlinesDoc.updatedAt.toISOString()
    );
  } catch {
    return true;
  }
}

export type ScenePlanStaleReason = 'outline-changed' | 'unparsed';

export function chapterScenePlanStaleReason(
  scenePlanDoc: ProjectDocument | undefined | null,
  outlinesDoc: ProjectDocument | undefined | null,
): ScenePlanStaleReason | null {
  if (!scenePlanDoc || scenePlanDoc.type !== 'chapter-scene-plan') return null;
  if (!isChapterScenePlanStale(scenePlanDoc, outlinesDoc)) return null;
  try {
    parseChapterScenePlan(scenePlanDoc.content);
    return 'outline-changed';
  } catch {
    return 'unparsed';
  }
}
