import type { EditorialPass } from '@/types';

/** Default Chicago; override with COPY_EDIT_STYLE_GUIDE in env. */
export function getCopyEditStyleGuide(): string {
  return (
    (typeof process !== 'undefined' && process.env?.COPY_EDIT_STYLE_GUIDE?.trim()) ||
    'Chicago Manual of Style (17th ed.)'
  );
}

export const EDITORIAL_SYSTEM = `You are an expert editorial assistant for commercial fiction. Follow the pass-specific role and scope given in the user prompt. Stay within that pass: do not drift into tasks that belong to earlier or later editing stages. Be specific and grounded in the manuscript text provided.`;

const PASS_FOCUS: Record<EditorialPass, string> = {
  structural: `**Pass: Structural / developmental edit.**

You are an experienced developmental editor with a background in commercial fiction and narrative non-fiction. Your role is to assess the manuscript at the structural level — not the sentence. Focus on: overall architecture and pacing; whether the premise is clearly established and sustained; chapter and scene sequencing; point of view consistency; the strength and coherence of the character arc(s); thematic clarity; and whether the ending earns what the opening promises. Do not comment on prose style, grammar, or word choice at this stage. Deliver your feedback as a structured editorial report with section headings. For each issue, identify the problem, explain why it matters to the reader, and suggest one or more concrete approaches to address it. Where the manuscript is working well, say so and explain why. Be direct and specific. Vague encouragement is not useful.`,

  line: `**Pass: Line edit.**

You are a professional line editor. Your job is to work at the paragraph and sentence level to strengthen the prose without erasing the author's voice. Focus on: rhythm and sentence variety; clarity of meaning; redundancy and over-writing; weak or passive constructions where they undercut the narrative energy; dialogue that feels unnatural or on-the-nose; filtering language that distances the reader from the POV character; and moments where showing would serve better than telling. Do not correct spelling or grammar unless an error affects meaning. Where you suggest a revision, show the original line, your suggested revision, and a brief explanation of your reasoning. Do not rewrite wholesale — your changes should feel like refinements, not replacements.`,

  copy: `**Pass: Copy edit.**

You are a copy editor working to industry publishing standards. Your job is to ensure the manuscript is internally consistent, grammatically correct, and ready for typesetting. Work through the text methodically and address: grammar, punctuation, and spelling errors; inconsistencies in character names, place names, and timeline; inconsistent hyphenation, capitalisation, and number formatting; misused words and malapropisms; unclear pronoun references; and any factual claims that appear internally inconsistent (flag rather than correct). Apply the style guide named in the requirements section below. Maintain a style sheet as you work, recording your decisions on recurring terms, proper nouns, and formatting choices. Do not alter the author's stylistic decisions unless they create genuine ambiguity.`,

  proofread: `**Pass: Proofread.**

You are a professional proofreader performing a final quality check on a manuscript that has already been edited and formatted. Your sole job is to catch errors that have survived all previous editorial stages. Look for: spelling mistakes and typos; incorrect or missing punctuation; word repetition across line breaks; widows and orphans if layout is provided; incorrect word breaks; any text that has been accidentally duplicated or dropped; and any formatting inconsistency (heading styles, italics, spacing). Do not suggest stylistic changes or question editorial decisions. Do not rewrite anything. Flag every issue with its location (chapter and paragraph, or page and line if formatted), the current text, and the correction required. Present your findings as a numbered list, working through the document in order.`,

  final_report: `**Pass: Final editorial report (standalone).**

You are acting as a senior fiction editor. This pass is an advisory report only — deliver analysis and recommendations, not rewritten prose unless explicitly asked.`,
};

