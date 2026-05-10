import type { ProjectDocument } from '@/types';

const STORY_BIBLE_MAX = 8_000;
const CREATIVE_BRIEF_MAX = 4_000;

/**
 * Approved Story Bible / Creative Brief text for marketing and cover prompts.
 * Keeps payloads bounded while prioritising canon over raw planning docs alone.
 */
/** For marketing prompts: structured markdown-lite block from approved canon docs. */
export function approvedCanonMarkdownBlock(documents: ProjectDocument[]): string {
  const { storyBibleExcerpt, creativeBriefExcerpt } = approvedCanonExcerpts(documents);
  const chunks: string[] = [];
  if (creativeBriefExcerpt.trim()) {
    chunks.push(`## Creative Brief (approved)\n${creativeBriefExcerpt}`);
  }
  if (storyBibleExcerpt.trim()) {
    chunks.push(`## Story Bible (approved)\n${storyBibleExcerpt}`);
  }
  return chunks.join('\n\n').trim();
}

export function approvedCanonExcerpts(documents: ProjectDocument[]): {
  storyBibleExcerpt: string;
  creativeBriefExcerpt: string;
} {
  const storyBible = documents.find((d) => d.type === 'story-bible' && d.approved)?.content?.trim() ?? '';
  const creativeBrief = documents.find((d) => d.type === 'creative-brief' && d.approved)?.content?.trim() ?? '';
  return {
    storyBibleExcerpt: storyBible.length > STORY_BIBLE_MAX ? `${storyBible.slice(0, STORY_BIBLE_MAX)}…` : storyBible,
    creativeBriefExcerpt:
      creativeBrief.length > CREATIVE_BRIEF_MAX ? `${creativeBrief.slice(0, CREATIVE_BRIEF_MAX)}…` : creativeBrief,
  };
}

/** Compact prose block for image-generation prompts (avoids dumping full JSON). */
export function formatCanonSummaryForCoverPrompt(documents: ProjectDocument[]): string {
  const { storyBibleExcerpt, creativeBriefExcerpt } = approvedCanonExcerpts(documents);
  const parts: string[] = [];
  if (creativeBriefExcerpt) {
    parts.push('Creative Brief (approved, compact canon):', creativeBriefExcerpt);
  }
  if (storyBibleExcerpt) {
    parts.push('Story Bible (approved; use for tone, symbolism, protagonist, avoid contradicting canon):', storyBibleExcerpt.slice(0, 6_000));
  }
  return parts.join('\n\n').trim();
}
