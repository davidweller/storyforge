import { TARGET_MANUSCRIPT_WORDS } from '@/lib/constants';
import { AI_TELLS_SYSTEM_BLOCK, formatGenreAiTellsAppend } from '@/lib/prompts/aiTells';

export const CHAPTERS_SYSTEM = `You are a skilled fiction writer with a gift for immersive prose, compelling dialogue, and emotional resonance. Your writing:

- Shows rather than tells
- Uses sharp sensory particulars filtered through POV intent (not a five-senses checklist)
- Creates distinctive character voices
- Balances action, dialogue, and interiority
- Maintains consistent tone and style
- Varies chapter endings: use a strong hook only when the beat warrants it; quiet, mundane, or mid-conversation endings are valid — not every chapter needs a cliffhanger

Write prose that transports readers and makes them feel deeply.

${AI_TELLS_SYSTEM_BLOCK}`;
import type { EditorialPass, NicheTropes } from '@/types';
import { formatRequiredReaderTropes } from '@/lib/niche/tropes';
import {
  type PromptParts,
  normalizeCanonRaw,
  formatChapterDraftCanonBlock,
  mergeChapterDraftCanonIntoUserPrompt,
  formatRevisionPrimaryCanonBlock,
  mergeRevisionPrimaryCanonIntoUserPrompt,
} from '@/lib/prompts/canonBlock';

export const CHAPTER_OUTLINES_SYSTEM = `You are a story architect who specializes in converting plot blueprints into detailed chapter outlines. You understand how to break down Save the Cat beats into specific, actionable chapter plans that guide the writing process.

Your approach:
- Analyze the Plot Blueprint to understand the story structure and beats
- Map beats to appropriate chapter divisions (typically 20-30 chapters)
- Create compelling chapter titles that hint at content
- Define clear scene goals that advance plot and character development
- Assign appropriate POV characters based on story needs
- Ensure proper pacing and emotional arc progression
- Reference character profiles, ending blueprint, and niche positioning

Create chapter outlines that are specific, actionable, and aligned with the overall story structure.`;

export function buildChapterOutlinesPrompt(params: {
  premise?: string;
  genre: string;
  structureReference: string;
  charactersReference: string;
  endingReference: string;
  genreResearch?: string;
  nicheReference?: string;
  tropes?: NicheTropes;
  maxTotalWords?: number;
}): string {
  const {
    premise,
    genre,
    structureReference,
    charactersReference,
    endingReference,
    genreResearch,
    nicheReference,
    tropes,
    maxTotalWords = TARGET_MANUSCRIPT_WORDS,
  } = params;
  const tropesSection = formatRequiredReaderTropes(tropes);

  let prompt = `Create a complete Chapter Outlines document for this ${genre} novel based on the Plot Blueprint (Save the Cat beat sheet).

**Genre:** ${genre}`;

  if (premise) {
    prompt += `
**Premise:** ${premise}`;
  }

  prompt += `

## Plot Blueprint (Story Structure)
${structureReference}

${tropesSection ? `${tropesSection}\n\n` : ''}
## Reference Materials

${genreResearch ? `**Genre Research & Market Context:**
${genreResearch}

` : ''}${nicheReference ? `**Niche Positioning & Audience:**
${nicheReference}

` : ''}**Character Profiles:**
${charactersReference}

**Ending Blueprint:**
${endingReference}

## Task

Convert the Plot Blueprint into detailed chapter outlines. For each chapter, provide:

1. **Chapter Number** (sequential, starting from 1)
2. **Chapter Title** - A compelling, specific title that hints at the chapter's content and fits the ${genre} genre
3. **Story Beat(s)** - The specific Save the Cat beat(s) this chapter covers (e.g., "Catalyst - The inciting incident" or "Fun and Games - The promise of the premise")
4. **Scene Goal** - A clear, specific description of what should happen in this chapter:
   - What plot points need to be advanced?
   - What character development should occur?
   - What emotional beats should be hit?
   - What information needs to be revealed or established?
5. **POV Character** - Which character's point of view should this chapter be written from? Consider which perspective would be most effective for this beat.
6. **Word Target** - Approximate word count target per chapter. The **sum of all Word Target values** across chapters must not exceed ${maxTotalWords.toLocaleString()} words total. Vary per chapter for pacing (e.g. 2500-4000 words each) but keep the total at or below this limit.
7. **Key Plot Points** - 3-5 specific plot points or events that must occur in this chapter

## Output Format

Output only valid JSON in this exact shape:

\`\`\`json
{
  "chapters": [
    {
      "chapterNumber": 1,
      "title": "Chapter title",
      "beatReference": "Save the Cat beat name(s) and short description",
      "sceneGoal": "Detailed goal description",
      "pov": "POV character name",
      "wordTarget": 3000,
      "keyPlotPoints": [
        "Point 1",
        "Point 2",
        "Point 3"
      ]
    }
  ],
  "overview": "Brief narrative overview of flow, pacing, character arcs, and emotional build."
}
\`\`\`

Do not include markdown outside the JSON.

## Guidelines

- Map beats to approximately 20-30 chapters (adjust based on story complexity)
- **Total word budget:** The sum of all Word Target values must be ≤ ${maxTotalWords.toLocaleString()} words. If you have N chapters, average at most ${Math.floor(maxTotalWords / 25)} words per chapter (e.g. for ~25 chapters) so the manuscript stays within the limit.
- Ensure each chapter has a clear purpose and advances the story
- Vary chapter length for pacing (shorter chapters for tension, longer for development)
- Balance action, character development, and world-building
- Ensure continuity - each chapter should flow naturally from the previous
- Consider the genre and niche expectations
- Align with the ending blueprint - plant seeds early for later payoffs

Generate the complete chapter outlines now.`;
  
  return prompt;
}

