import type { APlusModuleType, APlusTextMode } from '@/types';

export const APLUS_BRIEF_SYSTEM = `Role
You are a senior Amazon KDP A+ visual strategist for fiction books.

Task
Generate a concise, production-ready image prompt brief for one A+ module image.

Output contract
Return strict JSON with:
- schemaVersion: 1
- generatedAt: ISO timestamp string
- moduleType: one of the requested module types
- promptDraft: final image prompt text
- suggestedText: string or null
- compositionNotes: string[]
- negativeConstraints: string[]

Rules
- Keep style aligned to the approved front cover tone provided by the user.
- Respect text mode:
  - none: do not render readable typography.
  - suggested: include short on-image copy suggestion.
  - custom: preserve custom wording exactly.
- Prefer cinematic, clean compositions suitable for fiction marketing.
- No markdown fences. JSON only.`;

const MODULE_BRIEFS: Record<APlusModuleType, string> = {
  'hero-banner': 'Hero/banner image for primary product module; cinematic focal moment.',
  'character-spotlight': 'Character-first module with clear identity and emotional hook.',
  'world-spotlight': 'Setting/world atmosphere module emphasizing place and mood.',
  'trope-promise': 'Trope/promise module that signals reading experience and stakes.',
  'series-author-brand': 'Series/author branding module with franchise continuity feel.',
  'quote-review': 'Quote/review visual card with strong typography-safe negative space.',
};

export function buildAPlusBriefPrompt(input: {
  title?: string;
  genre: string;
  niche?: string;
  canonContext: string;
  coverToneBlock: string;
  /** Subtitle/tagline + approved front tone — parallels server A+ merge. */
  coverCampaignPack?: string;
  moduleType: APlusModuleType;
  textMode: APlusTextMode;
  customText?: string;
}): string {
  const title = input.title?.trim() || 'Untitled';
  const niche = input.niche?.trim();
  const customText = input.customText?.trim();

  const textDirective =
    input.textMode === 'none'
      ? 'Do not render any readable text in the image.'
      : input.textMode === 'suggested'
        ? 'Suggest short in-image copy (3-12 words) suitable for this module.'
        : `Render this exact text in-image: "${customText || ''}"`;

  return `Create an A+ module image brief.

Title: ${title}
Genre: ${input.genre}${niche ? ` (${niche})` : ''}
Module type: ${input.moduleType}
Module intent: ${MODULE_BRIEFS[input.moduleType]}

Approved front cover style reference:
${input.coverToneBlock}

${input.coverCampaignPack?.trim()
  ? `Cover packaging & campaign cues:\n${input.coverCampaignPack.trim().slice(0, 2800)}\n`
  : ''}
Project canon context:
${input.canonContext.slice(0, 6000)}

Text mode: ${input.textMode}
Text directive: ${textDirective}

Write a production-ready image prompt draft for ChatGPT Images that stays on-brand with the approved cover style while fitting this module type. Return strict JSON matching the required contract.`;
}
