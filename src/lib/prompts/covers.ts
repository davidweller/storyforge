import type { BackCoverBriefDocument, CoverBriefDocument, StoryBibleDocument } from '@/types';

/** System instruction for gpt-image-* text-to-image calls (wrapped with user prompt below). */
export const COVER_GENERATION_SYSTEM = `You are a professional book cover designer and commercial art director specialising in genre fiction. You understand that effective book covers must:

- Signal genre instantly at thumbnail size
- Communicate tone and emotional promise without text
- Use composition, lighting, and colour to guide the eye
- Integrate typography as a design element, not an afterthought
- Prioritise readability and contrast over fine detail

Generate covers that would be commercially competitive on Amazon KDP.
Output only the image. Do not add explanations or commentary.`;

export const COVER_BRIEF_SYSTEM = `You are a publishing art director with deep knowledge of commercial genre fiction cover design across fantasy, sci-fi, and romance. You analyse story canon and produce structured visual direction documents that brief cover designers and image generation models.

Your briefs are specific, grounded in the source material, and commercially actionable. You understand genre visual conventions and know how to translate narrative tone into colour, composition, and typographic direction.

Return only valid JSON matching the requested schema.`;

export const BACK_COVER_BRIEF_SYSTEM = `You are a paperback cover art director. Given an approved front-cover brief and front archetype context, produce JSON for a back-cover layout brief describing how the rear background image should continue the front cover's visual identity.

The back cover is an image only — no text, no blurb copy, no author name. Describe: how the background environment or mood should carry across from the front, what to avoid, and how to leave generous negative space in the lower third for the KDP barcode reserve zone.

Return only valid JSON matching the requested schema.`;

export const BACK_COVER_HARD_NO_TEXT_LINE =
  'No text of any kind, no letters, no numbers, no title, no author name, no blurb, no words anywhere in the image.';

export const HIGH_CLICK_BLOCK = `High-click optimisation: The central subject should be extremely large, filling 50-70% of the frame, possibly cropped at the edges. Simplify the background to soft gradients or haze. Use extreme contrast between subject and background. The title must be very large and bold with a strong drop shadow or outline for legibility at small sizes. Strip all micro-detail that turns to visual noise at thumbnail size. Design for maximum click-through rate rather than fine detail.`;

export type CoverArchetypeId =
  | 'A1'
  | 'A2'
  | 'A3'
  | 'A4'
  | 'A5'
  | 'A6'
  | 'A7'
  | 'R1'
  | 'R2'
  | 'R3'
  | 'R4'
  | 'R5'
  | 'R6';

export type ThumbnailStrength = 'High' | 'Very High';

export interface CoverArchetypeMeta {
  id: CoverArchetypeId;
  name: string;
  primaryGenres: string[];
  thumbnailStrength: ThumbnailStrength;
  sortOrder: number;
}

export const COVER_ARCHETYPES: CoverArchetypeMeta[] = [
  { id: 'A1', name: 'Icon / Symbol', primaryGenres: ['Fantasy', 'Sci‑Fi', 'Thriller'], thumbnailStrength: 'Very High', sortOrder: 10 },
  { id: 'A2', name: 'Character-Centric', primaryGenres: ['Fantasy', 'Sci‑Fi', 'Urban fantasy'], thumbnailStrength: 'High', sortOrder: 20 },
  { id: 'A3', name: 'Landscape / Worldbuilding', primaryGenres: ['Epic fantasy', 'Sci‑Fi'], thumbnailStrength: 'High', sortOrder: 30 },
  { id: 'A4', name: 'Object-in-World', primaryGenres: ['Fantasy', 'Sci‑Fi', 'Thriller'], thumbnailStrength: 'High', sortOrder: 40 },
  { id: 'A5', name: 'Action / Battle', primaryGenres: ['Fantasy', 'Military SF', 'Thriller'], thumbnailStrength: 'Very High', sortOrder: 50 },
  { id: 'A6', name: 'Emblem / Type-Driven', primaryGenres: ['Fantasy', 'Lit', 'Thriller'], thumbnailStrength: 'Very High', sortOrder: 60 },
  { id: 'A7', name: 'Mystery / Atmospheric', primaryGenres: ['Mystery', 'Thriller', 'Horror'], thumbnailStrength: 'High', sortOrder: 70 },
  { id: 'R1', name: 'Clinch / Couple', primaryGenres: ['Romance'], thumbnailStrength: 'Very High', sortOrder: 5 },
  { id: 'R2', name: 'Solo Character', primaryGenres: ['Romance', "Women's fiction"], thumbnailStrength: 'High', sortOrder: 15 },
  { id: 'R3', name: 'Romance Object / Symbol', primaryGenres: ['Romance'], thumbnailStrength: 'High', sortOrder: 25 },
  { id: 'R4', name: 'Illustrated / Cosy', primaryGenres: ['Rom-com', 'Cosy romance'], thumbnailStrength: 'High', sortOrder: 35 },
  { id: 'R5', name: 'Place / Atmosphere', primaryGenres: ['Romance'], thumbnailStrength: 'High', sortOrder: 45 },
  { id: 'R6', name: 'Typography-Dominant', primaryGenres: ['Contemporary romance'], thumbnailStrength: 'Very High', sortOrder: 55 },
];