export function buildChapterSummaryPromptParts(params: {
  genre: string;
  chapterNumber: number;
  chapterTitle: string;
  chapterContent: string;
}): PromptParts {
  const { genre, chapterNumber, chapterTitle, chapterContent } = params;

  return {
    canon: '',
    userPrompt: `Summarize Chapter ${chapterNumber}: "${chapterTitle}" from this ${genre} novel.

## Chapter Content
${chapterContent}

## Task

Write a concise continuity summary (150-200 words) that captures:
- What events happened in sequence
- Which characters acted and what they decided
- New information revealed
- Emotional and relationship shifts
- Unresolved threads that carry into later chapters

## Constraints

- Ground every point in the chapter text
- Use plain prose (no bullet list)
- Keep names, places, timeline facts, and outcomes exact
- Do not invent events or motives not present in the chapter

Output only valid JSON in this exact shape:

\`\`\`json
{
  "summary": "The continuity summary text."
}
\`\`\``,
  };
}

export function buildChapterSummaryPrompt(params: {
  genre: string;
  chapterNumber: number;
  chapterTitle: string;
  chapterContent: string;
}): string {
  return buildChapterSummaryPromptParts(params).userPrompt;
}

export function buildChapterPromptParts(params: {
  genre: string;
  chapterNumber: number;
  chapterTitle: string;
  beatReference: string;
  sceneGoal: string;
  pov?: string;
  assembledContext?: string;
  charactersReference: string;
  endingReference: string;
  previousChapterSummaries?: Array<{ chapterNumber: number; title: string; summary: string }>;
  structureContext: string;
  genreResearch?: string;
  nicheReference?: string;
  tropes?: NicheTropes;
  wordTarget?: number;
}): PromptParts {
  const {
    genre,
    chapterNumber,
    chapterTitle,
    beatReference,
    sceneGoal,
    pov,
    assembledContext,
    charactersReference,
    endingReference,
    previousChapterSummaries,
    structureContext,
    genreResearch,
    nicheReference,
    tropes,
    wordTarget = 3000,
  } = params;

  const canon = normalizeCanonRaw(assembledContext);
  const tropesSection = formatRequiredReaderTropes(tropes);

  let userPrompt = `Write Chapter ${chapterNumber}: "${chapterTitle}" for this ${genre} novel.

## Story Context

**Story Structure Position:**
${structureContext}

**This Chapter's Beat:**
${beatReference}

**Scene Goal:**
${sceneGoal}

${pov ? `**POV Character:** ${pov}` : ''}

**Target Word Count:** ~${wordTarget} words

${tropesSection ? `${tropesSection}\n\n` : ''}
${canon ? '## Legacy Reference Materials (fallback only)\n\nUse these only when the canon context above is missing a needed detail.\n' : '## Reference Materials'}

${genreResearch ? `**Genre Research & Market Context:**
${genreResearch}

` : ''}${nicheReference ? `**Niche Positioning & Audience:**
${nicheReference}

` : ''}**Key Characters:**
${charactersReference}

**Ending We're Building Toward:**
${endingReference}
`;

  if (previousChapterSummaries?.length) {
    const continuityContext = [...previousChapterSummaries]
      .sort((a, b) => b.chapterNumber - a.chapterNumber)
      .map((entry) => `- Chapter ${entry.chapterNumber}: "${entry.title}"\n${entry.summary}`)
      .join('\n\n');
    userPrompt += `
## Story So Far (Continuity Summaries)
${continuityContext}
`;
  }

  const genreAiTells = formatGenreAiTellsAppend(genre, nicheReference);
  if (genreAiTells) {
    userPrompt += `
${genreAiTells}
`;
  }

  userPrompt += `
## Writing Instructions

Follow Avoiding AI Tells rules in the system message; prefer concrete particulars over stock phrasing.

1. **Opening**: Start with an engaging opening that draws readers in immediately.

2. **Scene Construction**: 
   - Ground the reader in time and place quickly
   - Use one or two sharp sensory particulars filtered through what the POV character cares about — not a methodical five-senses pass
   - Balance action, dialogue, and interiority
   - Show character emotions through behavior and body language

3. **Dialogue**:
   - Each character should have a distinctive voice
   - Dialogue should reveal character and advance plot
   - Use subtext - characters don't always say what they mean
   - Use dialogue beats selectively; many lines should stand alone without a tagged action

4. **Pacing**:
   - Vary sentence length for rhythm
   - Use shorter paragraphs for tension
   - Allow breathing room for emotional moments
   - End scenes at moments of change or decision

5. **Chapter Ending**:
   - End on the beat this chapter needs — hook, quiet landing, mid-conversation, or small unresolved thread
   - Do not force a cliffhanger on every chapter; vary endings across the manuscript
   - Can end mid-scene for tension or at a natural break

## Constraints

- Stay true to established character voices and personalities
- Maintain consistency with previous chapters
- Advance the plot according to the beat sheet
- Plant any necessary seeds for future payoffs
- Do NOT resolve the main story conflict (unless this is the final chapter)

Write the complete chapter now. Focus on immersive, engaging prose that serves both story and character.`;

  return { userPrompt, canon };
}

