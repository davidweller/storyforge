import type {
  BackCoverBriefDocument,
  BackCoverBriefDocumentLegacy,
  BackCoverBriefDocumentV2,
  CoverBriefDocument,
  CoverBriefDocumentLegacy,
  CoverBriefDocumentV2,
  StoryBibleDocument,
} from '@/types';
import { isBackCoverBriefV2 } from '@/types';

/** System instruction for gpt-image-* text-to-image calls (wrapped with user prompt below). */
export const COVER_GENERATION_SYSTEM = `You are a professional book cover designer and commercial art director specialising in genre fiction. You understand that effective book covers must:

- Signal genre instantly at thumbnail size
- Communicate tone and emotional promise without text (aside from the title and author name)
- Use composition, lighting, and colour to guide the eye
- Integrate typography as a design element, not an afterthought
- Prioritise readability and contrast over fine detail
- EXACT TEXT GENERATION: You MUST generate the exact text provided for the Title and Author Name directly in the image typography. Ensure it is spelled exactly as provided.

Generate covers that would be commercially competitive on Amazon KDP.
Output only the image. Do not add explanations or commentary.`;

export const COVER_BRIEF_SYSTEM = `You are a publishing art director with deep knowledge of commercial genre fiction cover design across fantasy, sci-fi, and romance. You analyse story canon and produce structured visual direction documents that brief cover designers and image generation models.

Your briefs are divided into the specific visual layers that define the selected archetype. Each layer must be concise, specific, and grounded in the source canon. Descriptions must be actionable for an image model.

Return only valid JSON matching the requested schema. Do not include markdown fences or commentary.`;

export const BACK_COVER_BRIEF_SYSTEM = `You are a paperback cover art director. Given an approved front-cover brief, front archetype context, and the book's blurb, produce JSON for a back-cover layout brief describing how the rear image should continue the front cover's visual identity and incorporate the text.

The back cover MUST include the provided blurb text directly in the image typography. Describe: how the background environment or mood should carry across from the front, how to integrate the blurb text clearly and legibly, what to avoid, and importantly: leave an empty rectangular space in the lower corner for a barcode. Do NOT draw a fake barcode; just leave a blank or uninteresting space where the user will place one later.

Return only valid JSON matching the requested schema.`;

export const BACK_COVER_EXACT_TEXT_LINE =
  'EXACT TEXT GENERATION: You MUST include the exact blurb text provided directly in the image. Ensure the text is highly legible. Do NOT add a fake barcode, but leave an empty rectangular space in the lower right or lower middle for a real barcode to be added later.';

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
  description: string;
  primaryGenres: string[];
  thumbnailStrength: ThumbnailStrength;
  sortOrder: number;
}

