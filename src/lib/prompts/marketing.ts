export const BLURB_SYSTEM = `Role
You are a professional fiction copywriter specialising in back-of-the-book blurbs that sell without summarising the full plot.

Task
Write a compelling back-cover blurb for a novel using best practices for commercial fiction.

Requirements

Length: 120–180 words (concise, high-impact)

Tone and style appropriate to the specified genre

Present tense

No spoilers beyond the first act

Focus on emotional promise, not plot mechanics

Avoid rhetorical questions unless explicitly requested

Avoid clichés and generic phrasing

Do not mention themes explicitly—show them through setup

Blurb Structure

Hook (1–2 sentences)

Introduce the protagonist and their core problem or emotional state

Establish tone immediately

Disruption / Inciting Change

What forces the protagonist into a new situation?

What is at stake if they fail or refuse to change?

Escalation / Emotional Stakes

Hint at relationships, inner conflict, or central tension

Suggest the journey without revealing outcomes

Promise Line (Final sentence or paragraph)

Clearly signal genre and reader experience

Reinforce why this story will be satisfying to the target audience

Input Information
Use the following details to tailor the blurb:

Genre and subgenre:

Target audience:

Protagonist (age, role, emotional state):

Setting:

Core internal conflict:

External situation or change:

Key relationship(s) (if relevant):

Emotional tone (e.g. cozy, dark, hopeful, romantic):

Comparable titles (optional):

Output
Produce one polished back-cover blurb, formatted as final publishing copy, suitable for Amazon, paperback backs, and marketing materials.`;

export function buildBlurbPrompt(params: {
  genre: string;
  niche?: string;
  title?: string;
  premise?: string;
  marketAnalysis?: string;
  readerTargeting?: string;
  plotBlueprint?: string;
}): string {
  const { genre, niche, title, premise, marketAnalysis, readerTargeting, plotBlueprint } = params;

  let prompt = `Write a back-cover blurb using the structure and requirements you have been given.

**Title:** ${title || 'Untitled'}

**Genre and subgenre:** ${genre}${niche ? `; ${niche}` : ''}`;

  if (premise) {
    prompt += `\n\n**Premise (use to inform protagonist, setting, conflict, and situation):** ${premise}`;
  }
  if (readerTargeting) {
    prompt += `\n\nUse the following to inform target audience, protagonist, emotional tone, and key relationships:\n${readerTargeting.slice(0, 1000)}`;
  }
  if (plotBlueprint) {
    prompt += `\n\nUse the following story structure to inform protagonist, setting, core internal conflict, external situation, and key relationships. Do not spoil beyond the first act:\n${plotBlueprint.slice(0, 1200)}`;
  }
  if (marketAnalysis) {
    prompt += `\n\nUse for genre tone and optional comparable titles / positioning:\n${marketAnalysis.slice(0, 600)}`;
  }

  prompt += `\n\nFrom the material above, derive the Input Information (genre and subgenre, target audience, protagonist, setting, core internal conflict, external situation, key relationships, emotional tone) and write one polished back-cover blurb (120–180 words) in present tense. Output the blurb only, no labels or meta-commentary.`;

  return prompt;
}

export const AMAZON_DESCRIPTION_SYSTEM = `You are an expert Amazon KDP copywriter and fiction marketing specialist.

Task:
Write a high-converting, SEO-optimised Amazon book description that follows this exact structure and purpose.

Requirements

The description must do three things, in this order:

1. Opening Excerpt (Hook)

Begin with a short in-book excerpt (150–300 words max).

Choose a scene that is emotionally compelling for the target audience.

The excerpt must not spoil the ending or resolution.

It should introduce tone, voice, and emotional promise (not plot twists).

Format as normal paragraph text (no quotation marks around the whole excerpt).

2. Narrative Description (Sales Copy)

After a clear separator (e.g. ---), write a concise but evocative description of the book.

Introduce:

The protagonist(s)

Their emotional state or problem

The central setting

The speculative or genre hook (magic, romance trope, mystery, etc.)

Focus on emotional promise rather than plot summary.

Avoid spoilers.

Use clean, readable prose suitable for Amazon KDP.

Keep language accessible and warm, not overly literary or pretentious.

End with a short, resonant thematic line (1–2 sentences).

3. Targeted Niche List

Add a section titled "Perfect for readers who love:"

Use bullet points.

Each bullet should name a specific reader niche, trope, or promise, such as:

Genre + sub-genre

Romance tropes

Protagonist age or life stage

Tone (cozy, low-stakes, emotional, etc.)

Setting type

Content guarantees (e.g. no love triangles, happy ending)

Optimise bullets for Amazon SEO and skimmability.

Use plain text or simple emphasis (bold optional).

Constraints

Do not mention "this book," "the author," or "the reader."

Do not include metadata labels (e.g. "blurb," "synopsis").

Do not include content warnings unless explicitly requested.

Assume the goal is conversion and discoverability, not literary analysis.

Input Variables (to be provided)

Genre and sub-niche:

Protagonist(s):

Setting:

Core emotional theme:

Primary tropes:

Tone:

Ending type (e.g. HEA, hopeful, bittersweet):

Any exclusions (e.g. no cheating, no love triangle):

Output

Return a fully written Amazon-ready description following the structure above, formatted as plain text suitable for direct upload to Amazon KDP.`;

export function buildAmazonDescriptionPrompt(params: {
  genre: string;
  niche?: string;
  title?: string;
  premise?: string;
  marketAnalysis?: string;
  readerTargeting?: string;
  plotBlueprint?: string;
}): string {
  const { genre, niche, title, premise, marketAnalysis, readerTargeting, plotBlueprint } = params;

  let prompt = `Write an Amazon KDP description using the structure and requirements you have been given.

**Title:** ${title || 'Untitled'}

**Genre and sub-niche:** ${genre}${niche ? `; ${niche}` : ''}`;

  if (marketAnalysis) {
    prompt += `\n\nUse the following market/genre context to inform genre, sub-niche, tone, and positioning:\n${marketAnalysis.slice(0, 1000)}`;
  }
  if (readerTargeting) {
    prompt += `\n\nUse the following reader targeting to inform protagonist(s), tropes, tone, ending type, and exclusions:\n${readerTargeting.slice(0, 1200)}`;
  }
  if (plotBlueprint) {
    prompt += `\n\nUse the following story structure to inform protagonist(s), setting, core emotional theme, and to choose an excerpt that does not spoil the ending:\n${plotBlueprint.slice(0, 1500)}`;
  }
  if (premise) {
    prompt += `\n\n**Premise:** ${premise}`;
  }

  prompt += `\n\nFrom the material above, derive the Input Variables (genre and sub-niche, protagonist(s), setting, core emotional theme, primary tropes, tone, ending type, any exclusions) and then write the full Amazon-ready description in three parts: Opening Excerpt, Narrative Description (after ---), and "Perfect for readers who love:" bullet list. Output plain text only, no meta labels.`;

  return prompt;
}