export function buildChapterPrompt(params: {
  genre: string;
  chapterNumber: number;
  chapterTitle: string;
  beatReference: string;
  sceneGoal: string;
  pov?: string;
  assembledContext?: string;
  charactersReference: string;
  endingReference: string;
  previousChapterSummaries?: Array<{ chapterNumber: number; title: string; summary: string }>;
  structureContext: string;
  genreResearch?: string;
  nicheReference?: string;
  tropes?: NicheTropes;
  wordTarget?: number;
}): string {
  const parts = buildChapterPromptParts(params);
  return mergeChapterDraftCanonIntoUserPrompt(
    parts.userPrompt,
    parts.canon ? formatChapterDraftCanonBlock(parts.canon) : '',
  );
}

const REVISION_PASS_NOTE: Record<EditorialPass, string> = {
  structural:
    '**Editing mode: structural.** You may adjust scenes, beats, and clarity for story-level fixes. Preserve canon and voice where instructions do not require change.',
  line:
    '**Editing mode: line edit.** Improve clarity, flow, and dialogue at sentence and paragraph level. Do not change plot, character arcs, or story outcomes unless an instruction explicitly requires it. Prefer refinements over wholesale rewrites.',
  copy:
    '**Editing mode: copy edit.** Apply grammar, consistency, and word-level fixes to publishing standards. Preserve authorial voice; fix ambiguity and errors, not stylistic preference.',
  proofread:
    '**Editing mode: proofread.** Apply only corrections for typos, punctuation, clear errors, and formatting glitches. Do not rewrite for style or substance.',
  final_report:
    '**Editing mode: final report.** This task is informational only — if you are asked to revise, apply only what the instructions explicitly require; otherwise preserve the chapter.',
};

