import type { CoverBriefDocument, StoryBibleDocument } from '@/types';
import { parseCoverBrief } from '@/lib/generation/coverSchemas';

export function assembleCanonForCoverBrief(params: {
  genre: string;
  niche?: string;
  microniche?: string;
  title?: string;
  authorName?: string;
  wordCountApprox: number;
  storyBible: StoryBibleDocument;
  storyBibleDocumentId: string;
  creativeBriefContent: string | null;
  creativeBriefDocumentId: string | null;
  nicheDocContent?: string | null;
}): string {
  const lines: string[] = [
    `GENRE (metadata): ${params.genre}`,
    params.niche ? `NICHE: ${params.niche}` : null,
    params.microniche ? `MICRONICHE: ${params.microniche}` : null,
    `APPROVED TITLE: ${params.title ?? '(not selected yet — use premise/title stage output where present)'}`,
    `AUTHOR DISPLAY NAME (for cover type): ${params.authorName?.trim() || '(set in project metadata if needed)'}`,
    `APPROX. MANUSCRIPT WORD COUNT: ${params.wordCountApprox}`,
    '',
    'STORY BIBLE (approved JSON source):',
    JSON.stringify(params.storyBible, null, 2),
    '',
    params.nicheDocContent ? ['NICHE REFERENCE DOCUMENT:', params.nicheDocContent, ''].join('\n') : null,
    params.creativeBriefContent
      ? ['CREATIVE BRIEF TEXT (compact canon):', params.creativeBriefContent, ''].join('\n')
      : null,
    'IDs FOR derivedFrom:',
    `storyBibleDocumentId=${params.storyBibleDocumentId}`,
    `creativeBriefDocumentId=${params.creativeBriefDocumentId ?? 'null'}`,
  ].filter(Boolean) as string[];
  return lines.join('\n');
}

/** Placeholder titleApprovedAt when deriving from locked title but no timestamp persisted. */
export function isoNow(): string {
  return new Date().toISOString();
}

export function safeParseCoverBrief(content: string): CoverBriefDocument | null {
  try {
    return parseCoverBrief(content.trim());
  } catch {
    return null;
  }
}
