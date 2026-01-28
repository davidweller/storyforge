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
  
  let prompt = `Provide a comprehensive editorial review of this ${genre} manuscript:

## Manuscript
${manuscript}

## Reference Documents (Canon)
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
List any continuity errors or inconsistencies:
| Chapter | Location | Issue | Recommended Fix |
|---------|----------|-------|-----------------|

### 3. Character Issues
Identify problems with character consistency, development, or voice:
| Character | Chapter | Issue Type | Description | Recommended Fix |
|-----------|---------|------------|-------------|-----------------|

Issue types: voice_inconsistency, motivation_unclear, arc_problem, relationship_issue

### 4. Pacing Issues
Identify sections with pacing problems:
| Chapters | Issue | Description | Recommended Fix |
|----------|-------|-------------|-----------------|

Issue types: too_slow, too_fast, tension_drops, missing_beats

### 5. Prose & Style Issues
Note recurring prose-level issues:
| Issue Type | Frequency | Examples | Recommendation |
|------------|-----------|----------|----------------|

Issue types: telling_not_showing, weak_verbs, repetitive_phrases, dialogue_tags, filter_words

### 6. Logic & Plot Issues
Identify plot holes or logical inconsistencies:
| Chapter | Issue | Description | Recommended Fix |
|---------|-------|-------------|-----------------|

### 7. Chapter-by-Chapter Notes
For each chapter, provide:
- Chapter #: [Title]
- Strengths:
- Issues to Address:
- Specific Line Notes (if any):

### 8. Revision Priority List
Rank the top 10 issues by importance:
1. [Issue] - [Chapter(s)] - [Why it's critical]
...

### 9. Positive Highlights
List 5-10 specific things that work well and should be preserved.

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
