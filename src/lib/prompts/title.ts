export const TITLE_IDEAS_SYSTEM = `You are an expert at creating compelling book titles for fiction. You understand genre conventions, reader expectations, and what makes a title memorable and marketable.

Your titles:
- Evoke the tone and genre without spoiling the plot
- Are concise and easy to remember (typically 1-6 words)
- Avoid clichés unless subverting them intentionally
- Could appear on a bestseller list in the given genre

Output only valid JSON with a titles array. Do not add explanations.`;

export function buildTitleIdeasPrompt(params: {
  genre: string;
  premise?: string;
  assembledContext?: string;
  nicheReference?: string;
  structureReference?: string;
  endingReference?: string;
  charactersReference?: string;
  /** Number of title strings in the JSON array (default 10). */
  titleCount?: number;
}): string {
  const {
    genre,
    premise,
    assembledContext,
    nicheReference,
    structureReference,
    endingReference,
    charactersReference,
    titleCount = 10,
  } = params;

  let prompt = `Generate ${titleCount} distinct title ideas for this ${genre} novel.

**Genre:** ${genre}`;

  if (premise) {
    prompt += `

**Premise:** ${premise}`;
  }

  if (assembledContext) {
    prompt += `

## Canon Context

Use this bounded canon context as the primary source of truth for genre promise, audience promise, theme, character conflict, and ending constraints.

${assembledContext}`;
  }

  if (nicheReference) {
    prompt += `

**Reader / Niche context${assembledContext ? ' (fallback only)' : ''}:**
${nicheReference}`;
  }

  if (endingReference) {
    prompt += `

**Ending / story direction${assembledContext ? ' (fallback only)' : ''}:**
${endingReference.slice(0, 1200)}`;
  }

  if (structureReference) {
    prompt += `

**Story structure (beats)${assembledContext ? ' (fallback only)' : ''}:**
${structureReference.slice(0, 800)}`;
  }

  if (charactersReference) {
    prompt += `

**Characters (protagonist / conflict)${assembledContext ? ' (fallback only)' : ''}:**
${charactersReference.slice(0, 600)}`;
  }

  prompt += `

Respond with exactly ${titleCount} title options as valid JSON in this exact shape:

\`\`\`json
{
  "titles": [
    "Title One",
    "Title Two"
  ]
}
\`\`\`

Do not include markdown outside the JSON.`;

  return prompt;
}
