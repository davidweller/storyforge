import type { SceneCard, ChapterOutline } from '@/lib/generation/schemas';
import type { NicheTropes } from '@/types';
import { formatCompactTropeSummary, formatRequiredReaderTropes } from '@/lib/niche/tropes';
import {
  type PromptParts,
  normalizeCanonRaw,
  formatSceneCanonBlock,
  formatEvalCanonBody,
} from '@/lib/prompts/canonBlock';
import { AI_TELLS_SYSTEM_BLOCK, formatGenreAiTellsAppend } from '@/lib/prompts/aiTells';

export const CHAPTER_SCENE_PLAN_SYSTEM = `You are a fiction scene architect. You break one chapter into ordered scene cards that writers can review before prose is generated.

Each scene card must be actionable for prose generation: clear purpose, conflict, turning point, POV, setting, emotional shift, and what story beats it covers.

When planning: vary estimatedWords sharply across scenes; avoid mirror-appearance beats, exposition-lecture scenes, or beats where a character states the theme in dialogue.

Output only valid JSON matching the requested schema. No markdown fences.`;

export function buildChapterScenePlanPromptParts(params: {
  genre: string;
  chapterNumber: number;
  outlineChapter: ChapterOutline | undefined;
  assembledContext: string | undefined;
  outlinesSourceJson: string;
  tropes?: NicheTropes;
}): PromptParts {
  const oc = params.outlineChapter;
  const outlineBlock = oc
    ? `Chapter ${params.chapterNumber}: "${oc.title}"
Beat reference: ${oc.beatReference || '(none)'}
Scene goal: ${oc.sceneGoal || '(none)'}
POV hint: ${oc.pov || '(unspecified)'}
Word target: ${oc.wordTarget ?? '(unspecified)'}
Key plot points: ${(oc.keyPlotPoints ?? []).join('; ') || '(none)'}`
    : `No outline slice found for chapter ${params.chapterNumber}; infer scenes from genre and context only.`;

  const canon = normalizeCanonRaw(params.assembledContext);
  const tropesSection = formatRequiredReaderTropes(params.tropes);

  const userPrompt = `Plan scenes for ${params.genre} fiction — Chapter ${params.chapterNumber}.

## Outline slice
${outlineBlock}

${tropesSection ? `${tropesSection}\n\n` : ''}
## Approved chapter-outlines source (for JSON provenance — copy ids exactly into derivedFromChapterOutlines)
${params.outlinesSourceJson}

## Task
Return JSON exactly in this shape:
{
  "scenePlan": {
    "schemaVersion": 1,
    "chapterNumber": ${params.chapterNumber},
    "generatedAt": "<ISO-8601 timestamp string>",
    "derivedFromChapterOutlines": { "documentId": "<from source>", "version": <number>, "updatedAt": "<ISO from source>" },
    "scenes": [
      {
        "id": "<stable-id scene-1>",
        "order": 0,
        "purpose": "...",
        "conflict": "...",
        "turningPoint": "...",
        "pov": "...",
        "setting": "...",
        "emotionalShift": "...",
        "beatsCovered": ["..."],
        "mustInclude": ["props/facts reader must see"],
        "estimatedWords": 800
      }
    ]
  }
}

Rules:
- Use at least 2 scenes unless the chapter is intentionally a single beat; typical chapters use 3–6 scenes.
- Vary estimatedWords across scenes (short + long beats); avoid uniform scene lengths.
- Scene ids must be unique within the chapter (e.g. scene-1, scene-2).
- Sum estimatedWords should approximate the outline word target when provided.
- derivedFromChapterOutlines must match the JSON block above exactly for documentId, version, updatedAt.`;

  return { userPrompt, canon };
}

export function buildChapterScenePlanPrompt(params: {
  genre: string;
  chapterNumber: number;
  outlineChapter: ChapterOutline | undefined;
  assembledContext: string | undefined;
  outlinesSourceJson: string;
  tropes?: NicheTropes;
}): string {
  const parts = buildChapterScenePlanPromptParts(params);
  if (!parts.canon) return parts.userPrompt;
  const needle = '\n\n## Task\n';
  const idx = parts.userPrompt.indexOf(needle);
  if (idx === -1) return parts.userPrompt;
  return (
    parts.userPrompt.slice(0, idx) +
    '\n\n' +
    formatSceneCanonBlock(parts.canon).trimEnd() +
    needle +
    parts.userPrompt.slice(idx + needle.length)
  );
}

