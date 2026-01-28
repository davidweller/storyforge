export const CHAPTERS_SYSTEM = `You are a skilled fiction writer with a gift for immersive prose, compelling dialogue, and emotional resonance. Your writing:

- Shows rather than tells
- Uses sensory details to ground scenes
- Creates distinctive character voices
- Balances action, dialogue, and interiority
- Maintains consistent tone and style
- Ends chapters with hooks that compel reading

Write prose that transports readers and makes them feel deeply.`;

export function buildChapterPrompt(params: {
  genre: string;
  chapterNumber: number;
  chapterTitle: string;
  beatReference: string;
  sceneGoal: string;
  pov?: string;
  charactersReference: string;
  endingReference: string;
  previousChapterSummary?: string;
  structureContext: string;
  wordTarget?: number;
}): string {
  const {
    genre,
    chapterNumber,
    chapterTitle,
    beatReference,
    sceneGoal,
    pov,
    charactersReference,
    endingReference,
    previousChapterSummary,
    structureContext,
    wordTarget = 3000,
  } = params;
  
  let prompt = `Write Chapter ${chapterNumber}: "${chapterTitle}" for this ${genre} novel.

## Story Context

**Story Structure Position:**
${structureContext}

**This Chapter's Beat:**
${beatReference}

**Scene Goal:**
${sceneGoal}

${pov ? `**POV Character:** ${pov}` : ''}

**Target Word Count:** ~${wordTarget} words

## Reference Materials

**Key Characters:**
${charactersReference}

**Ending We're Building Toward:**
${endingReference}
`;

  if (previousChapterSummary) {
    prompt += `
**Previous Chapter Summary:**
${previousChapterSummary}
`;
  }

  prompt += `
## Writing Instructions

1. **Opening Hook**: Start with an engaging opening that draws readers in immediately.

2. **Scene Construction**: 
   - Ground the reader in time and place quickly
   - Use sensory details (sight, sound, smell, touch, taste)
   - Balance action, dialogue, and interiority
   - Show character emotions through behavior and body language

3. **Dialogue**:
   - Each character should have a distinctive voice
   - Dialogue should reveal character and advance plot
   - Use subtext - characters don't always say what they mean
   - Include beats and action between dialogue

4. **Pacing**:
   - Vary sentence length for rhythm
   - Use shorter paragraphs for tension
   - Allow breathing room for emotional moments
   - End scenes at moments of change or decision

5. **Chapter Ending**:
   - End with a hook or question that compels continued reading
   - Create anticipation for what comes next
   - Can end mid-scene for tension or at a natural break

## Constraints

- Stay true to established character voices and personalities
- Maintain consistency with previous chapters
- Advance the plot according to the beat sheet
- Plant any necessary seeds for future payoffs
- Do NOT resolve the main story conflict (unless this is the final chapter)

Write the complete chapter now. Focus on immersive, engaging prose that serves both story and character.`;

  return prompt;
}

export function buildChapterRevisionPrompt(params: {
  originalChapter: string;
  revisionInstructions: string;
  acceptanceCriteria: string[];
  charactersReference: string;
  endingReference: string;
}): string {
  const {
    originalChapter,
    revisionInstructions,
    acceptanceCriteria,
    charactersReference,
    endingReference,
  } = params;
  
  return `Revise the following chapter according to the editorial feedback:

## Original Chapter
${originalChapter}

## Revision Instructions
${revisionInstructions}

## Acceptance Criteria
The revised chapter must:
${acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

## Reference Materials (for consistency)

**Characters:**
${charactersReference}

**Ending Constraints:**
${endingReference}

## Revision Guidelines

1. **Preserve What Works**: Keep strong elements from the original
2. **Address All Issues**: Ensure every point in the revision instructions is addressed
3. **Maintain Voice**: Keep the narrative voice consistent
4. **No New Plot Threads**: Don't introduce new subplots or characters unless specifically requested
5. **Canon Compliance**: Ensure all changes align with established canon

Write the complete revised chapter. Make targeted improvements while preserving the chapter's strengths.`;
}