export const COVER_ARCHETYPES: CoverArchetypeMeta[] = [
  { id: 'A1', name: 'Icon / Symbol', description: 'A single iconic object or symbol centered on a minimal background. Highly readable at thumbnail size.', primaryGenres: ['Fantasy', 'Sci‑Fi', 'Thriller'], thumbnailStrength: 'Very High', sortOrder: 10 },
  { id: 'A2', name: 'Character-Centric', description: 'A cinematic character occupying the foreground with the environment softened behind them.', primaryGenres: ['Fantasy', 'Sci‑Fi', 'Urban fantasy'], thumbnailStrength: 'High', sortOrder: 20 },
  { id: 'A3', name: 'Landscape / Worldbuilding', description: 'A sweeping, vast environment conveying scale and atmosphere.', primaryGenres: ['Epic fantasy', 'Sci‑Fi'], thumbnailStrength: 'High', sortOrder: 30 },
  { id: 'A4', name: 'Object-in-World', description: 'A prominent object placed in a grounded, realistic environment.', primaryGenres: ['Fantasy', 'Sci‑Fi', 'Thriller'], thumbnailStrength: 'High', sortOrder: 40 },
  { id: 'A5', name: 'Action / Battle', description: 'A dynamic, kinetic moment captured mid-motion with high stakes.', primaryGenres: ['Fantasy', 'Military SF', 'Thriller'], thumbnailStrength: 'Very High', sortOrder: 50 },
  { id: 'A6', name: 'Emblem / Type-Driven', description: 'A clean, modern emblem or insignia integrated heavily with the typography.', primaryGenres: ['Fantasy', 'Lit', 'Thriller'], thumbnailStrength: 'Very High', sortOrder: 60 },
  { id: 'A7', name: 'Mystery / Atmospheric', description: 'A partially obscured subject emerging from shadow, fog, or light.', primaryGenres: ['Mystery', 'Thriller', 'Horror'], thumbnailStrength: 'High', sortOrder: 70 },
  { id: 'R1', name: 'Clinch / Couple', description: 'Two characters in close physical proximity with warm, intimate lighting.', primaryGenres: ['Romance'], thumbnailStrength: 'Very High', sortOrder: 5 },
  { id: 'R2', name: 'Solo Character', description: 'A single character conveying strong emotion in an atmospheric setting.', primaryGenres: ['Romance', "Women's fiction"], thumbnailStrength: 'High', sortOrder: 15 },
  { id: 'R3', name: 'Romance Object / Symbol', description: 'An emotionally evocative object centered on a soft background.', primaryGenres: ['Romance'], thumbnailStrength: 'High', sortOrder: 25 },
  { id: 'R4', name: 'Illustrated / Cosy', description: 'A warm, stylised illustration with friendly, legible typography.', primaryGenres: ['Rom-com', 'Cosy romance'], thumbnailStrength: 'High', sortOrder: 35 },
  { id: 'R5', name: 'Place / Atmosphere', description: 'A strong atmospheric setting without prominent characters.', primaryGenres: ['Romance'], thumbnailStrength: 'High', sortOrder: 45 },
  { id: 'R6', name: 'Typography-Dominant', description: 'The title is the dominant visual element against a clean, textural background.', primaryGenres: ['Contemporary romance'], thumbnailStrength: 'Very High', sortOrder: 55 },
];

