import type { NicheTropes } from '@/types';

function formatTropeHandles(items: Array<{ name: string }>): string {
  return items.map((trope) => `- ${trope.name}`).join('\n');
}

export const BLURB_SYSTEM = `Role
You are a professional fiction copywriter specialising in high-conversion back-of-the-book blurbs.

Task
Write a compelling back-cover blurb. "Sell the sizzle, not the steak"—intrigue and emotional pull without plot summary soup.

Requirements

Length: 80–120 words (tight; must fit a typical paperback back).

Tone: Match genre and niche. Evocative, punchy.

Voice: Third-person, present tense unless genre demands otherwise.

Protagonist integrity: Use exact names and traits from Character Profiles and approved canon. Do not invent or rename.

Structure (light touch — not labeled in output):
- Open with tension or a bold line.
- Ground the protagonist and disruption in few sharp strokes.
- End on stakes + genre promise.

Constraints:
- No spoilers beyond first act.
- Avoid "In a world where…", "Everything changes when…", rhetorical questions, and explicit theme labels.`;

export function buildBlurbPrompt(params: {
  genre: string;
  niche?: string;
  title?: string;
  premise?: string;
  marketAnalysis?: string;
  readerTargeting?: string;
  plotBlueprint?: string;
  charactersReference?: string;
  /** Approved Story Bible + Creative Brief excerpts (primary narrative canon). */
  approvedCanonContext?: string;
  tropes?: NicheTropes;
  /** When set (opt-in), append approved cover visual tone for alignment. */
  coverToneBlock?: string;
}): string {
  const {
    genre,
    niche,
    title,
    premise,
    marketAnalysis,
    readerTargeting,
    plotBlueprint,
    charactersReference,
    approvedCanonContext,
    tropes,
    coverToneBlock,
  } = params;

  let prompt = `Write a professional back-cover blurb.

**Title:** ${title || 'Untitled'}
**Genre/Niche:** ${genre}${niche ? `; ${niche}` : ''}`;

  if (approvedCanonContext?.trim()) {
    prompt += `\n\n**Approved canon (Story Bible / Creative Brief — obey names, tone, promises):**\n${approvedCanonContext.trim().slice(0, 12_000)}`;
  }

  if (charactersReference) {
    prompt += `\n\n**Character Profiles (PRIMARY SOURCE FOR NAMES):**\n${charactersReference.slice(0, 2000)}`;
  }

  if (premise) {
    prompt += `\n\n**Premise:** ${premise}`;
  }

  if (plotBlueprint) {
    prompt += `\n\n**Story Structure (Plot Blueprint):**\n${plotBlueprint.slice(0, 2500)}`;
  }

  if (readerTargeting) {
    prompt += `\n\n**Reader Targeting & Audience:**\n${readerTargeting.slice(0, 1000)}`;
  }

  if (tropes) {
    prompt += `\n\n**Reader tropes (must-includes):**\n${formatTropeHandles(tropes.mustInclude)}\n\n**Reader tropes (avoid):**\n${formatTropeHandles(tropes.avoid)}`;
  }

  if (marketAnalysis) {
    prompt += `\n\n**Market Analysis & Tone:**\n${marketAnalysis.slice(0, 1000)}`;
  }

  if (coverToneBlock?.trim()) {
    prompt += `\n\n${coverToneBlock.trim()}`;
  }

  prompt += `\n\nBased on the above, write one polished blurb (80–120 words) in present tense. Match Character Profiles and approved canon for names. Output the blurb only.`;

  return prompt;
}

export const AMAZON_DESCRIPTION_SYSTEM = `You are an expert Amazon KDP copywriter and fiction marketing specialist.

Task:
Write a tight, high-converting Amazon book description readers skim in seconds.

Requirements:
1. Opening hook: Either a one-line quote in quotation marks OR one bold dramatic statement (not both). Max 2 short sentences after that for mood.
2. Pitch: Short benefit-led body—total body (hook + pitch) under ~120 words before the bullet block. No long fake "excerpt" scenes.
3. "Perfect for readers who love:" — bullet list of tropes, comps, vibes (keep to 4–7 bullets).

Character integrity: Exact names and details from Character Profiles and approved canon.

Output: Plain text. Use --- on its own line between the pitch block and the bullet section. Use leading "- " for bullets.`;

export function buildAmazonDescriptionPrompt(params: {
  genre: string;
  niche?: string;
  title?: string;
  premise?: string;
  marketAnalysis?: string;
  readerTargeting?: string;
  plotBlueprint?: string;
  charactersReference?: string;
  blurb?: string;
  /** Approved Story Bible + Creative Brief excerpts (primary narrative canon). */
  approvedCanonContext?: string;
  tropes?: NicheTropes;
  coverToneBlock?: string;
}): string {
  const {
    genre,
    niche,
    title,
    premise,
    marketAnalysis,
    readerTargeting,
    plotBlueprint,
    charactersReference,
    blurb,
    approvedCanonContext,
    tropes,
    coverToneBlock,
  } = params;

  let prompt = `Write an Amazon KDP description.

**Title:** ${title || 'Untitled'}
**Genre/Niche:** ${genre}${niche ? `; ${niche}` : ''}`;

  if (approvedCanonContext?.trim()) {
    prompt += `\n\n**Approved canon (Story Bible / Creative Brief — obey names, world, tone):**\n${approvedCanonContext.trim().slice(0, 12_000)}`;
  }

  if (charactersReference) {
    prompt += `\n\n**Character Profiles (CANONICAL NAMES):**\n${charactersReference.slice(0, 2000)}`;
  }

  if (blurb) {
    prompt += `\n\n**Approved back-cover Blurb (Match tone and promise; Amazon copy can expand but must not contradict):**\n${blurb}`;
  }

  if (plotBlueprint) {
    prompt += `\n\n**Story Structure (Plot Blueprint):**\n${plotBlueprint.slice(0, 3000)}`;
  }

  if (readerTargeting) {
    prompt += `\n\n**Target Audience & Tropes:**\n${readerTargeting.slice(0, 1500)}`;
  }

  if (tropes) {
    prompt += `\n\n**Structured reader tropes:**\nMust include:\n${formatTropeHandles(tropes.mustInclude)}\n\nConsider including:\n${formatTropeHandles(tropes.considerIncluding)}\n\nAvoid:\n${formatTropeHandles(tropes.avoid)}`;
  }

  if (marketAnalysis) {
    prompt += `\n\n**Market Analysis:**\n${marketAnalysis.slice(0, 1000)}`;
  }

  if (premise) {
    prompt += `\n\n**Premise:** ${premise}`;
  }

  if (coverToneBlock?.trim()) {
    prompt += `\n\n${coverToneBlock.trim()}`;
  }

  prompt += `\n\nWrite:
1. Hook (quote OR one bold opening line) plus a very short pitch — keep skim-friendly; body before bullets under ~120 words.
2. A --- separator on its own line.
3. "Perfect for readers who love:" then bullets using "- ".

Strictly adhere to character names from references and approved canon. Output plain text only.`;
  if (tropes) {
    prompt += `\n\nUse the supplied reader tropes as the spine of the "Perfect for readers who love" bullet list. Every must-include trope must appear in the bullets, phrased as a reader-facing promise (e.g. "Slow-burn enemies to lovers with a redemption arc"). Add 2-3 bullets from considerIncluding where they reinforce the must-includes. Do not list tropes from the avoid set.`;
  }

  return prompt;
}