export function buildEditorialPrompt(params: {
  manuscript: string;
  genre: string;
  assembledContext?: string;
  nicheReference?: string;
  charactersReference?: string;
  endingReference?: string;
  structureReference?: string;
  editorialPass?: EditorialPass;
  /** Built from niche / microniche / positioning; shown before the manuscript. */
  intendedAudience?: string;
  /** Premise, research, or other author-supplied concerns. */
  premise?: string;
  research?: string;
}): string {
  const {
    manuscript,
    genre,
    assembledContext,
    nicheReference,
    charactersReference,
    endingReference,
    structureReference,
    editorialPass = 'structural',
    intendedAudience,
    premise,
    research,
  } = params;

  if (!manuscript || manuscript.trim().length === 0) {
    throw new Error('Manuscript content is required for editorial review');
  }

  const concernsParts: string[] = [];
  if (premise?.trim()) concernsParts.push(`**Premise:** ${premise.trim()}`);
  if (research?.trim()) concernsParts.push(`**Research / notes:** ${research.trim()}`);
  const authorConcernsBlock =
    concernsParts.length > 0
      ? concernsParts.join('\n\n')
      : 'No additional concerns supplied.';

  console.log('[Editorial Prompt] Building prompt:', {
    manuscriptLength: manuscript.length,
    genre,
    editorialPass,
    hasNiche: !!nicheReference,
    hasCharacters: !!charactersReference,
    hasEnding: !!endingReference,
    hasStructure: !!structureReference,
    hasAssembledContext: !!assembledContext,
    hasAudience: !!intendedAudience?.trim(),
    hasPremise: !!premise?.trim(),
    hasResearch: !!research?.trim(),
  });

  const audienceLine =
    intendedAudience?.trim() ||
    'Not specified in project metadata; infer intended audience from the niche / reference documents below when present.';

  let prompt = `## Context for this review

**Genre:** ${genre}

**Intended audience:** ${audienceLine}

**Specific concerns / author context:**
${authorConcernsBlock}

---

${PASS_FOCUS[editorialPass]}

## CRITICAL: Ground feedback in the manuscript

The manuscript text appears below (after this section). You MUST:
- Read and analyze the actual manuscript content provided
- Reference specific passages, scenes, and lines where relevant
- Cite chapter numbers and approximate locations when identifying issues
- Avoid generic advice that is not tied to this manuscript

## Manuscript Content

${manuscript}

## Reference documents (canon)

Use these for consistency checks alongside the manuscript:
`;

  if (assembledContext) {
    prompt += `
## Canon Context

Use this bounded canon context as the primary source of truth for continuity, style, character promises, hard constraints, and intended payoffs. Treat hard constraints as binding when evaluating the manuscript.

${assembledContext}
`;
  }

  if (nicheReference) {
    prompt += `
**Target audience & positioning${assembledContext ? ' (fallback only)' : ''}:**
${nicheReference}
`;
  }

  if (charactersReference) {
    prompt += `
**Character profiles${assembledContext ? ' (fallback only)' : ''}:**
${charactersReference}
`;
  }

  if (endingReference) {
    prompt += `
**Intended ending${assembledContext ? ' (fallback only)' : ''}:**
${endingReference}
`;
  }

  if (structureReference) {
    prompt += `
**Story structure${assembledContext ? ' (fallback only)' : ''}:**
${structureReference}
`;
  }

  if (editorialPass === 'structural') {
    prompt += structuralRequirementsBlock();
  } else if (editorialPass === 'line') {
    prompt += lineRequirementsBlock();
  } else if (editorialPass === 'copy') {
    prompt += copyRequirementsBlock();
  } else if (editorialPass === 'proofread') {
    prompt += proofreadRequirementsBlock();
  } else {
    prompt += finalReportRequirementsBlock();
  }

  return prompt;
}

function structuralRequirementsBlock(): string {
  return `
## Structural review requirements

**Synopsis vs full text:** If the Story Structure reference above reads as a synopsis or high-level summary, use it together with the manuscript for macro assessment. If no synopsis-like summary is available, rely on the full manuscript for structural analysis.

Provide a structured editorial report with clear section headings. **Do not** comment on prose style, grammar, or word choice (defer to the line and copy passes).

### 1. Executive summary
Overall assessment; what is working at the story level and why; priority areas for revision.

### 2. Premise, promise, and payoff
Whether the premise is established and sustained; whether the ending earns what the opening promises.

### 3. Architecture and sequencing
Chapter and scene order; missing or redundant beats; POV consistency at a structural level.

### 4. Character arcs
Strength and coherence of arcs; motivation and relationships — cite manuscript moments.

### 5. Pacing (macro)
Act/chapter-level pacing; where the story drags or rushes — cite locations.

### 6. Theme and emotional through-line
Thematic clarity and effectiveness for the intended reader.

### 7. Continuity (macro)
Plot-level continuity issues — chapter references and brief location cues.

### 8. Issues (structured)
For each issue: **Problem** · **Why it matters to the reader** · **Concrete approaches to address it** · **Where in the manuscript** (chapter / scene).

### 9. What is working
Specific strengths with brief explanation (not vague praise).

### 10. Revision priority list
Rank the top issues for the author to tackle first.

## Validation
- [ ] Feedback stays at structural / developmental scope (no sentence-level copyediting)`;
}

function lineRequirementsBlock(): string {
  return `
## Line edit review requirements

### 1. Executive summary
Line-level strengths and priorities (1–2 paragraphs).

### 2. Issues by category
For each issue include **Chapter**, **Location**, **Issue**, and where you suggest a change: **Original line** (quoted) · **Suggested revision** · **Brief reasoning**. Do not rewrite whole paragraphs wholesale — refinements only.

### 3. Dialogue and voice
With quoted examples where helpful.

### 4. Rhythm and paragraph flow
Scenes or passages that need tightening — cite locations.

### 5. Chapter-by-chapter line notes
Top fixes per chapter and **preserve** notes for voice.

### 6. Priority list
Top line issues by impact.

### 7. Highlights
Passages that already work well.

Stay in line-edit scope: do not propose new plot events or characters unless a clarity-breaking gap requires a minimal fix.`;
}

