export const SERIAL_HOOK_SCORE_SYSTEM = `You score chapter-end hook strength for web-serial pacing.
Return structured JSON only when requested.
Be concise, deterministic, and grounded in provided text.`;

export const SERIAL_REPARTITION_SYSTEM = `You partition scenes into serial chapter chunks.
Prioritize hook strength at boundaries while respecting word-count targets.
Return structured JSON only when requested.`;

export const SERIAL_ENHANCE_SYSTEM = `You propose light-touch chapter ending enhancements for stronger cliffhangers.
Preserve canon and voice; avoid invasive rewrites.
Return only the requested output format.`;

export const SERIAL_FEEDBACK_IMPACT_SYSTEM = `You classify reader feedback impact against RR canon.
Identify whether feedback is canon-altering or local prose and provide structured output.
Return structured JSON only when requested.`;

type HookScoreInput = {
  sceneList: Array<{ sceneId: string; text: string; sourceChapterRef?: string }>;
  rrBibleExcerpt: string;
};

export function buildSerialHookScorePrompt(input: HookScoreInput): string {
  const scenes = input.sceneList
    .map((scene, idx) => {
      const chapterRef = scene.sourceChapterRef ? ` (source: ${scene.sourceChapterRef})` : '';
      return `Scene ${idx + 1} [${scene.sceneId}]${chapterRef}\n${scene.text}`;
    })
    .join('\n\n---\n\n');
  return `Score hook strength for each scene ending on a 0-10 scale.

RR canon context:
${input.rrBibleExcerpt}

Scenes:
${scenes}

Return JSON:
{
  "scores": [
    {
      "sceneId": "string",
      "hookScore": 0,
      "categories": {
        "questionRaised": 0,
        "tension": 0,
        "stakes": 0,
        "momentum": 0
      },
      "weakHookFlag": true,
      "rationale": "one sentence"
    }
  ]
}`;
}

type RepartitionInput = {
  scenes: Array<{ sceneId: string; wordCount: number; hookScore: number }>;
  targetMin: number;
  targetMax: number;
  hardMax: number;
};

export function buildSerialRepartitionPrompt(input: RepartitionInput): string {
  const scenes = input.scenes
    .map(
      (scene, idx) =>
        `${idx + 1}. ${scene.sceneId} | words=${scene.wordCount} | hook=${scene.hookScore}`
    )
    .join('\n');
  return `Group scenes into serial chapters.

Targets:
- targetMin: ${input.targetMin}
- targetMax: ${input.targetMax}
- hardMax: ${input.hardMax}

Prefer strong boundary hooks while respecting size targets.

Scenes:
${scenes}

Return JSON:
{
  "chapters": [
    {
      "ordinal": 1,
      "title": "string",
      "sceneIds": ["scene-id"],
      "estimatedWordCount": 0,
      "boundaryHookScore": 0
    }
  ]
}`;
}

type EnhanceInput = {
  chapterId: string;
  chapterContent: string;
  hookScore: number;
  bibleExcerpt: string;
  enhancementMode: 'closing_beat' | 'sharpen_final' | 'scene_reorder_suggestion';
  maxAddedWords: number;
};

export function buildSerialEnhancePrompt(input: EnhanceInput): string {
  return `Propose a limited enhancement for this serial chapter.

Chapter ID: ${input.chapterId}
Current hook score: ${input.hookScore}
Enhancement mode: ${input.enhancementMode}
Max added words: ${input.maxAddedWords}

RR canon context:
${input.bibleExcerpt}

Chapter content:
${input.chapterContent}

Return JSON:
{
  "proposal": {
    "mode": "${input.enhancementMode}",
    "diff": "unified diff string",
    "addedWordCount": 0,
    "rationale": "short rationale"
  }
}`;
}

type FeedbackImpactInput = {
  feedbackId: string;
  feedbackBody: string;
  scope: 'chapter' | 'arc';
  seedChapterIds: string[];
  rrBible: object;
  serialChaptersIndex: Array<{ serialChapterId: string; ordinal: number; summary: string }>;
};

export function buildSerialFeedbackImpactPrompt(input: FeedbackImpactInput): string {
  return `Classify this feedback and estimate downstream impact.

Feedback ID: ${input.feedbackId}
Scope: ${input.scope}
Seed chapters: ${input.seedChapterIds.join(', ') || '(none)'}
Feedback:
${input.feedbackBody}

RR bible:
${JSON.stringify(input.rrBible, null, 2)}

Serial chapter index:
${JSON.stringify(input.serialChaptersIndex, null, 2)}

Return JSON:
{
  "classification": "canon_altering | local_prose",
  "proposedDelta": {
    "biblePath": "string",
    "before": {},
    "after": {},
    "rationale": "string"
  },
  "impactedChapterIds": ["serial-chapter-id"],
  "perChapterRationale": { "serial-chapter-id": "string" }
}`;
}
