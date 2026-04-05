import type { EditorialPass } from '@/types';

export const EDITORIAL_SYSTEM = `You are a senior developmental editor with decades of experience in commercial fiction. You provide thorough, constructive feedback that helps authors strengthen their manuscripts.

Your feedback is:
- Specific and actionable
- Organized by category and severity
- Balanced (acknowledge strengths, address weaknesses)
- Focused on reader experience
- Practical to implement

You identify issues at both macro (story) and micro (scene/prose) levels.`;

const PASS_FOCUS: Record<EditorialPass, string> = {
  structural:
    '**Pass: Structural / developmental edit.** Focus on story architecture: plot logic, character arcs and motivation, scene purpose, pacing at act/chapter level, continuity, and whether the manuscript delivers on its premise. Defer sentence-level polish to later passes.',
  line:
    '**Pass: Line edit.** Focus on clarity, readability, rhythm, dialogue mechanics, paragraph flow, and scene-level tightening. Do NOT restructure plot or change story beats unless a clarity-breaking problem requires a minimal fix.',
  copy:
    '**Pass: Copy edit.** Focus on grammar, syntax, punctuation, internal consistency (names, ages, timelines, capitalization), word choice, repetition, and style consistency. Do not rewrite for voice unless fixing an error.',
  proofread:
    '**Pass: Proofread.** Focus on residual typos, misspellings, wrong words, punctuation errors, formatting glitches, and obvious mistakes only. Assume story and sentences are locked; flag substantive issues only if they are clear errors.',
};

export function buildEditorialPrompt(params: {
  manuscript: string;
  genre: string;
  nicheReference?: string;
  charactersReference?: string;
  endingReference?: string;
  structureReference?: string;
  editorialPass?: EditorialPass;
}): string {
  const {
    manuscript,
    genre,
    nicheReference,
    charactersReference,
    endingReference,
    structureReference,
    editorialPass = 'structural',
  } = params;
  
  // Validate manuscript is provided
  if (!manuscript || manuscript.trim().length === 0) {
    throw new Error('Manuscript content is required for editorial review');
  }
  
  console.log('[Editorial Prompt] Building prompt:', {
    manuscriptLength: manuscript.length,
    genre,
    editorialPass,
    hasNiche: !!nicheReference,
    hasCharacters: !!charactersReference,
    hasEnding: !!endingReference,
    hasStructure: !!structureReference,
  });
  
  let prompt = `Provide an editorial review of this ${genre} manuscript.

${PASS_FOCUS[editorialPass]}

## CRITICAL: You MUST Reference the Actual Manuscript

**IMPORTANT**: The complete manuscript text is provided below. You MUST:
- Read and analyze the ACTUAL manuscript content provided
- Reference specific passages, scenes, and lines from the manuscript in your feedback
- Base ALL recommendations on what is actually written, not generic advice
- Cite chapter numbers and approximate locations when identifying issues
- Provide examples from the manuscript text to illustrate your points

**DO NOT** provide generic editorial advice without referencing the actual manuscript content. Every issue you identify must be grounded in specific content from the manuscript below.

## Manuscript Content

The complete manuscript text is provided below.

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

  if (editorialPass === 'structural') {
    prompt += structuralRequirementsBlock();
  } else if (editorialPass === 'line') {
    prompt += lineRequirementsBlock();
  } else if (editorialPass === 'copy') {
    prompt += copyRequirementsBlock();
  } else {
    prompt += proofreadRequirementsBlock();
  }

  return prompt;
}

function structuralRequirementsBlock(): string {
  return `
## Editorial Review Requirements (Structural)

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

### 5. Prose & Style Issues (macro patterns only)
Note recurring patterns worth a later line pass; **MUST provide examples from the manuscript.**

### 6. Logic & Plot Issues
Identify plot holes or logical inconsistencies. **MUST reference specific plot points from the manuscript.**

### 7. Chapter-by-Chapter Notes
For each chapter: strengths, structural issues, preserve-list.

### 8. Revision Priority List
Rank the top 10 issues by importance.

### 9. Positive Highlights
List 5-10 specific strengths with manuscript references.

## Validation Checklist
- [ ] Every issue references specific manuscript content
- [ ] Recommendations stay within structural / developmental scope

Be thorough but constructive.`;
}

function lineRequirementsBlock(): string {
  return `
## Line Edit Review Requirements

### 1. Executive Summary
Brief overview of line-level strengths and priorities (1-2 paragraphs).

### 2. Clarity & Flow
Per issue: **Chapter**, **Location**, **Issue**, **Example from manuscript**, **Suggested revision** (direction, not full rewrite unless short).

### 3. Dialogue & Voice
Tag mechanics, clarity, subtext, rhythm—**with quotes.**

### 4. Paragraph & Beat Rhythm
Scenes that drag, choppy passages, white-space issues—cite locations.

### 5. Chapter-by-Chapter Line Notes
For each chapter: top line-level fixes and **preserve** voice notes.

### 6. Priority List
Top 10 line issues by impact.

### 7. Highlights
Passages that already read strongly.

Stay within line-edit scope; do not propose new plot events or characters.`;
}

function copyRequirementsBlock(): string {
  return `
## Copy Edit Review Requirements

### 1. Executive Summary
Patterns of copy issues (1-2 paragraphs).

### 2. Grammar, Syntax, Punctuation
Per issue: **Chapter**, **Location**, **Rule/example**, **Manuscript quote**, **Fix**.

### 3. Consistency
Names, spelling of terms, numbers, timelines, capitalization, series style—table or list with chapter refs.

### 4. Word Choice & Repetition
Unintended repetition, weak words, clichés—**with quotes.**

### 5. Chapter-by-Chapter Copy Notes
Brief checklist per chapter.

### 6. Priority List
Top copy issues.

### 7. Highlights
Clean, effective sentences to keep.

Do not rewrite for style preference alone; flag copy-standard problems.`;
}

function proofreadRequirementsBlock(): string {
  return `
## Proofread Review Requirements

### 1. Executive Summary
Residual error density and any systemic typo pattern (short).

### 2. Typos & Wrong Words
Per item: **Chapter**, **Location**, **Error**, **Correction** (quote the manuscript).

### 3. Punctuation & Formatting
Straight/curly quotes, em dashes, scene break markers, spacing—only clear mistakes.

### 4. Chapter-by-Chapter Proofing Notes
Quick pass results per chapter.

### 5. Final Checklist
Confirm no new story suggestions; errors only.

If unsure, prefer flagging over rewriting.`;
}

export function buildRevisionQueuePrompt(params: {
  editorialReport: string;
  chapterCount: number;
  editorialPass?: EditorialPass;
}): string {
  const { editorialReport, chapterCount, editorialPass = 'structural' } = params;
  const scope = PASS_FOCUS[editorialPass];

  return `Convert the following editorial report into a structured revision queue.

${scope}

Only include revision tasks and issues that belong to this pass. Omit issues outside this pass's scope (e.g. for proofread, only typos/punctuation/formatting—no plot notes).

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