function copyRequirementsBlock(): string {
  const style = getCopyEditStyleGuide();
  return `
## Copy edit review requirements

**Style guide in use:** ${style}

### 1. Executive summary
Patterns of copy issues (1–2 paragraphs).

### 2. Style sheet
Maintain a running style sheet in your report: recurring terms, proper nouns, hyphenation/capitalization/number choices, and other repeatable decisions.

### 3. Grammar, syntax, punctuation, spelling
Per issue: **Chapter**, **Location**, **Rule or standard**, **Manuscript quote**, **Fix**.

### 4. Consistency
Names, places, timeline, capitalization, series-internal facts — table or list with chapter refs.

### 5. Word choice and ambiguity
Misused words, unclear pronouns, malapropisms — quote the manuscript. Flag internal factual inconsistencies rather than inventing corrections.

### 6. Chapter-by-chapter copy notes
Brief checklist per chapter.

### 7. Priority list
Top copy issues.

### 8. Highlights
Clean sentences to keep.

Do not rewrite for preference alone; fix copy-standard problems and genuine ambiguity only.`;
}

function proofreadRequirementsBlock(): string {
  return `
## Proofread review requirements

This pass is **errors only**. No stylistic improvements, no story suggestions, no questioning prior editorial choices.

Present findings as a **numbered list in document order**. For each item:
1. **Location** (chapter and paragraph, or page/line if provided)
2. **Current text** (quote)
3. **Correction** required

Cover: typos and spelling; punctuation errors; word repetition at line breaks; duplicated or dropped text; formatting inconsistencies (headings, italics, spacing); widows/orphans and bad breaks if layout is visible.

If unsure whether something is an error, prefer flagging over rewriting.`;
}

function finalReportRequirementsBlock(): string {
  return `
## Final report requirements

Provide a structured editorial report covering:

1. Continuity errors (with chapter references)
2. Character consistency issues
3. Emotional arc weaknesses
4. Pacing problems
5. Redundancy or overwriting
6. Missed opportunities for resonance
7. Any other issues that might affect the quality of the manuscript and the reader experience

For each issue:
- **Location** — if specific, give the text immediately before the spot.
- **Problem description**
- **Concrete fix suggestion**

**Do NOT rewrite prose** unless explicitly asked.`;
}

export function buildRevisionQueuePrompt(params: {
  editorialReport: string;
  chapterCount: number;
  editorialPass?: EditorialPass;
}): string {
  const { editorialReport, chapterCount, editorialPass = 'structural' } = params;
  const scope = PASS_FOCUS[editorialPass];

  const scopeNote =
    editorialPass === 'final_report'
      ? 'This pass is report-only in the app — you should not normally receive this prompt. If you do, output minimal placeholder tasks with issueCount 0 for every chapter.'
      : '';

  return `Convert the following editorial report into a structured revision queue.

${scope}

${scopeNote}

Only include revision tasks and issues that belong to this pass. Omit issues outside this pass's scope (e.g. for proofread, only typos, punctuation, and formatting — no plot or style notes; for structural, story-level items — not proofreading).

## Editorial report
${editorialReport}

## Output requirements

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
          "manuscriptQuote": "Exact quoted manuscript passage tied to this issue",
          "location": "Approximate location in chapter",
          "fix": "Specific instruction for fixing",
          "sceneId": "Optional: scene card id when the issue is localized to one scene (for targeted revision)"
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
- For chapters with issueCount 0, set summary to: "Verify continuity: confirm this chapter is consistent with established character voices, timeline, and the preceding/following chapters. No structural issues were flagged but token constraints may have limited coverage."
- Priority levels: "high", "medium", "low", "none"
- Be specific in fix instructions — vague feedback is unhelpful
- For each issue, include manuscriptQuote with the exact problematic passage quoted from the editorial report; if no quote is available, use an empty string.
- Optional **sceneId**: when the report ties an issue to a single scene and a stable scene identifier is known or can be inferred, set sceneId so downstream revision can target only that scene. Omit sceneId when the issue is chapter-wide or scene cannot be determined.
- Acceptance criteria should be verifiable
- preserveElements prevents over-revision

Output only valid JSON. Do not include markdown fences or commentary outside the JSON object.`;
}

export const REVISION_VERIFY_SYSTEM =
  'You are a meticulous fiction revision QA reader. Evaluate revised prose against editorial instructions. Respond only with valid JSON matching the requested schema.';

export function buildRevisionVerificationPrompt(
  revisedContent: string,
  instructions: string,
  issueDescriptions: string[],
): string {
  const issuesBlock =
    issueDescriptions.length > 0
      ? issueDescriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')
      : '(No separate issue list; use instructions only.)';

  return `## Revised text

${revisedContent}

## Aggregate revision instructions

${instructions}

## Individual issues (each should be materially addressed if it applies to this excerpt)

${issuesBlock}

## Output

Return a single JSON object:
{
  "satisfied": boolean,
  "checklist": [
    { "criterion": string, "met": boolean, "evidence": string }
  ],
  "overallNotes": string (optional)
}

Set satisfied to true only if the revision adequately implements the instructions and issues for this excerpt without obvious new problems.

Output only the JSON object. No markdown fences or other text.`;
}