const BASE_TEMPLATES: Record<CoverArchetypeId, string> = {
  A1: `A professional book cover for a [GENRE] novel.
Central focus: a single symbolic object — [SYMBOL] — centered on a clean or subtly textured background. The object should be large, iconic, and visually striking, with fine detail and dramatic lighting.
Background: minimal, with soft gradients or faint atmospheric texture, no clutter.
Mood: [TONE], conveyed through colour and lighting rather than environment.
Typography: large, clean, highly legible title "[TITLE]" and author name, integrated around the object.
Style: minimalist, premium, high contrast, designed for strong thumbnail visibility.
Negative: no characters, no busy scenes, no clutter.`,

  A2: `A cinematic book cover for a [GENRE] novel.
Central focus: a character — [DESCRIPTION] — shown [POSE], occupying the foreground.
Environment: [SETTING] behind them, slightly softened to keep focus on the character.
Mood: [TONE], expressed through lighting and posture.
Composition: character dominates the frame, clear silhouette, readable at thumbnail size.
Typography: bold title "[TITLE]" placed above or across the character, high contrast.
Style: cinematic realism, dramatic lighting.
Negative: no clutter, no multiple competing characters unless clearly grouped.`,

  A3: `A cinematic book cover for a [GENRE] novel.
Central focus: a sweeping environment — [LANDSCAPE] — vast and detailed, conveying scale and atmosphere.
Foreground: optional small figure or object for scale.
Mood: [TONE], expressed through weather, lighting, and colour.
Composition: strong depth (foreground, midground, background), wide cinematic framing.
Typography: large, readable title "[TITLE]" over sky or negative space.
Style: epic, immersive, high-detail digital painting.
Negative: avoid cluttered micro-detail that reduces readability.`,

  A4: `A professional book cover for a [GENRE] novel.
Central focus: a prominent object — [OBJECT] — placed in a grounded environment [SETTING].
The object should dominate the foreground, with the world supporting it in the background.
Mood: [TONE], realistic and grounded.
Lighting: cinematic, guiding attention to the object.
Typography: bold, clean title "[TITLE]" integrated into negative space.
Style: detailed, realistic, balanced composition.
Negative: no clutter, no competing focal points.`,

  A5: `A dynamic book cover for a [GENRE] novel.
Central focus: an action moment — [ACTION] — captured mid-motion.
Composition: strong directional movement, leading lines, clear focal action.
Environment: [SETTING], partially obscured by motion, smoke, or effects.
Mood: intense, high-stakes, kinetic.
Lighting: high contrast, dramatic highlights and shadows.
Typography: bold and highly legible title "[TITLE]" despite busy scene.
Negative: avoid chaotic clutter that obscures the main action.`,

  A6: `A clean, professional book cover for a [GENRE] novel.
Central focus: a stylised emblem or insignia — [SYMBOL] — centered.
Background: simple, textured or gradient.
Typography: dominant design element, large and bold title "[TITLE]", integrated with the emblem.
Mood: [TONE], conveyed through colour and type.
Style: graphic, modern, minimal.
Negative: no scenes, no characters, no clutter.`,

  A7: `A cinematic book cover for a [GENRE] novel.
Central focus: a partially obscured or mysterious subject — [SUBJECT] — emerging from shadow, fog, or light.
Environment: minimal, atmospheric, suggestive rather than explicit.
Mood: mysterious, tense, intriguing.
Lighting: low-key, with strong contrast and selective highlights.
Typography: clean and subtle title "[TITLE]", allowing mystery to dominate.
Negative: no over-explanation, no clutter.`,

  R1: `A professional romance novel cover.
Central focus: two characters — [DESCRIPTION_A] and [DESCRIPTION_B] — in close physical proximity, [POSE].
Lighting: warm, intimate, soft.
Environment: [SETTING], softened in the background.
Mood: [TONE_RO]
Typography: elegant or bold title "[TITLE]", integrated above or below the couple.
Style: cinematic, warm-toned, emotionally immediate.
Negative: no cold lighting, no visual clutter separating the characters.`,

  R2: `A professional romance novel cover.
Central focus: a single character — [DESCRIPTION] — [POSE], conveying [EMOTION].
Environment: [SETTING], atmospheric and supporting.
Mood: [TONE_RO]
Lighting: soft, directional, flattering.
Typography: elegant title "[TITLE]", placed to complement the character's negative space.
Style: warm, painterly or cinematic.
Negative: no cold tones, no action framing.`,

  R3: `A professional romance novel cover.
Central focus: a single symbolic object — [OBJECT] — centered or slightly offset on a clean or softly textured background.
Mood: [TONE_RO]
Colour palette: [PALETTE]
Lighting: soft, intimate, with gentle highlights on the object.
Typography: elegant, readable title "[TITLE]", integrated around the object.
Style: clean, premium, emotionally evocative.
Negative: no clutter, no characters, no cold tones.`,

  R4: `A professional illustrated romance novel cover.
Style: [ILLUSTRATION_STYLE], warm and inviting.
Central focus: [FOCAL] rendered in a clean, stylised way.
Colour palette: [PALETTE]
Mood: [TONE_RO]
Typography: bold, friendly, highly legible title "[TITLE]" — integrated into the illustration.
Negative: no photorealism, no dark or gritty tones.`,

  R5: `A professional romance novel cover.
Central focus: a setting — [LOCATION] — rendered atmospherically with strong mood and lighting.
No characters, or a very small distant figure for scale only.
Mood: [TONE_RO]
Lighting: [LIGHTING_RO]
Colour palette: [PALETTE]
Typography: elegant, prominent title "[TITLE]", placed in sky or negative space.
Style: painterly or cinematic, emotionally warm.
Negative: no cold tones, no action, no clutter.`,

  R6: `A professional romance novel cover.
The title "[TITLE]" is the dominant visual element, extremely large and bold.
Supporting image: subtle, textural, or illustrative background that supports the title without competing.
Mood: [TONE_RO]
Colour palette: [PALETTE], clean, high contrast.
Style: graphic, modern, confident.
Negative: no busy scenes, no characters that compete with the type.`,
};