export const CHAPTER_SCENE_PROSE_SYSTEM = `You are an expert fiction writer. Write one scene of immersive prose that fulfills the scene card while matching series voice and canon context.

${AI_TELLS_SYSTEM_BLOCK}

Output only valid JSON: {"sceneId":"<same as input>","prose":"<scene prose only>"}
No markdown fences.`;

export function buildChapterSceneProsePromptParts(params: {
  genre: string;
  chapterNumber: number;
  chapterTitle: string;
  sceneCard: SceneCard;
  neighborSummaryBefore?: string;
  neighborSummaryAfter?: string;
  assembledContext: string | undefined;
  tropes?: NicheTropes;
  wordTarget?: number;
}): PromptParts {
  const beats = Array.isArray(params.sceneCard.beatsCovered)
    ? params.sceneCard.beatsCovered.join('; ')
    : String(params.sceneCard.beatsCovered ?? '');
  const canon = normalizeCanonRaw(params.assembledContext);
  const tropeSummary = formatCompactTropeSummary(params.tropes);
  const genreAiTells = formatGenreAiTellsAppend(params.genre);

  const userPrompt = `Write prose for a single scene in Chapter ${params.chapterNumber}: "${params.chapterTitle}" (${params.genre}).

Apply Avoiding AI Tells rules in the system message.
${genreAiTells ? `\n${genreAiTells}\n` : ''}

Scene ID (must echo in JSON): ${params.sceneCard.id}

## Scene card
Order: ${params.sceneCard.order}
Purpose: ${params.sceneCard.purpose}
Conflict: ${params.sceneCard.conflict}
Turning point: ${params.sceneCard.turningPoint}
POV: ${params.sceneCard.pov || '(use canon default)'}
Setting: ${params.sceneCard.setting}
Emotional shift: ${params.sceneCard.emotionalShift}
Beats covered: ${beats || '(none)'}
Must include: ${(params.sceneCard.mustInclude ?? []).join('; ') || '(none)'}
${tropeSummary ? `${tropeSummary}\n` : ''}
Target words (approximate): ${params.wordTarget ?? params.sceneCard.estimatedWords ?? 600}

${params.neighborSummaryBefore ? `## Previous scene (summary)\n${params.neighborSummaryBefore}\n` : ''}${params.neighborSummaryAfter ? `## Next scene (summary)\n${params.neighborSummaryAfter}\n` : ''}Write complete prose for this scene only (no chapter headings). Return JSON {"sceneId":"${params.sceneCard.id}","prose":"..."}.`;

  return { userPrompt, canon };
}

export function buildChapterSceneProsePrompt(params: {
  genre: string;
  chapterNumber: number;
  chapterTitle: string;
  sceneCard: SceneCard;
  neighborSummaryBefore?: string;
  neighborSummaryAfter?: string;
  assembledContext: string | undefined;
  tropes?: NicheTropes;
  wordTarget?: number;
}): string {
  const parts = buildChapterSceneProsePromptParts(params);
  if (!parts.canon) return parts.userPrompt;
  const needle = '\nWrite complete prose for this scene only';
  const idx = parts.userPrompt.indexOf(needle);
  if (idx === -1) return parts.userPrompt;
  return (
    parts.userPrompt.slice(0, idx) +
    '\n' +
    formatSceneCanonBlock(parts.canon).trimEnd() +
    '\n' +
    parts.userPrompt.slice(idx + 1)
  );
}

export const CHAPTER_POLISH_SYSTEM = `You are a fiction line editor. Smooth transitions between scenes in the same chapter, unify voice, and sharpen the closing beat when weak — without forcing a cliffhanger if the draft already lands on a quiet or mid-scene ending. Cut AI tells and stock phrasing; do not change plot facts or add major new events.

${AI_TELLS_SYSTEM_BLOCK}

Output only the full polished chapter body as plain text (no JSON). Preserve scene order implicitly; do not add "### Scene" markers.`;

export function buildChapterPolishPromptParts(params: {
  genre: string;
  chapterNumber: number;
  chapterTitle: string;
  concatenatedDraft: string;
  assembledContext: string | undefined;
  niche?: string;
}): PromptParts {
  const canon = normalizeCanonRaw(params.assembledContext);
  const genreAiTells = formatGenreAiTellsAppend(params.genre, params.niche);
  const userPrompt = `Polish this draft for Chapter ${params.chapterNumber}: "${params.chapterTitle}" (${params.genre}).

Apply Avoiding AI Tells rules in the system message; remove stock phrasing without adding plot.
${genreAiTells ? `\n${genreAiTells}\n` : ''}
## Draft (concatenated scenes)
${params.concatenatedDraft}

Improve transitions and pacing; keep POV and facts consistent with canon. Return the polished chapter as plain text only.`;
  return { userPrompt, canon };
}

