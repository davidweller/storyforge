import type { ProjectStyleReference } from '@/types';

/** Max simultaneous reference uploads per bucket (cover vs A+). */
export const MAX_STYLE_REFERENCE_SLOTS = 5;
/** Loose cap on combined base64 payload to keep SQLite TEXT rows workable. */
export const MAX_STYLE_REFERENCE_TOTAL_BYTES = 450_000;

function byteLengthRough(s: string): number {
  return s.length * 0.75; // base64 is ~4/3 overhead
}

/** Parse and validate persisted JSON array; drops invalid slots. */
export function parseProjectStyleReferences(raw: string | null | undefined): ProjectStyleReference[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: ProjectStyleReference[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const mimeType = o.mimeType;
      const base64Data = o.base64Data;
      const note = o.note;
      if (mimeType !== 'image/png' && mimeType !== 'image/jpeg') continue;
      if (typeof base64Data !== 'string' || base64Data.length < 80) continue;
      out.push({
        mimeType,
        base64Data: base64Data.trim(),
        ...(typeof note === 'string' && note.trim() ? { note: note.trim().slice(0, 600) } : {}),
      });
      if (out.length >= MAX_STYLE_REFERENCE_SLOTS) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function serializeProjectStyleReferences(refs: ProjectStyleReference[]): string {
  const trimmed = refs.slice(0, MAX_STYLE_REFERENCE_SLOTS).map((r) => ({
    mimeType: r.mimeType,
    base64Data: r.base64Data.trim(),
    ...(r.note?.trim() ? { note: r.note.trim().slice(0, 600) } : {}),
  }));
  let total = 0;
  for (const r of trimmed) {
    total += byteLengthRough(r.base64Data);
    if (total > MAX_STYLE_REFERENCE_TOTAL_BYTES) {
      throw new Error(
        `Reference images exceed the ${Math.round(MAX_STYLE_REFERENCE_TOTAL_BYTES / 1000)}KB total budget — remove one or resize.`
      );
    }
  }
  return JSON.stringify(trimmed);
}
