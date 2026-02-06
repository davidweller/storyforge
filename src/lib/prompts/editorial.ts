export const EDITORIAL_SYSTEM = `You are a senior developmental editor with decades of experience in commercial fiction. You provide thorough, constructive feedback that helps authors strengthen their manuscripts.

Your feedback is:
- Specific and actionable
- Organized by category and severity
- Balanced (acknowledge strengths, address weaknesses)
- Focused on reader experience
- Practical to implement

You identify issues at both macro (story) and micro (scene/prose) levels.`;

export function buildEditorialPrompt(params: {
  manuscript: string;
  genre: string;
  nicheReference?: string;
  charactersReference?: string;
  endingReference?: string;
  structureReference?: string;
}): string {
  const {
    manuscript,
    genre,
    nicheReference,
    charactersReference,
    endingReference,
    structureReference,
  } = params;
  
  // Validate manuscript is provided
  if (!manuscript || manuscript.trim().length === 0) {
    throw new Error('Manuscript content is required for editorial review');
  }
  
  console.log('[Editorial Prompt] Building prompt:', {
    manuscriptLength: manuscript.length,
    genre,
    hasNiche: !!nicheReference,
    hasCharacters: !!charactersReference,
    hasEnding: !!endingReference,
    hasStructure: !!structureReference,
  });
  
  let prompt = `Provide a comprehensive editorial review of this ${genre} manuscript.

## CRITICAL: You MUST Reference the Actual Manuscript

**IMPORTANT**: The complete manuscript text is provided below. You MUST:
- Read and analyze the ACTUAL manuscript content provided
- Reference specific passages, scenes, and lines from the manuscript in your feedback
- Base ALL recommendations on what is actually written, not generic advice
- Cite chapter numbers and approximate locations when identifying issues
- Provide examples from the manuscript text to illustrate your points

**DO NOT** provide generic editorial advice without referencing the actual manuscript content. Every issue you identify must be grounded in specific content from the manuscript below.

## Manuscript Content

The complete manuscript text is provided below. Review it thoroughly for continuity, character consistency, pacing, prose quality, and plot logic.

${manuscript}

## Reference Documents (Canon)

The following reference documents provide context about the intended story, characters, and structure. Use these to check for consistency with the manuscript:
`;

  if (nicheReference) {
    prompt += `
**Target Audience & Positioning:**
${nicheReference}
`;
  }

  if (charactersReference) {
    prompt += `
**Character Profiles:**
${charactersReference}
`;
  }

  if (endingReference) {
    prompt += `
**Intended Ending:**
${endingReference}
`;
  }

  if (structureReference) {
    prompt += `
**Story Structure:**
${structureReference}
`;
  }

  prompt += `
## Editorial Review Requirements

Provide your feedback in the following structured format:

### 1. Executive Summary
- Overall assessment (2-3 paragraphs)
- Key strengths
- Priority areas for revision
- Commercial viability assessment

### 2. Continuity Issues
List any continuity errors or inconsistencies. **MUST cite specific passages from the manuscript.** For each issue use this structure (leave a blank line between issues):
- **Chapter:** [number]
- **Location:** [where in chapter]
- **Issue:** [description]
- **Example from manuscript:** [quote or reference]
- **Recommended fix:** [action]

### 3. Character Issues
Identify problems with character consistency, development, or voice. **MUST reference specific dialogue or actions from the manuscript.** For each issue list:
- **Character:** [name]
- **Chapter:** [number]
- **Issue type:** voice_inconsistency | motivation_unclear | arc_problem | relationship_issue
- **Description:** [what’s wrong]
- **Example from manuscript:** [quote or reference]
- **Recommended fix:** [action]

### 4. Pacing Issues
Identify sections with pacing problems. **MUST reference specific chapters and scenes.** For each issue list:
- **Chapters:** [which]
- **Issue type:** too_slow | too_fast | tension_drops | missing_beats
- **Description:** [what’s wrong]
- **Scene/passage reference:** [specific location]
- **Recommended fix:** [action]

### 5. Prose & Style Issues
Note recurring prose-level issues. **MUST provide actual examples from the manuscript.** For each issue list:
- **Issue type:** telling_not_showing | weak_verbs | repetitive_phrases | dialogue_tags | filter_words
- **Frequency:** [how often it appears]
- **Examples from manuscript:** [quotes]
- **Recommendation:** [action]

### 6. Logic & Plot Issues
Identify plot holes or logical inconsistencies. **MUST reference specific plot points from the manuscript.** For each issue list:
- **Chapter:** [number]
- **Issue:** [description]
- **Plot point reference:** [specific reference]
- **Recommended fix:** [action]

### 7. Chapter-by-Chapter Notes
For each chapter, provide detailed analysis based on the actual manuscript content:
- Chapter #: [Title]
- Strengths: [Cite specific scenes, lines, or passages that work well]
- Issues to Address: [Reference specific problems with examples from the chapter]
- Specific Line Notes (if any): [Quote or reference exact problematic passages]

### 8. Revision Priority List
Rank the top 10 issues by importance:
1. [Issue] - [Chapter(s)] - [Why it's critical]
...

### 9. Positive Highlights
List 5-10 specific things that work well and should be preserved. **MUST reference actual passages, scenes, or lines from the manuscript**.

## Validation Checklist

Before submitting your review, verify:
- [ ] Every issue references specific content from the manuscript
- [ ] Chapter numbers and approximate locations are provided for all issues
- [ ] Examples are actual quotes or references from the manuscript text
- [ ] No generic advice without manuscript context
- [ ] All recommendations are actionable and specific to this manuscript

Be thorough but constructive. The goal is to help the author improve, not discourage them.`;

  return prompt;
}

export function buildRevisionQueuePrompt(params: {
  editorialReport: string;
  chapterCount: number;
}): string {
  const { editorialReport, chapterCount } = params;
  
  return `Convert the following editorial report into a structured revision queue:

## Editorial Report
${editorialReport}

## Output Requirements

Create a revision task for each chapter (${chapterCount} chapters total) in the following JSON format:

\`\`\`json
{
  "revisionTasks": [
    {
      "chapterNumber": 1,
      "issueCount": 3,
      "priority": "high",
      "summary": "Brief summary of what needs to be fixed",
      "issues": [
        {
          "category": "continuity|character|pacing|prose|logic",
          "description": "Specific issue description",
          "location": "Approximate location in chapter",
          "fix": "Specific instruction for fixing"
        }
      ],
      "acceptanceCriteria": [
        "Criterion 1 the revision must meet",
        "Criterion 2 the revision must meet"
      ],
      "preserveElements": [
        "Specific elements that should NOT be changed"
      ]
    }
  ]
}
\`\`\`

Guidelines:
- Include ALL chapters, even those with no issues (issueCount: 0)
- Priority levels: "high", "medium", "low", "none"
- Be specific in fix instructions - vague feedback is unhelpful
- Acceptance criteria should be verifiable
- preserveElements prevents over-revision

Output only valid JSON.`;
}
