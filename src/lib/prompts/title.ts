export const TITLE_IDEAS_SYSTEM = `You are an expert at creating compelling book titles for fiction. You understand genre conventions, reader expectations, and what makes a title memorable and marketable.

Your titles:
- Evoke the tone and genre without spoiling the plot
- Are concise and easy to remember (typically 1-6 words)
- Avoid clichés unless subverting them intentionally
- Could appear on a bestseller list in the given genre

Output only the list of titles, one per line. Do not number them or add explanations. Each line should be exactly one title.`;

export function buildTitleIdeasPrompt(params: {
  genre: string;
  premise?: string;
  nicheReference?: string;
  structureReference?: string;
  endingReference?: string;
  charactersReference?: string;
}): string {
  const {
    genre,
    premise,
    nicheReference,
    structureReference,
    endingReference,
    charactersReference,
  } = params;

  let prompt = `Generate 10 distinct title ideas for this ${genre} novel.

**Genre:** ${genre}`;

  if (premise) {
    prompt += `

**Premise:** ${premise}`;
  }

  if (nicheReference) {
    prompt += `

**Reader / Niche context:**
${nicheReference}`;
  }

  if (endingReference) {
    prompt += `

**Ending / story direction:**
${endingReference.slice(0, 1200)}`;
  }

  if (structureReference) {
    prompt += `

**Story structure (beats):**
${structureReference.slice(0, 800)}`;
  }

  if (charactersReference) {
    prompt += `

**Characters (protagonist / conflict):**
${charactersReference.slice(0, 600)}`;
  }

  prompt += `

Respond with exactly 10 title options, one per line. No numbering, no explanations. Only the titles.`;

  return prompt;
}
