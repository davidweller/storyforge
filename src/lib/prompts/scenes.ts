import type { SceneCard, ChapterOutline } from '@/lib/generation/schemas';

export const CHAPTER_SCENE_PLAN_SYSTEM = `You are a fiction scene architect. You break one chapter into ordered scene cards that writers can review before prose is generated.

Each scene card must be actionable for prose generation: clear purpose, conflict, turning point, POV, setting, emotional shift, and what story beats it covers.

Output only valid JSON matching the requested schema. No markdown fences.`;

export function buildChapterScenePlanPrompt(params: {
  genre: string;
  chapterNumber: number;
  outlineChapter: ChapterOutline | undefined;
  assembledContext: string | undefined;
  outlinesSourceJson: string;
}): string {
  const oc = params.outlineChapter;
  const outlineBlock = oc
    ? `Chapter ${params.chapterNumber}: "${oc.title}"
Beat reference: ${oc.beatReference || '(none)'}
Scene goal: ${oc.sceneGoal || '(none)'}
POV hint: ${oc.pov || '(unspecified)'}
Word target: ${oc.wordTarget ?? '(unspecified)'}
Key plot points: ${(oc.keyPlotPoints ?? []).join('; ') || '(none)'}`
    : `No outline slice found for chapter ${params.chapterNumber}; infer scenes from genre and context only.`;

  return `Plan scenes for ${params.genre} fiction — Chapter ${params.chapterNumber}.

## Outline slice
${outlineBlock}

## Approved chapter-outlines source (for JSON provenance — copy ids exactly into derivedFromChapterOutlines)
${params.outlinesSourceJson}

${params.assembledContext ? `## Canon context\n${params.assembledContext}\n` : ''}

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
- Scene ids must be unique within the chapter (e.g. scene-1, scene-2).
- Sum estimatedWords should approximate the outline word target when provided.
- derivedFromChapterOutlines must match the JSON block above exactly for documentId, version, updatedAt.`;
}

export const CHAPTER_SCENE_PROSE_SYSTEM = `You are an expert fiction writer. Write one scene of immersive prose that fulfills the scene card while matching series voice and canon context.

Output only valid JSON: {"sceneId":"<same as input>","prose":"<scene prose only>"}
No markdown fences.`;

export function buildChapterSceneProsePrompt(params: {
  genre: string;
  chapterNumber: number;
  chapterTitle: string;
  sceneCard: SceneCard;
  neighborSummaryBefore?: string;
  neighborSummaryAfter?: string;
  assembledContext: string | undefined;
  wordTarget?: number;
}): string {
  const beats = Array.isArray(params.sceneCard.beatsCovered)
    ? params.sceneCard.beatsCovered.join('; ')
    : String(params.sceneCard.beatsCovered ?? '');
  return `Write prose for a single scene in Chapter ${params.chapterNumber}: "${params.chapterTitle}" (${params.genre}).

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
Target words (approximate): ${params.wordTarget ?? params.sceneCard.estimatedWords ?? 600}

${params.neighborSummaryBefore ? `## Previous scene (summary)\n${params.neighborSummaryBefore}\n` : ''}
${params.neighborSummaryAfter ? `## Next scene (summary)\n${params.neighborSummaryAfter}\n` : ''}
${params.assembledContext ? `## Canon context\n${params.assembledContext}\n` : ''}

Write complete prose for this scene only (no chapter headings). Return JSON {"sceneId":"${params.sceneCard.id}","prose":"..."}.`;
}

export const CHAPTER_POLISH_SYSTEM = `You are a fiction line editor. Smooth transitions between scenes in the same chapter, unify voice, and strengthen the closing hook — without changing plot facts or adding major new events.

Output only the full polished chapter body as plain text (no JSON). Preserve scene order implicitly; do not add "### Scene" markers.`;

export function buildChapterPolishPrompt(params: {
  genre: string;
  chapterNumber: number;
  chapterTitle: string;
  concatenatedDraft: string;
  assembledContext: string | undefined;
}): string {
  return `Polish this draft for Chapter ${params.chapterNumber}: "${params.chapterTitle}" (${params.genre}).

${params.assembledContext ? `## Canon context\n${params.assembledContext}\n` : ''}

## Draft (concatenated scenes)
${params.concatenatedDraft}

Improve transitions and pacing; keep POV and facts consistent with canon. Return the polished chapter as plain text only.`;
}

export const CHAPTER_SCENE_EVAL_SYSTEM = `You are a fiction quality evaluator. Score the chapter draft against the scene plan and canon notes.

Each check must reference the scene id it applies to (scene-level issues). Use severity "fail" for blocking problems, "warn" for risks, "info" for minor notes.

Output only valid JSON:
{"checks":[{"id":"...","sceneId":"...","pass":true|false,"severity":"info"|"warn"|"fail","evidence":"...","suggestion":"..."}],"summary":"..."}

No markdown fences.`;

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
  const mode = params.evaluationMode ?? 'standard';
  const rubric =
    mode === 'lite'
      ? 'Compact rubric: beat + canon + POV for this chunk only. Skip hook polish and word-range probes unless blocking.'
      : mode === 'deep'
        ? 'Full rubric: beats, canon, POV, threads, hook into next scene, tell vs show, timeline pressure, and word-range plausibility vs scene-card estimates.'
        : 'Return checks covering beat/scene fulfillment, continuity vs canon, POV/voice consistency (chapter-level checks may use any sceneId from the plan — prefer the scene where the issue appears), thread advancement, hook strength, and word-range plausibility.';

  return `Evaluate ${params.genre} — Chapter ${params.chapterNumber}: "${params.chapterTitle}" (${mode} evaluation).
${params.chunkLabel ? `Chunk: ${params.chunkLabel}\n` : ''}

## Scene plan (JSON)
${params.scenePlanJson}

## Canon / brief (compact)
${params.compactCanon || '(none)'}

## Chapter draft fragment to evaluate
${params.chapterText}

${rubric}`;
}