export function buildChapterRevisionPromptParts(params: {
  originalChapter: string;
  revisionInstructions: string;
  acceptanceCriteria: string[];
  assembledContext?: string;
  charactersReference: string;
  endingReference: string;
  structureReference?: string;
  nicheReference?: string;
  tropes?: NicheTropes;
  previousChapterContext?: string;
  nextChapterContext?: string;
  editorialPass?: EditorialPass;
  /** When set, `originalChapter` is one scene only; model returns revised scene prose only. */
  sceneScoped?: { sceneId: string };
}): PromptParts {
  const {
    originalChapter,
    revisionInstructions,
    acceptanceCriteria,
    assembledContext,
    charactersReference,
    endingReference,
    structureReference,
    nicheReference,
    tropes,
    previousChapterContext,
    nextChapterContext,
    editorialPass = 'structural',
    sceneScoped,
  } = params;

  const canon = normalizeCanonRaw(assembledContext);
  const tropesSection = formatRequiredReaderTropes(tropes);

  const passNote = REVISION_PASS_NOTE[editorialPass];

  const originalSection = sceneScoped
    ? `## Original scene (sceneId: ${sceneScoped.sceneId})

${originalChapter}`
    : `## Original Chapter

The complete original chapter text is provided below. Review it carefully before making revisions.

${originalChapter}`;

  const outputSection = sceneScoped
    ? `## Output

Return **only** the revised prose for this scene (sceneId: ${sceneScoped.sceneId}). Do not include chapter headings, scene labels, or commentary — prose only.`
    : `## Output

Write the complete revised chapter now. Ensure it addresses all revision instructions while maintaining consistency with canon and preserving the chapter's strengths.`;

  const revisionGuidelines = sceneScoped
    ? `## Revision Guidelines

1. Address ALL instructions while preserving voice and canon.
2. Keep plot facts consistent with the rest of the chapter you cannot see.
3. Output **only** this scene's prose.`
    : `## Revision Guidelines

1. **Address ALL Instructions**: Every point in the revision instructions must be addressed. Do not skip any issues.

2. **Preserve What Works**: Keep strong elements from the original chapter. Only change what needs to be fixed according to the instructions.

3. **Maintain Voice**: Keep the narrative voice, tone, and style consistent with the original and with the rest of the manuscript.

4. **Canon Compliance**: All changes must align with the reference materials above. Do not introduce contradictions.

5. **No New Plot Threads**: Don't introduce new subplots, characters, or major plot elements unless specifically requested in the revision instructions.

6. **Targeted Improvements**: Make focused, specific changes. Avoid over-revising areas that don't need changes.

7. **Complete Chapter**: Output the complete revised chapter, not just the changed sections.`;
  
  const userPrompt = `Revise ${sceneScoped ? 'the following scene excerpt' : 'the following chapter'} according to the revision instructions provided below.

${passNote}

${originalSection}

## Revision Instructions

**CRITICAL**: You must address ALL of the following revision instructions. These are specific issues identified in the editorial review that need to be fixed:

${revisionInstructions}

## Acceptance Criteria

The revised ${sceneScoped ? 'scene' : 'chapter'} MUST meet all of the following criteria. Verify each one before completing your revision:

${acceptanceCriteria.length > 0 
  ? acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')
  : '1. The chapter maintains consistency with established canon and character voices.\n2. All revision instructions have been addressed.\n3. The narrative voice and style remain consistent with the original.'}

## Reference Materials (Canon - Use for Consistency)

These reference documents define the established canon. Ensure your revisions align with these:

${tropesSection ? `${tropesSection}\n\n` : ''}
${charactersReference ? `**Character Profiles${canon ? ' (fallback only)' : ''}:**
${charactersReference}

` : ''}${endingReference ? `**Ending Constraints${canon ? ' (fallback only)' : ''}:**
${endingReference}

` : ''}${structureReference ? `**Story Structure${canon ? ' (fallback only)' : ''}:**
${structureReference}

` : ''}${nicheReference ? `**Target Audience & Positioning${canon ? ' (fallback only)' : ''}:**
${nicheReference}

` : ''}${previousChapterContext || nextChapterContext ? `## Continuity Reference (Adjacent Chapters)

${previousChapterContext ? `**Previous Chapter Snapshot:**\n${previousChapterContext}\n\n` : ''}${nextChapterContext ? `**Next Chapter Snapshot:**\n${nextChapterContext}\n\n` : ''}` : ''}${revisionGuidelines}

${outputSection}`;

  return { userPrompt, canon };
}

export function buildChapterRevisionPrompt(params: {
  originalChapter: string;
  revisionInstructions: string;
  acceptanceCriteria: string[];
  assembledContext?: string;
  charactersReference: string;
  endingReference: string;
  structureReference?: string;
  nicheReference?: string;
  tropes?: NicheTropes;
  previousChapterContext?: string;
  nextChapterContext?: string;
  editorialPass?: EditorialPass;
  sceneScoped?: { sceneId: string };
}): string {
  const parts = buildChapterRevisionPromptParts(params);
  return mergeRevisionPrimaryCanonIntoUserPrompt(
    parts.userPrompt,
    parts.canon ? formatRevisionPrimaryCanonBlock(parts.canon) : '',
  );
}
