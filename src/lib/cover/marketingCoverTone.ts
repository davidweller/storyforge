import { COVER_ARCHETYPES } from '@/lib/prompts/covers';
import type { CoverBriefDocument, CoverImagePayload, ProjectDocument } from '@/types';
import { isCoverBriefV2 } from '@/types';

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export type ResolvedCoverTone = {
  archetypeId: string;
  moodKeywords: string[];
  paletteDirection: string;
  highClickEnabled: boolean;
};

/** Resolve tone fields from approved front cover + best matching cover brief. */
export function resolveApprovedCoverTone(
  documents: ProjectDocument[],
  approvedCoverImageId: string | null | undefined
): ResolvedCoverTone | null {
  if (!approvedCoverImageId?.trim()) return null;
  const imgDoc = documents.find((d) => d.id === approvedCoverImageId && d.type === 'cover-image');
  if (!imgDoc?.content) return null;
  const payload = parseJson<CoverImagePayload>(imgDoc.content);
  if (!payload || payload.surface !== 'front') return null;

  const briefDocs = documents
    .filter((d) => d.type === 'cover-brief' && d.approved)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  for (const d of briefDocs) {
    const brief = parseJson<CoverBriefDocument>(d.content);
    if (!brief) continue;
    if (isCoverBriefV2(brief) && brief.archetypeId === payload.archetypeId) {
      return {
        archetypeId: payload.archetypeId,
        moodKeywords: brief.moodKeywords,
        paletteDirection: brief.layers.background.paletteDirection,
        highClickEnabled: payload.highClickEnabled,
      };
    }
  }

  for (const d of briefDocs) {
    const brief = parseJson<CoverBriefDocument>(d.content);
    if (!brief) continue;
    if (isCoverBriefV2(brief)) {
      return {
        archetypeId: payload.archetypeId,
        moodKeywords: brief.moodKeywords,
        paletteDirection: brief.layers.background.paletteDirection,
        highClickEnabled: payload.highClickEnabled,
      };
    }
  }

  for (const d of briefDocs) {
    const brief = parseJson<CoverBriefDocument>(d.content);
    if (brief && !isCoverBriefV2(brief)) {
      return {
        archetypeId: payload.archetypeId,
        moodKeywords: brief.moodKeywords,
        paletteDirection: brief.paletteDirection,
        highClickEnabled: payload.highClickEnabled,
      };
    }
  }

  return {
    archetypeId: payload.archetypeId,
    moodKeywords: [],
    paletteDirection: '(not available — regenerate or approve a cover brief)',
    highClickEnabled: payload.highClickEnabled,
  };
}

export function formatCoverToneForPrompt(tone: ResolvedCoverTone): string {
  const meta = COVER_ARCHETYPES.find((a) => a.id === tone.archetypeId);
  const label = meta ? `${tone.archetypeId} (${meta.name})` : tone.archetypeId;
  const mkw = tone.moodKeywords.length ? tone.moodKeywords.join(', ') : '(not specified)';
  return `**Approved cover:**
Archetype: ${label}
Visual tone: ${mkw}
Palette direction: ${tone.paletteDirection}
High-click optimised: ${tone.highClickEnabled ? 'yes' : 'no'}`;
}