function insertHighClick(template: string, highClick: boolean): string {
  if (!highClick) return template;
  if (template.includes('\nNegative:')) {
    return template.replace('\nNegative:', `\n\n${HIGH_CLICK_BLOCK}\nNegative:`);
  }
  return `${template}\n\n${HIGH_CLICK_BLOCK}`;
}

function substitute(template: string, map: Record<string, string>): string {
  let out = template;
  for (const [key, val] of Object.entries(map)) {
    out = out.split(`[${key}]`).join(val || '');
  }
  return out;
}

export function genreLooksRomance(genre: string, niche?: string): boolean {
  const g = `${genre} ${niche ?? ''}`.toLowerCase();
  return g.includes('romance') || g.includes('rom-com') || g.includes('romcom');
}

export function archetypesForGenreRows(genre: string, niche?: string): {
  recommended: CoverArchetypeMeta[];
  rest: CoverArchetypeMeta[];
} {
  const romance = genreLooksRomance(genre, niche);
  const pool = romance ? COVER_ARCHETYPES.filter((a) => a.id.startsWith('R')) : COVER_ARCHETYPES.filter((a) => a.id.startsWith('A'));
  const fallback = COVER_ARCHETYPES;
  const primary = pool.length > 0 ? pool : fallback;
  const sorted = [...primary].sort((a, b) => a.sortOrder - b.sortOrder);
  const recommended = sorted.slice(0, 5);
  const rest = COVER_ARCHETYPES.filter((a) => !recommended.some((r) => r.id === a.id)).sort((a, b) => a.sortOrder - b.sortOrder);
  return { recommended, rest };
}

/** Map cover-brief + story-bible into template tokens. */
export function buildCoverPromptTokens(params: {
  genre: string;
  title: string;
  coverBrief: CoverBriefDocument;
  storyBible: StoryBibleDocument;
}): Record<string, string> {
  const { genre, title, coverBrief, storyBible } = params;
  const tone = coverBrief.moodKeywords.join(', ');
  const palette = coverBrief.paletteDirection;
  const protagonist = storyBible.characters?.[0];
  const descParts = protagonist ? [protagonist.name, protagonist.role, protagonist.want].filter(Boolean) : [];
  const description = descParts.join(' — ') || 'the protagonist, emotionally readable at thumbnail scale';
  const setting =
    storyBible.worldRules?.slice(0, 2).join('; ') ||
    coverBrief.visualElements[0] ||
    'a setting consistent with genre promise';
  const symbol =
    coverBrief.visualElements[0] ||
    storyBible.unresolvedThreads?.[0]?.thread ||
    'a genre-appropriate central symbol';
  const object = coverBrief.visualElements[1] || coverBrief.visualElements[0] || symbol;
  const landscape = setting || 'expansive environment that reinforces genre and stakes';
  const action = `${coverBrief.visualElements.slice(0, 2).join('; ') || 'a decisive kinetic moment aligned with stakes'}`;
  const subject = coverBrief.visualElements[0] || storyBible.themes?.[0] || 'an enigmatic focal subject';
  const descriptionA =
    protagonist?.name && storyBible.characters?.[1]
      ? `${protagonist.name} (${protagonist.role})`
      : description;
  const descriptionB = storyBible.characters?.[1]
    ? `${storyBible.characters[1].name} (${storyBible.characters[1].role})`
    : loveInterestFallback(protagonist);
  const toneRo = `${tone}; warm relational tension`;
  return {
    GENRE: genre,
    TITLE: title,
    TONE: tone,
    SYMBOL: symbol,
    OBJECT: object,
    DESCRIPTION: description,
    SETTING: setting,
    LANDSCAPE: landscape,
    ACTION: action,
    SUBJECT: subject,
    DESCRIPTION_A: descriptionA,
    DESCRIPTION_B: descriptionB,
    POSE: genreLooksRomance(genre) ? 'in intimate proximity suggesting emotional pull' : 'in a heroic, readable silhouette',
    EMOTION: 'longing and resolve',
    PALETTE: palette,
    LOCATION: setting,
    TONE_RO: toneRo,
    ILLUSTRATION_STYLE: 'semi-flat illustration with cosy warmth',
    FOCAL: coverBrief.visualElements[0] || 'a cosy character moment or prop',
    LIGHTING_RO: 'golden-hour warmth',
  };
}