export function buildChapterPolishPrompt(params: {
  genre: string;
  chapterNumber: number;
  chapterTitle: string;
  concatenatedDraft: string;
  assembledContext: string | undefined;
  niche?: string;
}): string {
  const parts = buildChapterPolishPromptParts(params);
  if (!parts.canon) return parts.userPrompt;
  const needle = '\n\n## Draft (concatenated scenes)\n';
  const idx = parts.userPrompt.indexOf(needle);
  if (idx === -1) return parts.userPrompt;
  return (
    parts.userPrompt.slice(0, idx) +
    '\n\n' +
    formatSceneCanonBlock(parts.canon).trimEnd() +
    needle +
    parts.userPrompt.slice(idx + needle.length)
  );
}

export const CHAPTER_SCENE_EVAL_SYSTEM = `You are a fiction quality evaluator. Score the chapter draft against the scene plan and canon notes.

Each check must reference the scene id it applies to (scene-level issues). Use severity "fail" for blocking problems, "warn" for risks, "info" for minor notes.

Output only valid JSON:
{"checks":[{"id":"...","sceneId":"...","pass":true|false,"severity":"info"|"warn"|"fail","evidence":"...","suggestion":"..."}],"summary":"..."}

No markdown fences.`;

/** Full eval canon section for system cache (heading + body). */
export function formatSceneEvalCanonSection(raw: string): string {
  return `## Canon / brief (compact)
${formatEvalCanonBody(raw)}
`;
}

export function buildChapterSceneEvalPromptParts(params: {
  genre: string;
  chapterNumber: number;
  chapterTitle: string;
  scenePlanJson: string;
  chapterText: string;
  compactCanon: string;
  chunkLabel?: string;
  evaluationMode?: 'lite' | 'standard' | 'deep';
}): PromptParts {
  const mode = params.evaluationMode ?? 'standard';
  const aiTellsProbe =
    'Flag when present: filtering verbs, named emotions in narration, breath-held/stock phrases, trailing -ing significance clauses, dialogue-tag overload, methodical five-senses inventory, stated themes.';
  const rubric =
    mode === 'lite'
      ? 'Compact rubric: beat + canon + POV for this chunk only. Skip closing-beat and word-range probes unless blocking.'
      : mode === 'deep'
        ? `Full rubric: beats, canon, POV, threads, closing beat fits chapter role (quiet endings OK), tell vs show, ${aiTellsProbe}, timeline pressure, and word-range plausibility vs scene-card estimates.`
        : `Return checks covering beat/scene fulfillment, continuity vs canon, POV/voice consistency (chapter-level checks may use any sceneId from the plan — prefer the scene where the issue appears), thread advancement, closing beat fits chapter role, ${aiTellsProbe}, and word-range plausibility.`;

  const canon = normalizeCanonRaw(params.compactCanon);

  const head = `Evaluate ${params.genre} — Chapter ${params.chapterNumber}: "${params.chapterTitle}" (${mode} evaluation).
${params.chunkLabel ? `Chunk: ${params.chunkLabel}\n` : ''}

## Scene plan (JSON)
${params.scenePlanJson}

`;

  const tail = `## Chapter draft fragment to evaluate
${params.chapterText}

${rubric}`;

  const userPrompt =
    head +
    (canon ? '' : `## Canon / brief (compact)\n${formatEvalCanonBody('')}\n\n`) +
    tail;

  return { userPrompt: canon ? head + tail : userPrompt, canon };
}

export function buildChapterSceneEvalPrompt(params: {
  genre: string;
  chapterNumber: number;
  chapterTitle: string;
  scenePlanJson: string;
  chapterText: string;
  compactCanon: string;
  chunkLabel?: string;
  evaluationMode?: 'lite' | 'standard' | 'deep';
}): string {
  const parts = buildChapterSceneEvalPromptParts(params);
  if (!parts.canon) return parts.userPrompt;
  const headEnd = `## Scene plan (JSON)\n${params.scenePlanJson}\n\n`;
  const idx = parts.userPrompt.indexOf(headEnd);
  if (idx === -1) return parts.userPrompt;
  const afterPlans = parts.userPrompt.slice(idx + headEnd.length);
  return parts.userPrompt.slice(0, idx + headEnd.length) + formatSceneEvalCanonSection(parts.canon) + '\n' + afterPlans;
}
