export const BLURB_SYSTEM = `Role
You are a professional fiction copywriter specialising in high-conversion back-of-the-book blurbs.

Task
Write a compelling back-cover blurb for a novel. Your goal is to "sell the sizzle, not the steak"—create intrigue and emotional connection without summarising the entire plot.

Requirements

Length: 120–180 words.

Tone and Style: Match the specified genre and niche. Use evocative, punchy prose.

Voice: Third-person, present tense (unless the genre specifically demands otherwise).

Protagonist Integrity: You MUST use the exact character names and traits provided in the Character Profiles reference. Do not hallucinate or change names.

Structure:
1. The Hook: A bold opening that captures the central conflict or premise.
2. The Setup: Introduce the protagonist and their world. What do they want? What is their current state?
3. The Disruption: What changes everything? What is the inciting incident?
4. The Stakes: What happens if they fail? Focus on internal and external consequences.
5. The Promise: A final sentence that signals the genre's payoff and leaves the reader wanting more.

Constraints:
- No spoilers beyond the first act.
- Avoid clichés like "In a world where..." or "Everything changes when..."
- Do not mention themes explicitly.
- Avoid rhetorical questions.`;

export function buildBlurbPrompt(params: {
  genre: string;
  niche?: string;
  title?: string;
  premise?: string;
  marketAnalysis?: string;
  readerTargeting?: string;
  plotBlueprint?: string;
  charactersReference?: string;
}): string {
  const { genre, niche, title, premise, marketAnalysis, readerTargeting, plotBlueprint, charactersReference } = params;

  let prompt = `Write a professional back-cover blurb.

**Title:** ${title || 'Untitled'}
**Genre/Niche:** ${genre}${niche ? `; ${niche}` : ''}`;

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

  if (marketAnalysis) {
    prompt += `\n\n**Market Analysis & Tone:**\n${marketAnalysis.slice(0, 1000)}`;
  }

  prompt += `\n\nBased on the above, write one polished blurb (120–180 words) in present tense. Ensure the protagonist's name and role strictly match the Character Profiles provided. Output the blurb only.`;

  return prompt;
}

export const AMAZON_DESCRIPTION_SYSTEM = `You are an expert Amazon KDP copywriter and fiction marketing specialist.

Task:
Write a high-converting, SEO-optimised Amazon book description.

Requirements:
1. Opening Excerpt (The Hook): A 150–300 word scene from the book that establishes tone and character voice.
2. Narrative Sales Copy (The Pitch): A concise, evocative description of the journey.
3. "Perfect for readers who love" (The Targeting): A bulleted list of tropes, genres, and comparable vibes.

Character Integrity: Use the exact names and details from the Character Profiles. Do not deviate from canonical names.

Formatting: Use HTML-style bolding (<b>...</b>) sparingly for emphasis if requested, or plain text with clear headings. Use --- as a separator between the excerpt and the pitch.`;

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
}): string {
  const { genre, niche, title, premise, marketAnalysis, readerTargeting, plotBlueprint, charactersReference, blurb } = params;

  let prompt = `Write an Amazon KDP description.

**Title:** ${title || 'Untitled'}
**Genre/Niche:** ${genre}${niche ? `; ${niche}` : ''}`;

  if (charactersReference) {
    prompt += `\n\n**Character Profiles (CANONICAL NAMES):**\n${charactersReference.slice(0, 2000)}`;
  }

  if (blurb) {
    prompt += `\n\n**Approved Blurb (Use for tone and consistency):**\n${blurb}`;
  }

  if (plotBlueprint) {
    prompt += `\n\n**Story Structure (Plot Blueprint):**\n${plotBlueprint.slice(0, 3000)}`;
  }

  if (readerTargeting) {
    prompt += `\n\n**Target Audience & Tropes:**\n${readerTargeting.slice(0, 1500)}`;
  }

  if (marketAnalysis) {
    prompt += `\n\n**Market Analysis:**\n${marketAnalysis.slice(0, 1000)}`;
  }

  if (premise) {
    prompt += `\n\n**Premise:** ${premise}`;
  }

  prompt += `\n\nWrite the description in three parts:
1. An immersive opening excerpt (choose/invent based on character voice and blueprint).
2. A compelling narrative description (pitch) after a --- separator.
3. A "Perfect for readers who love:" bulleted list.

Strictly adhere to the character names in the reference. Output plain text only.`;

  return prompt;
}