const BASE_TEMPLATES: Record<CoverArchetypeId, string> = {
  A1: `A professional book cover for a [GENRE] novel.
Central focus: a single symbolic object — [SYMBOL] — centered on a clean or subtly textured background. The object should be large, iconic, and visually striking, with fine detail and dramatic lighting.
Background: minimal, with soft gradients or faint atmospheric texture, no clutter.
Mood: [TONE], conveyed through colour and lighting rather than environment.
Typography: large, clean, highly legible text reading exactly "[TITLE]" for the title and "[AUTHOR]" for the author name, integrated around the object.
Style: minimalist, premium, high contrast, designed for strong thumbnail visibility.
Negative: no characters, no busy scenes, no clutter.`,

  A2: `A cinematic book cover for a [GENRE] novel.
Central focus: a character — [DESCRIPTION] — shown [POSE], occupying the foreground.
Environment: [SETTING] behind them, slightly softened to keep focus on the character.
Mood: [TONE], expressed through lighting and posture.
Composition: character dominates the frame, clear silhouette, readable at thumbnail size.
Typography: bold text reading exactly "[TITLE]" for the title and "[AUTHOR]" for the author name placed above or across the character, high contrast.
Style: cinematic realism, dramatic lighting.
Negative: no clutter, no multiple competing characters unless clearly grouped.`,

  A3: `A cinematic book cover for a [GENRE] novel.
Central focus: a sweeping environment — [LANDSCAPE] — vast and detailed, conveying scale and atmosphere.
Foreground: optional small figure or object for scale.
Mood: [TONE], expressed through weather, lighting, and colour.
Composition: strong depth (foreground, midground, background), wide cinematic framing.
Typography: large, readable text reading exactly "[TITLE]" for the title and "[AUTHOR]" for the author name over sky or negative space.
Style: epic, immersive, high-detail digital painting.
Negative: avoid cluttered micro-detail that reduces readability.`,

  A4: `A professional book cover for a [GENRE] novel.
Central focus: a prominent object — [OBJECT] — placed in a grounded environment [SETTING].
The object should dominate the foreground, with the world supporting it in the background.
Mood: [TONE], realistic and grounded.
Lighting: cinematic, guiding attention to the object.
Typography: bold, clean text reading exactly "[TITLE]" for the title and "[AUTHOR]" for the author name integrated into negative space.
Style: detailed, realistic, balanced composition.
Negative: no clutter, no competing focal points.`,

  A5: `A dynamic book cover for a [GENRE] novel.
Central focus: an action moment — [ACTION] — captured mid-motion.
Composition: strong directional movement, leading lines, clear focal action.
Environment: [SETTING], partially obscured by motion, smoke, or effects.
Mood: intense, high-stakes, kinetic.
Lighting: high contrast, dramatic highlights and shadows.
Typography: bold and highly legible text reading exactly "[TITLE]" for the title and "[AUTHOR]" for the author name despite busy scene.
Negative: avoid chaotic clutter that obscures the main action.`,

  A6: `A clean, professional book cover for a [GENRE] novel.
Central focus: a stylised emblem or insignia — [SYMBOL] — centered.
Background: simple, textured or gradient.
Typography: dominant design element, large and bold text reading exactly "[TITLE]" for the title and "[AUTHOR]" for the author name, integrated with the emblem.
Mood: [TONE], conveyed through colour and type.
Style: graphic, modern, minimal.
Negative: no scenes, no characters, no clutter.`,

  A7: `A cinematic book cover for a [GENRE] novel.
Central focus: a partially obscured or mysterious subject — [SUBJECT] — emerging from shadow, fog, or light.
Environment: minimal, atmospheric, suggestive rather than explicit.
Mood: mysterious, tense, intriguing.
Lighting: low-key, with strong contrast and selective highlights.
Typography: clean and subtle text reading exactly "[TITLE]" for the title and "[AUTHOR]" for the author name, allowing mystery to dominate.
Negative: no over-explanation, no clutter.`,

  R1: `A professional romance novel cover.
Central focus: two characters — [DESCRIPTION_A] and [DESCRIPTION_B] — in close physical proximity, [POSE].
Lighting: warm, intimate, soft.
Environment: [SETTING], softened in the background.
Mood: [TONE_RO]
Typography: elegant or bold text reading exactly "[TITLE]" for the title and "[AUTHOR]" for the author name, integrated above or below the couple.
Style: cinematic, warm-toned, emotionally immediate.
Negative: no cold lighting, no visual clutter separating the characters.`,

  R2: `A professional romance novel cover.
Central focus: a single character — [DESCRIPTION] — [POSE], conveying [EMOTION].
Environment: [SETTING], atmospheric and supporting.
Mood: [TONE_RO]
Lighting: soft, directional, flattering.
Typography: elegant text reading exactly "[TITLE]" for the title and "[AUTHOR]" for the author name, placed to complement the character's negative space.
Style: warm, painterly or cinematic.
Negative: no cold tones, no action framing.`,

  R3: `A professional romance novel cover.
Central focus: a single symbolic object — [OBJECT] — centered or slightly offset on a clean or softly textured background.
Mood: [TONE_RO]
Colour palette: [PALETTE]
Lighting: soft, intimate, with gentle highlights on the object.
Typography: elegant, readable text reading exactly "[TITLE]" for the title and "[AUTHOR]" for the author name, integrated around the object.
Style: clean, premium, emotionally evocative.
Negative: no clutter, no characters, no cold tones.`,

  R4: `A professional illustrated romance novel cover.
Style: [ILLUSTRATION_STYLE], warm and inviting.
Central focus: [FOCAL] rendered in a clean, stylised way.
Colour palette: [PALETTE]
Mood: [TONE_RO]
Typography: bold, friendly, highly legible text reading exactly "[TITLE]" for the title and "[AUTHOR]" for the author name — integrated into the illustration.
Negative: no photorealism, no dark or gritty tones.`,

  R5: `A professional romance novel cover.
Central focus: a setting — [LOCATION] — rendered atmospherically with strong mood and lighting.
No characters, or a very small distant figure for scale only.
Mood: [TONE_RO]
Lighting: [LIGHTING_RO]
Colour palette: [PALETTE]
Typography: elegant, prominent text reading exactly "[TITLE]" for the title and "[AUTHOR]" for the author name, placed in sky or negative space.
Style: painterly or cinematic, emotionally warm.
Negative: no cold tones, no action, no clutter.`,

  R6: `A professional romance novel cover.
The typography is the dominant visual element. It must include exactly the text "[TITLE]" for the title and "[AUTHOR]" for the author name, extremely large and bold.
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
  authorName?: string;
  coverBrief: CoverBriefDocumentLegacy;
  storyBible: StoryBibleDocument;
}): Record<string, string> {
  const { genre, title, authorName, coverBrief, storyBible } = params;
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
    AUTHOR: authorName || 'Bestselling Author',
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
backgroundStyle, moodContinuity, avoidElements[], compositionNotes (where to place blurb text, and lower-corner negative space for barcode reserve),
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
  blurb?: string;
}): string {
  const { genre, paletteDirection, moodKeywords, archetypeEcho, blurb } = params;
  const { backBrief } = params;
  const arche = (archetypeEcho ?? '').trim();
  if (isBackCoverBriefV2(backBrief)) {
    const L = backBrief.layers;
    const avoid = [...backBrief.visualAvoid, 'fake barcodes', 'unauthorized logos'];
    const blurLine = blurb?.trim() || L.blurbTextArea.blurbText;
    const lines = [
      `${COVER_GENERATION_SYSTEM}`,
      '',
      `Paint a full-bleed vertical book-cover BACK PANEL illustration (${genre}), no mockups.`,
      `Background: ${L.background.description} (${L.background.styleNotes})`,
      `Blurb placement & type: ${L.blurbTextArea.placement}. ${L.blurbTextArea.typographyTreatment}. ${L.blurbTextArea.contrastNotes}`,
      L.authorBioArea
        ? `Author bio zone: ${L.authorBioArea.placement}. ${L.authorBioArea.bioText}. ${L.authorBioArea.photoPlaceholderNotes}`
        : null,
      L.publisherLogoArea
        ? `Publisher / logo zone: ${L.publisherLogoArea.placement}. ${L.publisherLogoArea.sizingNotes}`
        : null,
      `Barcode reserve: ${L.barcodeArea.placement}. ${L.barcodeArea.sizeNotes}`,
      `Front palette continuity: ${paletteDirection}`,
      `Mood: ${(moodKeywords.length ? moodKeywords : backBrief.moodKeywords).join(', ')}.`,
      arche ? `Front cover visual DNA: ${arche}` : null,
      blurLine ? `BLURB TEXT TO INCLUDE: ${blurLine}` : null,
      `Avoid: ${avoid.join('; ')}.`,
      BACK_COVER_EXACT_TEXT_LINE,
    ].filter(Boolean);
    return lines.join('\n');
  }
  const legacy = backBrief as BackCoverBriefDocumentLegacy;
  const lines = [
    `Paint a full-bleed vertical book-cover BACK PANEL illustration (${genre}), no mockups.`,
    `Palette and lighting continuity: ${paletteDirection}`,
    `Mood: ${moodKeywords.join(', ')}.`,
    `Background style brief: ${legacy.backgroundStyle}`,
    `Atmosphere continuity: ${legacy.moodContinuity}`,
    `Composition: ${legacy.compositionNotes}`,
    arche ? `Maintain visual DNA from approved front archetype/environment notes: ${arche}` : null,
    blurb ? `BLURB TEXT TO INCLUDE: ${blurb}` : null,
    `Avoid: ${[...legacy.avoidElements, 'fake barcodes', 'logos'].join('; ')}.`,
    BACK_COVER_EXACT_TEXT_LINE,
  ].filter(Boolean);
  return lines.join('\n');
}

function visualAvoidLine(avoid: string[]): string {
  return avoid.length ? avoid.join(', ') : 'none specified';
}

/** Core scene description from v2 brief (no system block, no high-click). */
export function buildCoverPromptBodyV2(genre: string, brief: CoverBriefDocumentV2): string {
  const { layers: L, moodKeywords, visualAvoid, archetypeId } = brief;
  const id = archetypeId as CoverArchetypeId;
  const mkw = moodKeywords.join(', ');
  const neg = visualAvoidLine(visualAvoid);

  const T = L.text;
  const title = T.titleText;
  const author = T.authorText;
  const series = T.seriesText?.trim() ? ` Series: ${T.seriesText}.` : '';

  switch (id) {
    case 'A1': {
      const sym = L.symbol?.description ?? 'a genre-appropriate symbolic object';
      const place = L.symbol?.placement ?? 'centered prominently';
      return `A professional book cover for a ${genre} novel.
Central focus: a single symbolic object — ${sym} — centered on ${L.background.description}.
${place}
Lighting: ${L.background.lightingNotes}
Mood: ${mkw}, conveyed through colour and lighting rather than environment.
Palette: ${L.background.paletteDirection}
Typography: large, clean, highly legible title "${title}" and author name "${author}", ${T.textPlacement}. ${T.typographyDirection}${series}
Style: minimalist, premium, high contrast, designed for strong thumbnail visibility.
Negative: no characters, no busy scenes, no clutter. ${neg}`;
    }
    case 'A2': {
      const pr = L.protagonist ?? {
        description: 'the protagonist',
        pose: 'standing in a strong silhouette',
        emotionalState: 'determined',
      };
      return `A cinematic book cover for a ${genre} novel.
Central focus: a character — ${pr.description} — ${pr.pose}, occupying the foreground. Emotional state: ${pr.emotionalState}
Environment: ${L.background.description} behind them, slightly softened.
Lighting: ${L.background.lightingNotes}
Mood: ${mkw}
Palette: ${L.background.paletteDirection}
Composition: character dominates the frame, clear silhouette, readable at thumbnail size.
Typography: ${T.typographyDirection} title "${title}" ${T.textPlacement}. Author: "${author}"${series}
Style: cinematic realism, dramatic lighting.
Negative: no clutter, no multiple competing characters unless clearly grouped. ${neg}`;
    }
    case 'A3': {
      const land = L.landscape ?? { description: L.background.description, scaleNotes: 'emphasise scale' };
      const fg = L.foregroundElement ? `Foreground: ${L.foregroundElement.description}` : '';
      return `A cinematic book cover for a ${genre} novel.
Central focus: a sweeping environment — ${land.description} — vast and detailed.
${land.scaleNotes}
${fg}
Lighting: ${L.background.lightingNotes}
Mood: ${mkw}
Palette: ${L.background.paletteDirection}
Composition: strong depth (foreground, midground, background), wide cinematic framing.
Typography: large, readable title "${title}" ${T.textPlacement}. ${T.typographyDirection} Author: "${author}"${series}
Style: epic, immersive, high-detail digital painting.
Negative: avoid cluttered micro-detail that reduces readability. ${neg}`;
    }
    case 'A4': {
      const obj = L.object ?? { description: 'central story object', placement: 'foreground' };
      const fg = L.foregroundElement ? `Additional foreground: ${L.foregroundElement.description}` : '';
      return `A professional book cover for a ${genre} novel.
Central focus: a prominent object — ${obj.description} — placed in ${L.background.description}.
${obj.placement}
${fg}
Lighting: ${L.background.lightingNotes} guiding attention to the object.
Mood: ${mkw}
Palette: ${L.background.paletteDirection}
Typography: ${T.typographyDirection} title "${title}" ${T.textPlacement}. Author: "${author}"${series}
Style: detailed, realistic, balanced composition.
Negative: no clutter, no competing focal points. ${neg}`;
    }
    case 'A5': {
      const pr = L.protagonist ?? {
        description: 'the protagonist',
        pose: 'dynamic stance',
        emotionalState: 'intense focus',
      };
      const act = L.action ?? { description: 'decisive kinetic action', motionDirection: 'horizontal energy' };
      return `A dynamic book cover for a ${genre} novel.
Central focus: ${pr.description} — ${act.description} — captured mid-motion. ${act.motionDirection}
Protagonist: ${pr.pose}
Environment: ${L.background.description}, partially obscured by motion or effects.
Lighting: ${L.background.lightingNotes}
Mood: intense, high-stakes, kinetic. ${mkw}
Palette: ${L.background.paletteDirection}
Typography: ${T.typographyDirection} title "${title}" ${T.textPlacement}. Author: "${author}"${series}
Negative: avoid chaotic clutter that obscures the main action. ${neg}`;
    }
    case 'A6': {
      const sym = L.symbol ?? { description: 'stylised emblem', placement: 'centered', detailNotes: '' };
      return `A clean, professional book cover for a ${genre} novel.
Central focus: a stylised emblem or insignia — ${sym.description} — ${sym.placement}
Background: ${L.background.description}
Lighting: ${L.background.lightingNotes}
Mood: ${mkw}
Palette: ${L.background.paletteDirection}
Typography: dominant design element. Title "${title}" — ${T.typographyDirection} — ${T.textPlacement}, integrated with the emblem. Author: "${author}"${series}
Style: graphic, modern, minimal.
Negative: no scenes, no characters, no clutter. ${neg}`;
    }
    case 'A7': {
      const ms = L.mysteriousSubject ?? {
        description: 'a partially obscured focal subject',
        revealLevel: 'suggestive silhouette',
      };
      return `A cinematic book cover for a ${genre} novel.
Central focus: ${ms.description} — ${ms.revealLevel} — emerging from ${L.background.description}
Lighting: ${L.background.lightingNotes} — low-key, with strong contrast and selective highlights.
Mood: mysterious, tense, intriguing. ${mkw}
Palette: ${L.background.paletteDirection}
Typography: ${T.typographyDirection} title "${title}" ${T.textPlacement}, allowing mystery to dominate. Author: "${author}"${series}
Negative: no over-explanation, no clutter. ${neg}`;
    }
    case 'R1': {
      const pa = L.protagonist ?? {
        description: 'the lead',
        pose: 'embrace',
        emotionalState: 'longing and heat',
      };
      const pb = L.protagonistB ?? { description: 'the counterpart', pose: 'paired with lead' };
      return `A professional romance novel cover.
Central focus: ${pa.description} and ${pb.description} — ${pa.pose}.
Characters' emotional states: ${pa.emotionalState}
Environment: ${L.background.description}, softened in the background.
Lighting: ${L.background.lightingNotes}
Mood: ${mkw}
Palette: ${L.background.paletteDirection}
Typography: ${T.typographyDirection} title "${title}" ${T.textPlacement}. Author: "${author}"${series}
Style: cinematic, warm-toned, emotionally immediate.
Negative: no cold lighting, no visual clutter separating the characters. ${neg}`;
    }
    case 'R2': {
      const pr = L.protagonist ?? {
        description: 'lead character',
        pose: 'graceful portrait pose',
        emotionalState: 'aspirational warmth',
      };
      return `A professional romance novel cover.
Central focus: ${pr.description} — ${pr.pose}. Emotional state: ${pr.emotionalState}
Environment: ${L.background.description}
Lighting: ${L.background.lightingNotes}
Mood: ${mkw}
Palette: ${L.background.paletteDirection}
Typography: ${T.typographyDirection} title "${title}" ${T.textPlacement}. Author: "${author}"${series}
Style: warm, painterly or cinematic.
Negative: no cold tones, no action framing. ${neg}`;
    }
    case 'R3': {
      const obj = L.object ?? { description: 'evocative romantic object', placement: 'centered' };
      return `A professional romance novel cover.
Central focus: ${obj.description} — ${obj.placement} on ${L.background.description}
Lighting: ${L.background.lightingNotes}
Mood: ${mkw}
Palette: ${L.background.paletteDirection}
Typography: ${T.typographyDirection} title "${title}" ${T.textPlacement}. Author: "${author}"${series}
Style: clean, premium, emotionally evocative.
Negative: no clutter, no characters, no cold tones. ${neg}`;
    }
    case 'R4': {
      const fe = L.focalElement ?? {
        description: 'warm inviting focal illustration',
        illustrationStyle: 'contemporary illustrated romance',
      };
      return `A professional illustrated romance novel cover.
Style: ${fe.illustrationStyle}, warm and inviting.
Central focus: ${fe.description}
Background: ${L.background.description}
Palette: ${L.background.paletteDirection}
Mood: ${mkw}
Typography: ${T.typographyDirection} title "${title}" ${T.textPlacement} — integrated into the illustration. Author: "${author}"${series}
Negative: no photorealism, no dark or gritty tones. ${neg}`;
    }
    case 'R5': {
      const land = L.landscape ?? { description: L.background.description, scaleNotes: '' };
      const fg = L.foregroundElement ? `Small figure: ${L.foregroundElement.description}` : '';
      return `A professional romance novel cover.
Central focus: ${land.description} — ${land.scaleNotes}
${fg}
Lighting: ${L.background.lightingNotes}
Mood: ${mkw}
Palette: ${L.background.paletteDirection}
Typography: ${T.typographyDirection} title "${title}" ${T.textPlacement}. Author: "${author}"${series}
Style: painterly or cinematic, emotionally warm.
Negative: no cold tones, no action, no clutter. ${neg}`;
    }
    case 'R6':
      return `A professional romance novel cover.
The title "${title}" is the dominant visual element. ${T.typographyDirection} ${T.textPlacement}
Supporting background: ${L.background.description}
Palette: ${L.background.paletteDirection}
Mood: ${mkw}
Author name "${author}" positioned subordinate to title.${series}
Style: graphic, modern, confident.
Negative: no busy scenes, no characters that compete with the type. ${neg}`;
    default:
      return buildCoverPromptBodyV2(genre, {
        ...brief,
        archetypeId: 'A2',
      });
  }
}

/** Full multimodal prompt for OpenAI Images from v2 brief. */
export function buildCoverPromptFromV2Brief(genre: string, brief: CoverBriefDocumentV2, highClick: boolean): string {
  const body = buildCoverPromptBodyV2(genre, brief);
  let t = `${COVER_GENERATION_SYSTEM}\n\n${body}`;
  return insertHighClick(t, highClick);
}

export function syncResolvedPromptFromLayers(
  brief: CoverBriefDocumentV2,
  genre: string,
  highClick = false
): CoverBriefDocumentV2 {
  return {
    ...brief,
    resolvedPrompt: buildCoverPromptFromV2Brief(genre, brief, highClick),
    promptOverridden: false,
  };
}

export function appendHighClickToStoredPrompt(resolvedPrompt: string): string {
  if (resolvedPrompt.includes(HIGH_CLICK_BLOCK)) return resolvedPrompt;
  if (resolvedPrompt.includes('\nNegative:')) {
    return resolvedPrompt.replace('\nNegative:', `\n\n${HIGH_CLICK_BLOCK}\nNegative:`);
  }
  return `${resolvedPrompt}\n\n${HIGH_CLICK_BLOCK}`;
}

export function buildCoverBriefInstructionForArchetype(archetypeId: CoverArchetypeId): string {
  const layerHint: Record<CoverArchetypeId, string> = {
    A1: 'Include layers.background, layers.symbol (description, placement, detailNotes), layers.text.',
    A2: 'Include layers.background, layers.protagonist, layers.text.',
    A3: 'Include layers.background, layers.landscape, optional layers.foregroundElement, layers.text.',
    A4: 'Include layers.background, layers.object, optional layers.foregroundElement, layers.text.',
    A5: 'Include layers.background, layers.protagonist, layers.action, layers.text.',
    A6: 'Include layers.background, layers.symbol, layers.text.',
    A7: 'Include layers.background, layers.mysteriousSubject, layers.text.',
    R1: 'Include layers.background, layers.protagonist, layers.protagonistB, layers.text.',
    R2: 'Include layers.background, layers.protagonist, layers.text.',
    R3: 'Include layers.background, layers.object, layers.text.',
    R4: 'Include layers.background, layers.focalElement, layers.text.',
    R5: 'Include layers.background, layers.landscape, optional layers.foregroundElement, layers.text.',
    R6: 'Include layers.background, layers.text (dominant typography).',
  };

  return `Produce ONE cover brief JSON object for archetype ${archetypeId} only.
- schemaVersion: 2
- generatedAt: ISO-8601 UTC string
- archetypeId: "${archetypeId}"
- derivedFrom: { storyBibleDocumentId (string), creativeBriefDocumentId (string|null), titleApprovedAt (ISO string) } — use SOURCE MATERIAL for IDs and timestamps.
- layers: ${layerHint[archetypeId]}
  - layers.background: { description, paletteDirection, lightingNotes }
  - layers.text: { titleText, authorText, seriesText (string|null), typographyDirection, textPlacement }
- moodKeywords: 4–8 strings
- visualAvoid: strings (from canon constraints)
- coverComps: 2–3 comparable published titles as plain strings
- resolvedPrompt: leave as empty string ""
- promptOverridden: false

${layerHint[archetypeId]}

Return JSON only.`;
}

export function buildCoverBriefPromptForArchetype(assembledCanon: string, archetypeId: CoverArchetypeId): string {
  return `${buildCoverBriefInstructionForArchetype(archetypeId)}\n\n---\nSOURCE MATERIAL\n---\n${assembledCanon}`;
}

export function buildBackCoverBriefInstructionV2(): string {
  return `Return JSON only (no markdown) for a BACK COVER visual brief.

schemaVersion: 2
coverSide: "back"
derivedFrom: { coverBriefDocumentId, approvedCoverImageId }
layers: {
  background: { description, styleNotes } — visually consistent with the front palette,
  blurbTextArea: { blurbText, placement, typographyTreatment, contrastNotes },
  authorBioArea?: { bioText, placement, photoPlaceholderNotes },
  publisherLogoArea?: { placement, sizingNotes },
  barcodeArea: { placement, sizeNotes } — reserve lower area for real barcode, do not draw a fake one in generated art
}
moodKeywords: string[]
visualAvoid: string[]
resolvedPrompt: "" (empty; filled client-side)
promptOverridden: false
approvedAt: null

SOURCE CONTEXT follows.`;
}

export function buildBackCoverBriefPromptV2(contextBlock: string): string {
  return `${buildBackCoverBriefInstructionV2()}\n\n---\n${contextBlock}\n`;
}

export function syncBackCoverResolvedFromLayers(
  brief: BackCoverBriefDocumentV2,
  params: {
    genre: string;
    paletteDirection: string;
    moodKeywords: string[];
    archetypeEcho?: string;
    blurb?: string;
  }
): BackCoverBriefDocumentV2 {
  const prompt = buildBackCoverImagePrompt({ ...params, backBrief: brief });
  return { ...brief, resolvedPrompt: prompt, promptOverridden: false };
}