function loveInterestFallback(protagonist: StoryBibleDocument['characters'][number] | undefined): string {
  if (!protagonist) return 'the love interest, chemistry-forward';
  return `a compelling counterpart to ${protagonist.name}`;
}

/** Full multimodal-ready prompt sent to OpenAI Images (system + directive + archetype scene). */
export function assembleCoverPrompt(archetypeId: string, tokens: Record<string, string>, highClick: boolean): string {
  const id = archetypeId as CoverArchetypeId;
  const base = BASE_TEMPLATES[id];
  if (!base) throw new Error(`Unknown archetype: ${archetypeId}`);
  let t = substitute(base, tokens);
  t = `${COVER_GENERATION_SYSTEM}\n\n${t}`;
  return insertHighClick(t, highClick);
}

export function buildCoverBriefInstruction(): string {
  return `Produce a cover brief JSON object with:
- schemaVersion: 1
- generatedAt: ISO timestamp (UTC string)
- derivedFrom: { storyBibleDocumentId, creativeBriefDocumentId (nullable), titleApprovedAt }
- recommendedArchetypes: 3–6 entries { archetypeId, rationale }. Use ids A1–A7 and R1–R6 only; prefer ones that fit the genre.
- paletteDirection (string)
- visualElements (string array): concrete motifs from canon
- visualAvoid (string array)
- typographyDirection (string)
- moodKeywords (string array): 4–8 adjectives
- coverComps (string array): 2–3 comparable published titles or series names as plain strings

Canon and metadata are supplied below under "SOURCE MATERIAL". Respond with JSON only, no markdown.`;
}

export function buildCoverBriefPrompt(assembledCanon: string): string {
  return `${buildCoverBriefInstruction()}\n\n---\nSOURCE MATERIAL\n---\n${assembledCanon}`;
}

export function buildBackCoverBriefInstruction(): string {
  return `Return JSON only (no markdown) with:
schemaVersion 1,
derivedFrom: { coverBriefDocumentId, approvedCoverImageId },
backgroundStyle, moodContinuity, avoidElements[], compositionNotes (lower-third negative space / barcode reserve),
approvedAt null.

SOURCE CONTEXT follows.`;
}

export function buildBackCoverBriefPrompt(contextBlock: string): string {
  return `${buildBackCoverBriefInstruction()}\n\n---\n${contextBlock}\n`;
}

/** Image-only paperback back panel prompt. */
export function buildBackCoverImagePrompt(params: {
  genre: string;
  paletteDirection: string;
  moodKeywords: string[];
  backBrief: BackCoverBriefDocument;
  archetypeEcho?: string;
}): string {
  const { genre, paletteDirection, moodKeywords, backBrief } = params;
  const arche = (params.archetypeEcho ?? '').trim();
  const lines = [
    `Paint a full-bleed vertical book-cover BACK PANEL illustration only (${genre}), no mockups.`,
    `Palette and lighting continuity: ${paletteDirection}`,
    `Mood: ${moodKeywords.join(', ')}.`,
    `Background style brief: ${backBrief.backgroundStyle}`,
    `Atmosphere continuity: ${backBrief.moodContinuity}`,
    `Composition: ${backBrief.compositionNotes}`,
    arche ? `Maintain visual DNA from approved front archetype/environment notes: ${arche}` : null,
    `Avoid: ${[...backBrief.avoidElements, 'legible typography', 'barcodes', 'logos'].join('; ')}.`,
    BACK_COVER_HARD_NO_TEXT_LINE,
  ].filter(Boolean);
  return lines.join('\n');
}
