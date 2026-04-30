import type { SceneProseSegment } from '@/types';

export function spliceSceneIntoChapter(
  segments: SceneProseSegment[],
  sceneId: string,
  newProse: string,
): { segments: SceneProseSegment[]; content: string } {
  const next = segments.map((s) =>
    s.sceneId === sceneId ? { ...s, prose: newProse } : s,
  );
  return {
    segments: next,
    content: next.map((s) => s.prose).join('\n\n'),
  };
}
