import type { NicheTropes, StoryBibleSourceRef } from '@/types';
import { tryParseNicheOutput } from '@/lib/generation/schemas';

export const STORY_BIBLE_SYSTEM = `You are a senior story editor building durable canon for a novel. You convert approved planning artifacts into a concise, structured Story Bible that future drafting and editing must obey.

Return only valid JSON that matches the requested contract. Do not include markdown fences or commentary.`;

function referenceSection(label: string, content: string | undefined): string {
  if (!content?.trim()) return '';
  return `\n### ${label}\n${content.trim()}\n`;
}

function formatStructuredTropes(tropes: NicheTropes | undefined): string {
  if (!tropes) return '';
  return `\n### Tropes (structured from niche)\n${JSON.stringify(tropes, null, 2)}\n`;
}

export function buildStoryBiblePrompt(params: {
  title?: string;
  premise?: string;
  genre: string;
  niche?: string;
  research?: string;
  genreResearch?: string;
  nicheReference?: string;
  endingReference?: string;
  endingChoice?: string;
  charactersReference?: string;
  structureReference?: string;
  chapterOutlinesReference?: string;
  derivedFrom: StoryBibleSourceRef[];
}): string {
  const {
    title,
    premise,
    genre,
    niche,
    research,
    genreResearch,
    nicheReference,
    endingReference,
    endingChoice,
    charactersReference,
    structureReference,
    chapterOutlinesReference,
    derivedFrom,
  } = params;
  const structuredNiche = tryParseNicheOutput(nicheReference)?.niche;
  const tropesSource = structuredNiche?.tropes ? 'structured-niche' : 'extracted-from-prose';

  return `Create a Story Bible for this novel from the approved planning artifacts (chapter outlines must already be present—they anchor per-chapter beats and scene promises).

## Project
- Title: ${title || 'Untitled'}
- Genre: ${genre}
${niche ? `- Niche: ${niche}` : ''}${premise ? `\n- Premise: ${premise}` : ''}${research ? `\n- Research notes: ${research}` : ''}

## Source Metadata
Use this exact derivedFrom array in the JSON output:
${JSON.stringify(derivedFrom, null, 2)}

## Approved Planning Artifacts
${referenceSection('Genre Research', genreResearch)}
${referenceSection('Niche / Audience Positioning', nicheReference)}
${formatStructuredTropes(structuredNiche?.tropes)}
${referenceSection('Selected Ending', endingChoice)}
${referenceSection('Ending Blueprint', endingReference)}
${referenceSection('Characters', charactersReference)}
${referenceSection('Plot Structure', structureReference)}
${referenceSection('Chapter Outlines', chapterOutlinesReference)}

## Task
Build a compact but complete canon source. Capture stable facts and constraints only; do not invent new story decisions unless an input leaves a necessary ambiguity, and then choose the least disruptive interpretation.

Hard constraints:
- Preserve exact character names, relationship promises, ending requirements, and world facts from the inputs.
- Convert style guidance into explicit POV, tense, narrative distance, style rules, and avoid rules.
- Identify unresolved threads and ending promises that future chapters must preserve or pay off.
- Keep each array item concise enough to be reused in prompts.
- Story Bible schemaVersion 2 adds durable reader tropes. Fill the top-level "tropes" field.
${structuredNiche?.tropes
  ? '- Preserve every entry from the supplied structured tropes object exactly in the output "tropes" field. Do not invent new tropes, rename existing ones, or move entries between categories.'
  : '- No structured trope object was supplied. Extract the best-effort trope lists from the niche prose and set "tropesSource" to "extracted-from-prose".'}

Return only valid JSON in this exact shape:

{
  "storyBible": {
    "schemaVersion": 2,
    "storyBibleVersion": 1,
    "generatedAt": "${new Date().toISOString()}",
    "approvedAt": null,
    "derivedFrom": ${JSON.stringify(derivedFrom, null, 4)},
    "tropesSource": "${tropesSource}",
    "logline": "string",
    "genrePromise": "string",
    "audiencePromise": "string",
    "tropes": {
      "mustInclude": [
        { "name": "string", "rationale": "string" }
      ],
      "considerIncluding": [
        { "name": "string", "rationale": "string" }
      ],
      "avoid": [
        { "name": "string", "reason": "string" }
      ]
    },
    "voiceAndStyle": {
      "pov": "string",
      "tense": "string",
      "narrativeDistance": "string",
      "styleRules": ["string"],
      "avoid": ["string"]
    },
    "themes": ["string"],
    "characters": [
      {
        "name": "string",
        "role": "string",
        "want": "string",
        "need": "string",
        "flaw": "string",
        "arcPromise": "string",
        "voiceNotes": ["string"],
        "hardConstraints": ["string"]
      }
    ],
    "relationships": [
      {
        "participants": ["string"],
        "startingState": "string",
        "targetState": "string",
        "tension": "string",
        "constraints": ["string"]
      }
    ],
    "worldRules": ["string"],
    "timelineFacts": ["string"],
    "unresolvedThreads": [
      {
        "thread": "string",
        "introducedBy": "string",
        "mustResolveBy": "string",
        "status": "active"
      }
    ],
    "endingPromises": ["string"],
    "forbiddenChanges": ["string"]
  }
}`;
}

export function buildCreativeBriefPrompt(params: {
  storyBibleContent: string;
  storyBibleDocumentId: string;
  storyBibleVersion: number;
  storyBibleUpdatedAt: string;
}): string {
  const { storyBibleContent, storyBibleDocumentId, storyBibleVersion, storyBibleUpdatedAt } = params;

  return `Create a compact Creative Brief from this approved Story Bible. The brief is the primary generation-ready canon summary for future prompts.

## Approved Story Bible
${storyBibleContent}

## Task
Write one dense but readable brief that covers:
- logline, genre promise, and audience promise
- POV, tense, voice, style rules, and style moves to avoid
- protagonist/opposition/major relationship promises
- hard world, timeline, and forbidden-change constraints
- unresolved threads and ending promises

Return only valid JSON in this exact shape:

{
  "creativeBrief": {
    "schemaVersion": 1,
    "creativeBriefVersion": 1,
    "generatedAt": "${new Date().toISOString()}",
    "derivedFromStoryBible": {
      "documentId": "${storyBibleDocumentId}",
      "version": ${storyBibleVersion},
      "updatedAt": "${storyBibleUpdatedAt}"
    },
    "brief": "string"
  }
}`;
}
