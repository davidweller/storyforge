export const CHAPTERS_SYSTEM = `You are a skilled fiction writer with a gift for immersive prose, compelling dialogue, and emotional resonance. Your writing:

- Shows rather than tells
- Uses sensory details to ground scenes
- Creates distinctive character voices
- Balances action, dialogue, and interiority
- Maintains consistent tone and style
- Ends chapters with hooks that compel reading

Write prose that transports readers and makes them feel deeply.`;

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
}): string {
  const {
    premise,
    genre,
    structureReference,
    charactersReference,
    endingReference,
    genreResearch,
    nicheReference,
  } = params;

  let prompt = `Create a complete Chapter Outlines document for this ${genre} novel based on the Plot Blueprint (Save the Cat beat sheet).

**Genre:** ${genre}`;

  if (premise) {
    prompt += `
**Premise:** ${premise}`;
  }

  prompt += `

## Plot Blueprint (Story Structure)
${structureReference}

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
6. **Word Target** - Approximate word count target (typically 2500-4000 words, but can vary for pacing)
7. **Key Plot Points** - 3-5 specific plot points or events that must occur in this chapter

## Output Format

Present the chapter outlines in a structured markdown table format:

| Ch # | Title | Beat(s) | Scene Goal | POV | Word Target | Key Plot Points |
|------|------|---------|------------|-----|-------------|----------------|
| 1 | [Title] | [Beat name] | [Detailed goal] | [Character] | ~3000 | • Point 1<br>• Point 2<br>• Point 3 |
| 2 | [Title] | [Beat name] | [Detailed goal] | [Character] | ~3000 | • Point 1<br>• Point 2<br>• Point 3 |
| ... | ... | ... | ... | ... | ... | ... |

After the table, provide a brief narrative overview explaining:
- How the chapters flow from one to the next
- How the pacing varies across the story
- How character arcs progress through the chapters
- How the emotional arc builds to the climax

## Guidelines

- Map beats to approximately 20-30 chapters (adjust based on story complexity)
- Ensure each chapter has a clear purpose and advances the story
- Vary chapter length for pacing (shorter chapters for tension, longer for development)
- Balance action, character development, and world-building
- Ensure continuity - each chapter should flow naturally from the previous
- Consider the genre and niche expectations
- Align with the ending blueprint - plant seeds early for later payoffs

Generate the complete chapter outlines now.`;
  
  return prompt;
}

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
  genreResearch?: string;
  nicheReference?: string;
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
    genreResearch,
    nicheReference,
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

${genreResearch ? `**Genre Research & Market Context:**
${genreResearch}

` : ''}${nicheReference ? `**Niche Positioning & Audience:**
${nicheReference}

` : ''}**Key Characters:**
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
