# AI stages and prompts

This document describes what the app sends to the language model for each workflow stage that uses generation: **system message** (role and rules) and **user message** (task-specific prompt body).

**Product / workflow context:** [`novel_prd.md`](novel_prd.md), [`novel-workflow-overview.md`](novel-workflow-overview.md).

**Last verified against:** [`src/app/api/generate/route.ts`](../src/app/api/generate/route.ts) (including `WORKFLOW_STAGES`, `STAGE_DATA_SCHEMAS`, `getStructuredOutputKind`) and [`src/lib/prompts/`](../src/lib/prompts/). Update this doc when those change.

## API surface

`POST /api/generate` accepts a JSON body:

| Field | Description |
|--------|-------------|
| `stage` | One of the workflow stages listed in `WORKFLOW_STAGES` in the route (see [Stage reference](#stage-reference)) |
| `data` | Stage-specific payload; unknown keys are generally allowed (`passthrough` on Zod schemas), but required fields must satisfy `STAGE_DATA_SCHEMAS` validation |
| `model` | Optional model ID; must exist in the app’s model catalog |
| `projectId` | Optional; used for usage / correlation when present |
| `runId` | Optional; correlates multi-step runs (e.g. Full Auto) |
| `usageSource` | Optional enum: `manual-stage`, `full-auto`, `chapter-editor`, `editorial`, `revision` |
| `strictCardinality` | Optional boolean; forwarded into `data` for stages that honor output-count gates |

The handler builds `systemPrompt` and `prompt` (user), then calls `generateForStage` in [`src/lib/llm/router.ts`](../src/lib/llm/router.ts), which routes to OpenAI, Anthropic, or OpenRouter.

Additional behavior:

- `data.temperature` is passed through when present.
- When `getStructuredOutputKind` returns a kind for the stage + payload, the LLM call uses **JSON mode** (`jsonMode: true`). Structured stages in the route include: **`ending`** (concepts only, not expansion), **`title`**, **`chapter-outlines`**, **`chapter-summary`**, **`story-bible`**, **`creative-brief`**, **`editorial`** with `createQueue === true`, **`editorial-issues`**, **`chapter-scene-plan`**, **`chapter-scenes-prose`**, **`chapter-scene-eval`**, **`revision-verify`**. If the returned JSON fails schema validation, the route runs a **repair** pass (second call, JSON-only repair system prompt). The route may also emit **output-count warnings** (`structuredOutputCountWarnings`) or fail **strict cardinality** checks when configured.
- **Editorial** and **`editorial-issues`** runs **`gateEditorialManuscriptContext`** before building prompts; oversized canon + manuscript combinations can return an error or trigger a **fallback model** (see [`manuscriptModelGate`](../src/lib/editorial/manuscriptModelGate.ts)).
- **`chapter-scene-eval`** uses a higher **max output token** cap (`CHAPTER_SCENE_EVAL_OUTPUT_TOKEN_BUDGET` in [`constants`](../src/lib/constants.ts)).
- The route sets a long `maxDuration` (800s) for hosted environments; local dev usually ignores it.

## Model selection

| Source | Behavior |
|--------|-----------|
| **Stage defaults** | [`STAGE_DEFAULT_PROVIDERS`](../src/lib/data/models.ts) maps **every** `WorkflowStage` to **`anthropic`**. [`STAGE_DEFAULT_MODEL_IDS`](../src/lib/data/models.ts) assigns a specific catalog id per stage (there is no single global default). [`getDefaultModelForStage`](../src/lib/data/models.ts) looks up that id with [`getModelById`](../src/lib/data/models.ts) and, if missing, falls back to [`getDefaultModel('anthropic')`](../src/lib/data/models.ts) — **`claude-sonnet-4-6`**. The **`ending`** stage (concepts vs expansion when `data.selectedEnding` is set), **`editorial`** (working passes vs `final_report` vs `createQueue`), and **`chapter-scene-eval`** (`deep` mode) apply branch-specific defaults in [`route.ts`](../src/app/api/generate/route.ts); see the `*_DEFAULT_MODEL_ID` constants in [`models.ts`](../src/lib/data/models.ts). |
| **Request override** | Top-level JSON field **`model`**: must match an entry in [`ALL_MODELS`](../src/lib/data/models.ts). Provider is inferred from the model id in [`resolveModelForStage`](../src/lib/llm/router.ts). |
| **UI preference** | Client may persist per-stage picks in localStorage (`storyforge_model_preferences`); see `getEffectiveModelForStage` in [`models.ts`](../src/lib/data/models.ts). |
| **Max output tokens** | [`STAGE_MAX_TOKENS`](../src/lib/llm/router.ts) applies when the model config does not override; **`chapter-scene-eval`** also receives `maxTokens: CHAPTER_SCENE_EVAL_OUTPUT_TOKEN_BUDGET` (**8192**) on the API call ([`constants.ts`](../src/lib/constants.ts)). |
| **Editorial sizing gate** | For **`editorial`** (report branch) and **`editorial-issues`**, [`gateEditorialManuscriptContext`](../src/lib/editorial/manuscriptModelGate.ts) may switch the model to **`claude-sonnet-4-6-thinking-high`** (Claude Sonnet 4.6 high thinking) when manuscript + references would exceed the originally selected model’s **`maxContextTokens`**. |

Unless you pass **`model`** (or a saved UI preference), the default **varies by `stage`**; use [`STAGE_DEFAULT_MODEL_IDS`](../src/lib/data/models.ts) as the source of truth for each row in the [Stage reference](#stage-reference), plus the **`ending`** / **`editorial`** branch rules above.

**Note:** The router still supports **OpenAI** and **OpenRouter** models when you pass their ids as **`model`**; generation-stage defaults are Anthropic per [`STAGE_DEFAULT_PROVIDERS`](../src/lib/data/models.ts).

## Stages not handled by this route

The request body’s `stage` must be one of `WORKFLOW_STAGES` in the route. Stages are dispatched via **`SIMPLE_STAGE_HANDLERS`** or the **`switch`** (`ending`, `editorial`, `editorial-issues`, `revision`, `revision-verify`). A valid enum value with **no handler** (e.g. `compilation`, `export-draft`, `export-final` when included in the enum) returns **`Invalid stage`** — those steps use other API routes, not LLM generation here.

Non-LLM pipeline steps (also **not** `POST /api/generate` targets in practice):

- `setup`
- `compilation`
- `export-draft`
- `export-final`

## Global flow

```mermaid
flowchart LR
  subgraph request [POST body]
    stage [stage]
    data [data]
    modelOpt [model optional]
  end
  subgraph llm [LLM call]
    sys [System message]
    user [User prompt]
  end
  request --> llm
```

## Pipeline order and document flow

Stages below are listed in typical pipeline order. Earlier stages produce documents that later prompts include as reference text.

```mermaid
flowchart TB
  subgraph early [Planning]
    GR [genre-research]
    N [niche]
    E [ending]
    C [characters]
    S [structure]
  end
  subgraph outline [Outline and draft]
    T [title]
    CO [chapter-outlines]
    Ch [chapters]
    CSP [chapter-scene-plan]
    CSPW [chapter-scenes-prose]
    CP [chapter-polish]
  end
  subgraph canon [Dashboard canon LLM stages]
    SB [story-bible]
    CB [creative-brief]
  end
  subgraph chapterhelpers [Chapter helpers]
    CSUM [chapter-summary]
  end
  subgraph edit [Edit]
    Ed [editorial]
    EI [editorial-issues]
    R [revision]
    RV [revision-verify]
  end
  subgraph market [Marketing optional anytime]
    B [blurb]
    AMZ [amazon-description]
  end
  GR --> N --> E --> C --> S --> T --> CO
  CO --> Ch
  CO -. optional scene pipeline .-> CSP --> CSPW --> CP
  CO --> SB
  SB --> CB
  Ch -. continuity .-> CSUM
  Ch --> Ed
  Ch -. optional editorial-issues .-> EI
  Ed --> R
  EI --> R
  R -. optional verify .-> RV
  Ch -. parallel .-> B
  Ch -. parallel .-> AMZ
```

After approved outlines, the chapter UI may generate with **`chapters`** (single pass) or the scene pipeline: **`chapter-scene-plan`** → **`chapter-scenes-prose`** → optional **`chapter-polish`** → merged deterministic checks plus chunked **`chapter-scene-eval`**. **`story-bible`** / **`creative-brief`** are usually run from the project dashboard; **`chapter-summary`** refreshes running summaries between chapters.


## Stage reference

Summary tables list **`data`** fields and builders. **Default model** depends on **`stage`** per [`STAGE_DEFAULT_MODEL_IDS`](../src/lib/data/models.ts) (and branch logic for **`ending`** / **`editorial`**) unless you pass **`model`** (see [Model selection](#model-selection)).

**Full system and user messages** (exact literals from the codebase, with **`⟨placeholder⟩`** for runtime values) are in the [appendix](#appendix-full-system-and-user-messages).

### `genre-research`

| | |
|---|---|
| **System** | `GENRE_RESEARCH_SYSTEM` — [`src/lib/prompts/genre-research.ts`](../src/lib/prompts/genre-research.ts) |
| **User** | `buildGenreResearchPrompt` |
| **`data`** | `genre`, `premise` (optional), `research` (optional) |

### `niche`

| | |
|---|---|
| **System** | `NICHE_SYSTEM` — [`src/lib/prompts/niche.ts`](../src/lib/prompts/niche.ts) |
| **User** | `buildNichePrompt` |
| **`data`** | `genre`, `premise` (optional), `genreResearch` |

### `ending`

| | |
|---|---|
| **System** | `ENDING_SYSTEM` — [`src/lib/prompts/ending.ts`](../src/lib/prompts/ending.ts) |
| **User** | `buildEndingConceptsPrompt` **or** `buildEndingExpansionPrompt` |

**Branch:**

- If `data.selectedEnding` is set → **expansion** prompt: `premise`, `genre`, `nicheReference`, `selectedEnding`. Plain text response (no `StructuredOutputKind`).
- Else → **concepts** prompt: `premise`, `genre`, `nicheReference`, plus optional **`endingConceptCount`**, **`endingConceptCountMin`**, **`endingConceptCountMax`** (positive numbers) to steer how many concepts to emit. **JSON mode** on the LLM call (`ending-concepts` kind); parsed with `parseEndingConcepts`.

### `characters`

| | |
|---|---|
| **System** | `CHARACTERS_SYSTEM` — [`src/lib/prompts/characters.ts`](../src/lib/prompts/characters.ts) |
| **User** | `buildCharactersPrompt` |
| **`data`** | `genre`, `premise` (optional), `nicheReference`, `endingReference` |

### `structure`

| | |
|---|---|
| **System** | `STRUCTURE_SYSTEM` — [`src/lib/prompts/structure.ts`](../src/lib/prompts/structure.ts) |
| **User** | `buildStructurePrompt` with `maxTotalWords` from `TARGET_MANUSCRIPT_WORDS` |
| **`data`** | `genre`, `premise` (optional), `nicheReference`, `endingReference`, `charactersReference` |

### `title`

| | |
|---|---|
| **System** | `TITLE_IDEAS_SYSTEM` — [`src/lib/prompts/title.ts`](../src/lib/prompts/title.ts) |
| **User** | `buildTitleIdeasPrompt` (truncates some reference fields in the builder) |
| **`data`** | `genre`; optional `premise`, **`assembledContext`**, `nicheReference`, `structureReference`, `endingReference`, `charactersReference`, **`titleCount`** (positive number). **JSON mode** (`title` kind); parsed with `parseTitleOptions`. |

### `chapter-outlines`

| | |
|---|---|
| **System** | `CHAPTER_OUTLINES_SYSTEM` — [`src/lib/prompts/chapters.ts`](../src/lib/prompts/chapters.ts) |
| **User** | `buildChapterOutlinesPrompt` with `maxTotalWords` from `TARGET_MANUSCRIPT_WORDS` |
| **`data`** | `genre`, `premise` (optional), `structureReference`, `charactersReference`, `endingReference`, `genreResearch` (optional), `nicheReference` (optional) |
| **Output** | **JSON mode** (`chapter-outlines` kind); parsed with `parseChapterOutlines`. |

### `chapter-summary`

| | |
|---|---|
| **System** | `CHAPTERS_SYSTEM` — [`src/lib/prompts/chapters.ts`](../src/lib/prompts/chapters.ts) |
| **User** | `buildChapterSummaryPrompt` |
| **`data`** | `genre`, `chapterNumber`, `chapterTitle`, `chapterContent` (full text to summarize) |
| **Output** | **JSON mode** (`chapter-summary` kind); short structured summary string for continuity across chapters. |

### `story-bible`

| | |
|---|---|
| **System** | `STORY_BIBLE_SYSTEM` — [`src/lib/prompts/storyBible.ts`](../src/lib/prompts/storyBible.ts) |
| **User** | `buildStoryBiblePrompt` |
| **`data`** | `genre`, `research` (optional), **`derivedFrom`** (non-empty `StoryBibleSourceRef[]`, must include **`chapter-outlines`**), **`chapterOutlinesReference`** (string that parses to **at least one** chapter). Optional: `premise`, `title`, `niche`, `genreResearch`, `nicheReference`, `endingReference`, `endingChoice`, `charactersReference`, `structureReference`. Validation enforces outline-backed canon generation. |
| **Output** | **JSON mode** (`story-bible` kind); persisted as story bible document. |

### `creative-brief`

| | |
|---|---|
| **System** | `STORY_BIBLE_SYSTEM` (same module family) — [`src/lib/prompts/storyBible.ts`](../src/lib/prompts/storyBible.ts) |
| **User** | `buildCreativeBriefPrompt` |
| **`data`** | `storyBibleContent`, `storyBibleDocumentId`, `storyBibleVersion`, `storyBibleUpdatedAt` |
| **Output** | **JSON mode** (`creative-brief` kind); compact brief derived from an approved bible. |

### `chapters`

| | |
|---|---|
| **System** | `CHAPTERS_SYSTEM` — [`src/lib/prompts/chapters.ts`](../src/lib/prompts/chapters.ts) |
| **User** | `buildChapterPrompt` |
| **`data`** | `genre`, `chapterNumber`, `chapterTitle`, `beatReference`, `sceneGoal`, `pov` (optional), `assembledContext` (optional), `charactersReference`, `endingReference`, `previousChapterSummaries` (optional array of `{ chapterNumber, title, summary }`; **`previousChapterSummary` is rejected** by validation — use the plural key), `structureContext`, `genreResearch` (optional), `nicheReference` (optional), `wordTarget` (optional) |

### `chapter-scene-plan`

| | |
|---|---|
| **System** | `CHAPTER_SCENE_PLAN_SYSTEM` — [`src/lib/prompts/scenes.ts`](../src/lib/prompts/scenes.ts) |
| **User** | `buildChapterScenePlanPrompt` |
| **`data`** | `genre`, `chapterNumber`, `assembledContext` (optional), `outlinesSourceJson` (metadata JSON), `outlineSliceJson` (optional; parsed outline slice for this chapter) |
| **Output** | Structured JSON (`scenePlan` with ordered scene cards); persisted as document type `chapter-scene-plan`. |

### `chapter-scenes-prose`

| | |
|---|---|
| **System** | `CHAPTER_SCENE_PROSE_SYSTEM` — [`src/lib/prompts/scenes.ts`](../src/lib/prompts/scenes.ts) |
| **User** | `buildChapterSceneProsePrompt` |
| **`data`** | `genre`, `chapterNumber`, `chapterTitle`, `sceneCard` (object matching scene-card schema), `assembledContext` (optional), `neighborSummaryBefore` / `neighborSummaryAfter` (optional), `wordTarget` (optional) |
| **Output** | Structured JSON: `{ sceneId, prose }` per scene call; segments are concatenated for chapter plain text and stored as `sceneSegments` on the chapter version. |

### `chapter-polish`

| | |
|---|---|
| **System** | `CHAPTER_POLISH_SYSTEM` — [`src/lib/prompts/scenes.ts`](../src/lib/prompts/scenes.ts) |
| **User** | `buildChapterPolishPrompt` |
| **`data`** | `genre`, `chapterNumber`, `chapterTitle`, `concatenatedDraft`, `assembledContext` (optional) |
| **Output** | Plain improved prose (not JSON); gated in the UI by a feature flag and per-run toggle. |

### `chapter-scene-eval`

| | |
|---|---|
| **System** | `CHAPTER_SCENE_EVAL_SYSTEM` — [`src/lib/prompts/scenes.ts`](../src/lib/prompts/scenes.ts) |
| **User** | `buildChapterSceneEvalPrompt` |
| **`data`** | `genre`, `chapterNumber`, `chapterTitle`, `scenePlanJson`, `chapterText` (chunk of prose), `compactCanon` (assembled evaluation canon text), `chunkLabel` (optional; scene ids in chunk for logging/traceability), **`evaluationMode`** (optional: `lite` \| `standard` \| `deep`) |
| **Output** | Structured JSON evaluation (`checks` with required `sceneId`, severities `info` \| `warn` \| `fail`). The app may call this stage multiple times for disjoint prose chunks and **merge** results with deterministic checks in [`src/lib/chapter/evaluator.ts`](../src/lib/chapter/evaluator.ts). |

### `editorial`

| | |
|---|---|
| **System** | `EDITORIAL_SYSTEM` — [`src/lib/prompts/editorial.ts`](../src/lib/prompts/editorial.ts) |
| **User** | `buildEditorialPrompt` **or** `buildRevisionQueuePrompt` |

**Branch A — revision queue from an editorial report (`data.createQueue === true`):**

- **User** | `buildRevisionQueuePrompt`: `editorialReport`, `chapterCount`, `editorialPass` (parsed; default `structural`).
- **JSON mode** (`revision-queue` kind).

**Branch B — editorial report (default):**

- Requires non-empty `data.manuscript`. Route runs **`gateEditorialManuscriptContext`** before prompt build.
- **User** | `buildEditorialPrompt`: `manuscript`, `genre`, optional **`assembledContext`**, `nicheReference`, `charactersReference`, `endingReference`, `structureReference`, `editorialPass`, `intendedAudience`, `premise`, `research`.
- Pass-specific instructions come from `PASS_FOCUS` and requirement blocks in [`editorial.ts`](../src/lib/prompts/editorial.ts) (`structural`, `line`, `copy`, `proofread`, `final_report`).
- **Plain prose** output (not JSON) unless Branch A.

### `editorial-issues`

Direct **manuscript → revision-queue JSON** in one hop (no separate editorial prose report). Same system prompt family as editorial.

| | |
|---|---|
| **System** | `EDITORIAL_SYSTEM` — [`src/lib/prompts/editorial.ts`](../src/lib/prompts/editorial.ts) |
| **User** | `buildEditorialIssuesQueuePrompt` |
| **`data`** | `manuscript`, `genre`, **`chapterCount`**, optional `assembledContext`, `nicheReference`, `charactersReference`, `endingReference`, `structureReference`, `editorialPass`, `intendedAudience`, `premise`, `research` |
| **Output** | **JSON mode** (`revision-queue` kind). Route applies the same manuscript/canon **gate** as Branch B of `editorial`. |

### `revision`

| | |
|---|---|
| **System** | `CHAPTERS_SYSTEM` (same as chapter drafting) — [`src/lib/prompts/chapters.ts`](../src/lib/prompts/chapters.ts) |
| **User** | `buildChapterRevisionPrompt` |
| **`data`** | `originalContent` (required), `revisionInstructions`, `acceptanceCriteria` (array), `assembledContext` (optional), `charactersReference`, `endingReference`, `structureReference` (optional), `nicheReference` (optional), `previousChapterContext` / `nextChapterContext` (optional), `editorialPass` (optional; affects pass note text via `REVISION_PASS_NOTE`), `sceneRevisionSceneId` (optional; when set, prompt framing restricts revision to that scene segment — used by evaluation “Apply fix”) |

### `revision-verify`

Post-revision **checklist-style** structured pass.

| | |
|---|---|
| **System** | `REVISION_VERIFY_SYSTEM` — [`src/lib/prompts/editorial.ts`](../src/lib/prompts/editorial.ts) |
| **User** | `buildRevisionVerificationPrompt(revisedContent, instructions, issueDescriptions)` |
| **`data`** | `revisedContent`, `instructions`, `issueDescriptions` (string array) |
| **Output** | **JSON mode** (`revision-verify` kind); parsed with `parseRevisionVerification`. |

### `blurb`

| | |
|---|---|
| **System** | `BLURB_SYSTEM` — [`src/lib/prompts/marketing.ts`](../src/lib/prompts/marketing.ts) |
| **User** | `buildBlurbPrompt` |
| **`data`** | `genre`, `niche` (optional), `title` (optional), `premise` (optional), `marketAnalysis` (optional), `readerTargeting` (optional), `plotBlueprint` (optional) |

### `amazon-description`

| | |
|---|---|
| **System** | `AMAZON_DESCRIPTION_SYSTEM` — [`src/lib/prompts/marketing.ts`](../src/lib/prompts/marketing.ts) |
| **User** | `buildAmazonDescriptionPrompt` |
| **`data`** | `genre`, `niche` (optional), `title` (optional), `premise` (optional), `marketAnalysis`, `readerTargeting`, `plotBlueprint` (optional). Optional **`blurb`** is accepted by the request schema but **is not passed** into `buildAmazonDescriptionPrompt` today ([`route.ts`](../src/app/api/generate/route.ts) simple handler). |

---

## Appendix: Full system and user messages

**Default model** for each appendix example matches that **`stage`**’s entry in [`STAGE_DEFAULT_MODEL_IDS`](../src/lib/data/models.ts), unless the client sends **`model`**, or the route applies an **`ending`** / **`editorial`** branch default, or the editorial manuscript gate switches the model ([Model selection](#model-selection)).

Placeholders use **`⟨⟩`**. Optional blocks are noted (*omitted when empty*).

### `genre-research`

**System**

```
You are an expert publishing market analyst specializing in commercial fiction. Your role is to analyze genre opportunities and provide actionable insights for authors.

You provide structured, data-driven analysis while being encouraging and practical. Focus on:
- Current market trends and reader demand
- Underserved niches and opportunities
- Emotional hooks that resonate with readers
- Competitive landscape analysis

Always be specific and actionable in your recommendations.
```

**User** (`buildGenreResearchPrompt`)

```
Analyze the market opportunity for the following novel concept:

**Genre:** ⟨genre⟩

**Premise:** ⟨premise OR "(Not yet provided - focus on general ⟨genre⟩ market opportunities)"⟩

⟨Optional block when data.research is set:
**Additional Research/Context:**
⟨research⟩
⟩

Please provide a comprehensive market analysis including:

## 1. Genre Landscape
- Current state of the ⟨genre⟩ market
- Recent trends and shifts in reader preferences
- Top-performing subgenres and themes

## 2. Market Opportunities
- Underserved niches within ⟨genre⟩
- Gaps in the current market this premise could fill
- Cross-genre appeal potential

## 3. Emotional Demand Analysis
- Core emotional needs this story could satisfy
- Reader expectations for this type of story
- Emotional beats that resonate most strongly

## 4. Competitive Positioning
- How this premise differentiates from existing titles
- Comparable successful titles (comp titles)
- Unique selling points to emphasize

## 5. Recommendations
- Specific elements to emphasize or include
- Potential pitfalls to avoid
- Target reader profile

Provide actionable, specific insights that will help shape this novel for commercial success.
```

### `niche`

**System**

```
You are a publishing strategist specializing in audience targeting and brand positioning for fiction authors. You help authors understand their ideal readers and craft compelling promises.

Your analysis should be:
- Specific and actionable
- Grounded in reader psychology
- Focused on emotional connection
- Practical for marketing purposes
```

**User** (`buildNichePrompt`)

```
Based on the following novel concept and market research, develop a comprehensive niche positioning strategy:

**Genre:** ⟨genre⟩

**Premise:** ⟨premise OR "(Not yet provided - use genre research to guide positioning)"⟩

**Market Research Summary:**
⟨genreResearch⟩

Please provide:

## 1. Reader Avatar
Create a detailed profile of the ideal reader:
- Demographics (age range, typical background)
- Reading habits and preferences
- Other authors/series they love
- What they're looking for in a book
- Their emotional state when picking up this type of book
- Where they discover new books

## 2. Emotional Promise
Define the core emotional experience this book will deliver:
- Primary emotional payoff
- Secondary emotional threads
- The "feeling" readers should have when they finish
- One-sentence emotional promise

## 3. Tropes & Conventions

### Must Include (Reader Expectations)
List 5-7 tropes or elements readers of this niche expect and will be disappointed without.

### Consider Including (Differentiators)
List 3-5 fresh elements or twists that could make this book stand out.

### Avoid (Reader Turn-offs)
List 3-5 elements that would alienate the target audience.

## 4. Positioning Statement
Write a clear positioning statement in this format:
"For [target reader] who wants [emotional need], [Book Title] is a [genre] that delivers [unique promise]. Unlike [alternatives], this book [key differentiator]."

## 5. Marketing Hooks
Provide 3-5 potential taglines or hooks that could be used in marketing.

Be specific and actionable. This analysis will guide the entire creative process.
```

### `ending`

**System**

```
You are a master storyteller and developmental editor specializing in crafting satisfying, emotionally resonant endings. You understand that great endings are earned through proper setup and deliver on the story's emotional promise.

Your approach:
- Endings should feel both surprising and inevitable
- Emotional payoff is paramount
- Character arcs must complete satisfyingly
- Thematic resonance ties everything together
- The ending should honor genre expectations while offering something fresh
```

**User — concepts** (`buildEndingConceptsPrompt`, JSON mode)

Opening lines depend on counts: either “Generate exactly ⟨N⟩ potential ending concepts…” or “Generate between ⟨min⟩ and ⟨max⟩…”, plus a diversity paragraph (short set vs long set). Full template:

````
⟨countLine⟩:

**Genre:** ⟨genre⟩

**Premise:** ⟨premise OR "(Not yet provided - use genre and niche analysis to guide ending concepts)"⟩

**Niche & Audience Analysis:**
⟨nicheReference⟩

For each ending concept, provide:

1. Title: A short, evocative name for this ending type
2. Summary: Maximum 2 sentences describing how the story concludes
3. Emotional Payoff: The primary feeling readers will experience
4. Character Resolution: How the protagonist's arc completes
5. Thematic Statement: What truth about life/humanity this ending affirms

⟨diversitySection⟩

## Output Format

Output only valid JSON in this exact shape:

```json
{
  "endings": [
    {
      "id": "ending-1",
      "title": "Short evocative title",
      "summary": "Maximum two sentences.",
      "emotionalPayoff": "Primary reader feeling.",
      "characterResolution": "How the protagonist's arc completes.",
      "thematicStatement": "The truth this ending affirms."
    }
  ]
}
```

⟨closing exact count line⟩

Remember: The ending determines everything that comes before it. These concepts will shape the entire story structure.
````

**User — expansion** (`buildEndingExpansionPrompt`, plain text)

```
Expand the selected ending concept into a detailed ending blueprint:

**Genre:** ⟨genre⟩

**Premise:** ⟨premise OR "(Not yet provided - use genre and niche analysis to guide ending development)"⟩

**Niche & Audience Analysis:**
⟨nicheReference⟩

**Selected Ending Concept:**
⟨selectedEnding⟩

Please develop this ending in full detail:

## 1. Final Scene Vision
Describe the final scene(s) in vivid detail:
- Setting and atmosphere
- Who is present
- Key actions and dialogue beats
- Sensory details that create emotional impact
- The final image/moment readers will remember

## 2. Climax Requirements
What must happen in the climax to earn this ending:
- The central confrontation or decision
- What the protagonist must sacrifice or overcome
- The moment of transformation
- Stakes that must be established earlier

## 3. Emotional Arc Completion
How the protagonist's emotional journey concludes:
- Their starting emotional state (to be established in Act 1)
- The wound or flaw they carry
- How this ending represents healing/growth
- The internal shift that makes the external resolution possible

## 4. Key Reversals Needed
Plot elements that must be set up earlier to pay off:
- Promises made to the reader that this ending fulfills
- Chekhov's guns that need to be planted
- Relationships that need development
- Information that needs to be withheld then revealed

## 5. Thematic Resonance
How this ending delivers the story's message:
- The central theme this ending embodies
- Symbolic elements that reinforce meaning
- What readers should understand about life/humanity
- The lasting impression this creates

## 6. Sequel/Series Potential (if applicable)
- Does this ending close the story completely or leave threads?
- What questions are answered vs. left open?
- Potential for continuation while still being satisfying standalone

This ending blueprint will guide all story development. Be specific and thorough.
```

### `characters`

**System**

```
You are a character development specialist with deep expertise in creating memorable, three-dimensional characters that serve both story and theme. You understand:

- Characters must have clear wants, needs, and flaws
- Relationships create conflict and growth opportunities
- Character arcs should mirror and support thematic content
- Distinctive voices and mannerisms make characters memorable
- Supporting characters should have their own agency and goals

Create characters that feel real, serve the story, and resonate with readers.
```

**User** (`buildCharactersPrompt`)

```
Design the complete cast of characters for this novel:

**Genre:** ⟨genre⟩

**Premise:** ⟨premise OR "(Not yet provided - use genre, niche, and ending to guide character design)"⟩

**Niche & Audience Analysis:**
⟨nicheReference⟩

**Ending Blueprint:**
⟨endingReference⟩

## Required Output:

### 1. Character List
First, provide a quick reference list of all characters in markdown format:

For each character (include 5-10 significant characters), list:
- **Name**: [Character name]
- **Role**: [Their role in the story]
- **One-Line Description**: [Brief description]

### 2. Protagonist Profile

**Basic Information**
- Full Name:
- Age:
- Occupation/Role:
- Physical Description (distinctive features):

**Psychology**
- Core Want (external goal):
- Core Need (internal/emotional):
- Fatal Flaw:
- Greatest Fear:
- Ghost/Wound (past trauma shaping them):
- Lie They Believe:
- Truth They Must Learn:

**Voice & Mannerisms**
- Speech patterns:
- Physical habits/tics:
- How they relate to others:

**Arc Summary**
- Starting State:
- Midpoint Shift:
- End State:
- Key Transformation Moment:

### 3. Antagonist/Opposition Profile
(Same structure as protagonist, adapted for their role)

### 4. Key Supporting Characters
For each supporting character (3-5 characters):
- Name & Role:
- Relationship to Protagonist:
- Their Own Goal:
- How They Challenge/Support Protagonist:
- Key Function in Plot:
- Distinctive Trait:

### 5. Relationship Map
Describe the key relationships and their dynamics:
- Protagonist ↔ Antagonist:
- Protagonist ↔ Love Interest (if applicable):
- Protagonist ↔ Mentor/Ally:
- Protagonist ↔ Friend/Sidekick:
- Key Conflict Relationships:
- Key Support Relationships:

### 6. Character Constellation
Explain how the cast works together:
- How do characters represent different aspects of the theme?
- What contrasts and parallels exist between characters?
- How do relationships evolve through the story?

Create characters that readers will remember and care about. Every character should have a purpose.
```

### `structure`

**System**

```
You are a story architect specializing in the Save the Cat beat sheet methodology. You understand how to structure compelling narratives that satisfy readers while allowing creative flexibility.

Your approach:
- Every beat serves emotional and plot purposes
- Pacing is crucial - know when to accelerate and breathe
- The midpoint is a crucial turning point
- All Is Lost must feel genuinely hopeless
- The finale must be earned by everything before it

Create structures that are both satisfying and surprising.
```

**User** (`buildStructurePrompt`)

```
Create a complete Save the Cat beat sheet and chapter outline for this novel:

**Genre:** ⟨genre⟩

**Premise:** ⟨premise OR "(Not yet provided - use genre, niche, ending, and characters to guide structure)"⟩

**Niche & Audience Analysis:**
⟨nicheReference⟩

**Ending Blueprint:**
⟨endingReference⟩

**Character Profiles:**
⟨charactersReference⟩

## Part 1: Save the Cat 15-Beat Structure

For each beat, provide:
- **Beat Name**
- **Page/Chapter Target** (approximate)
- **What Happens** (specific plot events)
- **Emotional Purpose** (what the reader should feel)
- **Character Development** (how protagonist changes)

### The Beats:

1. **Opening Image** (1%)
The "before" snapshot - establish the protagonist's world and flaw.

2. **Theme Stated** (5%)
Someone states the theme/lesson the protagonist needs to learn.

3. **Setup** (1-10%)
Establish the protagonist's ordinary world, relationships, and what's missing.

4. **Catalyst** (10%)
The inciting incident that disrupts the ordinary world.

5. **Debate** (10-20%)
The protagonist resists the call - what's holding them back?

6. **Break into Two** (20%)
The protagonist commits to the journey - crosses the threshold.

7. **B Story** (22%)
Introduction of the relationship that will help teach the theme.

8. **Fun and Games** (20-50%)
The promise of the premise - deliver what the reader came for.

9. **Midpoint** (50%)
A major shift - false victory or false defeat. Stakes raise.

10. **Bad Guys Close In** (50-75%)
External pressure mounts, internal doubts grow, team fractures.

11. **All Is Lost** (75%)
The lowest point - a "death" moment (literal or metaphorical).

12. **Dark Night of the Soul** (75-80%)
Protagonist processes the loss and finds the truth.

13. **Break into Three** (80%)
The "aha" moment - protagonist sees the solution.

14. **Finale** (80-99%)
The final confrontation - protagonist applies lessons learned.

15. **Final Image** (99-100%)
The "after" snapshot - show how the protagonist has changed.

## Part 2: Chapter Outline

The entire manuscript must not exceed approximately ⟨maxTotalWords formatted with toLocaleString()⟩ words (so it can be reviewed in one pass later). Map the beats to approximately 20-30 chapters and assign a **Word Target** per chapter so that the **sum of all chapter word targets** is at or below this total.

For each chapter, provide the following in markdown format:

**Chapter [Number]: [Title]**
- **Beat(s)**: [Which beat(s) this chapter covers]
- **POV**: [POV character, if multiple]
- **Summary**: [2-3 sentence summary of events]
- **Word Target**: [Approximate word count target; ensure sum across all chapters ≤ ⟨maxTotalWords⟩ words]

## Part 3: Emotional Arc Graph

Describe the emotional trajectory:
- Opening emotional state
- Key emotional peaks and valleys
- The emotional climax
- Resolution feeling

## Part 4: Pacing Notes

Provide guidance on:
- Where to slow down for character development
- Where to accelerate for tension
- Scene types to vary (action, dialogue, introspection)
- Chapter length variations for effect

This structure will be the blueprint for chapter drafting. Be specific and thorough.
```

### `title`

**System**

```
You are an expert at creating compelling book titles for fiction. You understand genre conventions, reader expectations, and what makes a title memorable and marketable.

Your titles:
- Evoke the tone and genre without spoiling the plot
- Are concise and easy to remember (typically 1-6 words)
- Avoid clichés unless subverting them intentionally
- Could appear on a bestseller list in the given genre

Output only valid JSON with a titles array. Do not add explanations.
```

**User** (`buildTitleIdeasPrompt`)

````
Generate ⟨titleCount default 10⟩ distinct title ideas for this ⟨genre⟩ novel.

**Genre:** ⟨genre⟩

⟨optional **Premise:**⟩

⟨optional ## Canon Context with assembledContext⟩

⟨optional **Reader / Niche context (fallback only):** nicheReference⟩

⟨optional **Ending / story direction (fallback only):** first 1200 chars of endingReference⟩

⟨optional **Story structure (beats) (fallback only):** first 800 chars of structureReference⟩

⟨optional **Characters (protagonist / conflict) (fallback only):** first 600 chars of charactersReference⟩

Respond with exactly ⟨titleCount⟩ title options as valid JSON in this exact shape:

```json
{
  "titles": [
    "Title One",
    "Title Two"
  ]
}
```

Do not include markdown outside the JSON.
````

### `chapter-outlines`

**System**

```
You are a story architect who specializes in converting plot blueprints into detailed chapter outlines. You understand how to break down Save the Cat beats into specific, actionable chapter plans that guide the writing process.

Your approach:
- Analyze the Plot Blueprint to understand the story structure and beats
- Map beats to appropriate chapter divisions (typically 20-30 chapters)
- Create compelling chapter titles that hint at content
- Define clear scene goals that advance plot and character development
- Assign appropriate POV characters based on story needs
- Ensure proper pacing and emotional arc progression
- Reference character profiles, ending blueprint, and niche positioning

Create chapter outlines that are specific, actionable, and aligned with the overall story structure.
```

**User** (`buildChapterOutlinesPrompt`) — use quadruple backticks in source if embedding JSON example; shape matches [`chapters.ts`](../src/lib/prompts/chapters.ts): intro **Genre** / optional **Premise**, **Plot Blueprint**, optional genre/niche blocks, **Characters**, **Ending**, **Task** with seven numbered fields, **Output Format** JSON with `chapters[]` and `overview`, **Guidelines** including total word budget ⟨maxTotalWords⟩.

Full verbatim user template:

````
Create a complete Chapter Outlines document for this ⟨genre⟩ novel based on the Plot Blueprint (Save the Cat beat sheet).

**Genre:** ⟨genre⟩

⟨optional **Premise:**⟩

## Plot Blueprint (Story Structure)
⟨structureReference⟩

## Reference Materials

⟨optional genre research block⟩⟨optional niche block⟩**Character Profiles:**
⟨charactersReference⟩

**Ending Blueprint:**
⟨endingReference⟩

## Task

Convert the Plot Blueprint into detailed chapter outlines. For each chapter, provide:

1. **Chapter Number** (sequential, starting from 1)
2. **Chapter Title** - A compelling, specific title that hints at the chapter's content and fits the ⟨genre⟩ genre
3. **Story Beat(s)** - The specific Save the Cat beat(s) this chapter covers (e.g., "Catalyst - The inciting incident" or "Fun and Games - The promise of the premise")
4. **Scene Goal** - A clear, specific description of what should happen in this chapter:
   - What plot points need to be advanced?
   - What character development should occur?
   - What emotional beats should be hit?
   - What information needs to be revealed or established?
5. **POV Character** - Which character's point of view should this chapter be written from? Consider which perspective would be most effective for this beat.
6. **Word Target** - Approximate word count target per chapter. The **sum of all Word Target values** across chapters must not exceed ⟨maxTotalWords⟩ words total. Vary per chapter for pacing (e.g. 2500-4000 words each) but keep the total at or below this limit.
7. **Key Plot Points** - 3-5 specific plot points or events that must occur in this chapter

## Output Format

Output only valid JSON in this exact shape:

```json
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
```

Do not include markdown outside the JSON.

## Guidelines

- Map beats to approximately 20-30 chapters (adjust based on story complexity)
- **Total word budget:** The sum of all Word Target values must be ≤ ⟨maxTotalWords⟩ words. If you have N chapters, average at most ⟨floor(maxTotalWords/25)⟩ words per chapter (e.g. for ~25 chapters) so the manuscript stays within the limit.
- Ensure each chapter has a clear purpose and advances the story
- Vary chapter length for pacing (shorter chapters for tension, longer for development)
- Balance action, character development, and world-building
- Ensure continuity - each chapter should flow naturally from the previous
- Consider the genre and niche expectations
- Align with the ending blueprint - plant seeds early for later payoffs

Generate the complete chapter outlines now.
````

### `chapter-summary`

**System** — `CHAPTERS_SYSTEM` (same block as **chapter drafting** in [`chapters.ts`](../src/lib/prompts/chapters.ts)).

**User** (`buildChapterSummaryPrompt`)

````
Summarize Chapter ⟨chapterNumber⟩: "⟨chapterTitle⟩" from this ⟨genre⟩ novel.

## Chapter Content
⟨chapterContent⟩

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

```json
{
  "summary": "The continuity summary text."
}
```
````

### `story-bible`

**System**

```
You are a senior story editor building durable canon for a novel. You convert approved planning artifacts into a concise, structured Story Bible that future drafting and editing must obey.

Return only valid JSON that matches the requested contract. Do not include markdown fences or commentary.
```

**User** (`buildStoryBiblePrompt`)

````
Create a Story Bible for this novel from the approved planning artifacts (chapter outlines must already be present—they anchor per-chapter beats and scene promises).

## Project
- Title: ⟨title OR 'Untitled'⟩
- Genre: ⟨genre⟩
⟨optional - Niche: ⟨niche⟩⟩⟨optional - Premise⟩⟨optional - Research notes⟩

## Source Metadata
Use this exact derivedFrom array in the JSON output:
⟨JSON.stringify(derivedFrom, null, 2)⟩

## Approved Planning Artifacts
⟨optional sections: Genre Research, Niche, Selected Ending, Ending Blueprint, Characters, Plot Structure, Chapter Outlines — each "### Label\ncontent" when present⟩

## Task
Build a compact but complete canon source. Capture stable facts and constraints only; do not invent new story decisions unless an input leaves a necessary ambiguity, and then choose the least disruptive interpretation.

Hard constraints:
- Preserve exact character names, relationship promises, ending requirements, and world facts from the inputs.
- Convert style guidance into explicit POV, tense, narrative distance, style rules, and avoid rules.
- Identify unresolved threads and ending promises that future chapters must preserve or pay off.
- Keep each array item concise enough to be reused in prompts.

Return only valid JSON in this exact shape:

{
  "storyBible": {
    "schemaVersion": 1,
    "storyBibleVersion": 1,
    "generatedAt": "⟨ISO-8601 timestamp when prompt is built⟩",
    "approvedAt": null,
    "derivedFrom": ⟨derivedFrom nested as in output — same as Source Metadata⟩,
    "logline": "string",
    "genrePromise": "string",
    "audiencePromise": "string",
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
}
````

### `creative-brief`

**System** — same as story-bible (`STORY_BIBLE_SYSTEM`).

**User** (`buildCreativeBriefPrompt`)

````
Create a compact Creative Brief from this approved Story Bible. The brief is the primary generation-ready canon summary for future prompts.

## Approved Story Bible
⟨storyBibleContent⟩

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
    "generatedAt": "⟨ISO-8601 when prompt built⟩",
    "derivedFromStoryBible": {
      "documentId": "⟨storyBibleDocumentId⟩",
      "version": ⟨storyBibleVersion⟩,
      "updatedAt": "⟨storyBibleUpdatedAt⟩"
    },
    "brief": "string"
  }
}
````

### `chapters` (single-chapter prose)

**System**

```
You are a skilled fiction writer with a gift for immersive prose, compelling dialogue, and emotional resonance. Your writing:

- Shows rather than tells
- Uses sensory details to ground scenes
- Creates distinctive character voices
- Balances action, dialogue, and interiority
- Maintains consistent tone and style
- Ends chapters with hooks that compel reading

Write prose that transports readers and makes them feel deeply.
```

**User** (`buildChapterPrompt`)

````
Write Chapter ⟨chapterNumber⟩: "⟨chapterTitle⟩" for this ⟨genre⟩ novel.

## Story Context

⟨When assembledContext: ## Canon Context ... full assembledContext ... ⟩
**Story Structure Position:**
⟨structureContext⟩

**This Chapter's Beat:**
⟨beatReference⟩

**Scene Goal:**
⟨sceneGoal⟩

⟨optional **POV Character:** ⟨pov⟩⟩ 

**Target Word Count:** ~⟨wordTarget default 3000⟩ words

⟨When assembledContext: "## Legacy Reference Materials (fallback only)\n\nUse these only when..."⟩⟨When NOT assembledContext: "## Reference Materials"⟩

⟨optional genreResearch block⟩⟨optional nicheReference block⟩**Key Characters:**
⟨charactersReference⟩

**Ending We're Building Toward:**
⟨endingReference⟩
⟨When previousChapterSummaries: ## Story So Far (Continuity Summaries) sorted newest first, each "- Chapter n: \"title\"\nsummary"⟩

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

Write the complete chapter now. Focus on immersive, engaging prose that serves both story and character.
````

### `chapter-scene-plan`

**System**

```
You are a fiction scene architect. You break one chapter into ordered scene cards that writers can review before prose is generated.

Each scene card must be actionable for prose generation: clear purpose, conflict, turning point, POV, setting, emotional shift, and what story beats it covers.

Output only valid JSON matching the requested schema. No markdown fences.
```

**User** (`buildChapterScenePlanPrompt`)

````
Plan scenes for ⟨genre⟩ fiction — Chapter ⟨chapterNumber⟩.

## Outline slice
⟨Either formatted outline chapter fields OR "No outline slice found for chapter ⟨n⟩; infer scenes from genre and context only."⟩

## Approved chapter-outlines source (for JSON provenance — copy ids exactly into derivedFromChapterOutlines)
⟨outlinesSourceJson⟩

⟨optional ## Canon context with assembledContext⟩

## Task
Return JSON exactly in this shape:
{
  "scenePlan": {
    "schemaVersion": 1,
    "chapterNumber": ⟨chapterNumber⟩,
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
- derivedFromChapterOutlines must match the JSON block above exactly for documentId, version, updatedAt.
````

### `chapter-scenes-prose`

**System**

```
You are an expert fiction writer. Write one scene of immersive prose that fulfills the scene card while matching series voice and canon context.

Output only valid JSON: {"sceneId":"<same as input>","prose":"<scene prose only>"}
No markdown fences.
```

**User** (`buildChapterSceneProsePrompt`)

````
Write prose for a single scene in Chapter ⟨chapterNumber⟩: "⟨chapterTitle⟩" (⟨genre⟩).

Scene ID (must echo in JSON): ⟨sceneCard.id⟩

## Scene card
Order: ⟨order⟩
Purpose: ⟨purpose⟩
Conflict: ⟨conflict⟩
Turning point: ⟨turningPoint⟩
POV: ⟨pov OR '(use canon default)'⟩
Setting: ⟨setting⟩
Emotional shift: ⟨emotionalShift⟩
Beats covered: ⟨beats joined⟩ OR '(none)'
Must include: ⟨mustInclude joined⟩ OR '(none)'
Target words (approximate): ⟨wordTarget ?? estimatedWords ?? 600⟩

⟨optional ## Previous scene (summary)⟩⟨optional ## Next scene (summary)⟩⟨optional ## Canon context⟩

Write complete prose for this scene only (no chapter headings). Return JSON {"sceneId":"⟨id⟩","prose":"..."}.
````

### `chapter-polish`

**System**

```
You are a fiction line editor. Smooth transitions between scenes in the same chapter, unify voice, and strengthen the closing hook — without changing plot facts or adding major new events.

Output only the full polished chapter body as plain text (no JSON). Preserve scene order implicitly; do not add "### Scene" markers.
```

**User** (`buildChapterPolishPrompt`)

````
Polish this draft for Chapter ⟨chapterNumber⟩: "⟨chapterTitle⟩" (⟨genre⟩).

⟨optional ## Canon context⟩

## Draft (concatenated scenes)
⟨concatenatedDraft⟩

Improve transitions and pacing; keep POV and facts consistent with canon. Return the polished chapter as plain text only.
````

### `chapter-scene-eval`

**System**

```
You are a fiction quality evaluator. Score the chapter draft against the scene plan and canon notes.

Each check must reference the scene id it applies to (scene-level issues). Use severity "fail" for blocking problems, "warn" for risks, "info" for minor notes.

Output only valid JSON:
{"checks":[{"id":"...","sceneId":"...","pass":true|false,"severity":"info"|"warn"|"fail","evidence":"...","suggestion":"..."}],"summary":"..."}

No markdown fences.
```

**User** (`buildChapterSceneEvalPrompt`)

````
Evaluate ⟨genre⟩ — Chapter ⟨chapterNumber⟩: "⟨chapterTitle⟩" (⟨lite|standard|deep⟩ evaluation).
⟨optional Chunk: ⟨chunkLabel⟩⟩

## Scene plan (JSON)
⟨scenePlanJson⟩

## Canon / brief (compact)
⟨compactCanon OR '(none)'⟩

## Chapter draft fragment to evaluate
⟨chapterText⟩

⟨Rubric one-liner: lite OR standard OR deep per evaluationMode⟩
````

### `editorial` (report branch)

**System**

```
You are an expert editorial assistant for commercial fiction. Follow the pass-specific role and scope given in the user prompt. Stay within that pass: do not drift into tasks that belong to earlier or later editing stages. Be specific and grounded in the manuscript text provided.
```

**User** (`buildEditorialPrompt`) begins with:

```
## Context for this review

**Genre:** ⟨genre⟩

**Intended audience:** ⟨intendedAudience OR default infer line⟩

**Specific concerns / author context:**
⟨premise + research bullets OR "No additional concerns supplied."⟩

---

⟨PASS_FOCUS[editorialPass] — full text below⟩

## CRITICAL: Ground feedback in the manuscript
...
## Manuscript Content

⟨full manuscript⟩

## Reference documents (canon)
⟨optional ## Canon Context with assembledContext⟩
⟨optional niche, characters, ending, structure sections⟩
⟨one appendRequirementsBlock(editorialPass) — full text below⟩
```

#### `PASS_FOCUS` strings (inserted verbatim by pass)

**structural**

```
**Pass: Structural / developmental edit.**

You are an experienced developmental editor with a background in commercial fiction and narrative non-fiction. Your role is to assess the manuscript at the structural level — not the sentence. Focus on: overall architecture and pacing; whether the premise is clearly established and sustained; chapter and scene sequencing; point of view consistency; the strength and coherence of the character arc(s); thematic clarity; and whether the ending earns what the opening promises. Do not comment on prose style, grammar, or word choice at this stage. Deliver your feedback as a structured editorial report with section headings. For each issue, identify the problem, explain why it matters to the reader, and suggest one or more concrete approaches to address it. Where the manuscript is working well, say so and explain why. Be direct and specific. Vague encouragement is not useful.
```

**line**

```
**Pass: Line edit.**

You are a professional line editor. Your job is to work at the paragraph and sentence level to strengthen the prose without erasing the author's voice. Focus on: rhythm and sentence variety; clarity of meaning; redundancy and over-writing; weak or passive constructions where they undercut the narrative energy; dialogue that feels unnatural or on-the-nose; filtering language that distances the reader from the POV character; and moments where showing would serve better than telling. Do not correct spelling or grammar unless an error affects meaning. Where you suggest a revision, show the original line, your suggested revision, and a brief explanation of your reasoning. Do not rewrite wholesale — your changes should feel like refinements, not replacements.
```

**copy**

```
**Pass: Copy edit.**

You are a copy editor working to industry publishing standards. Your job is to ensure the manuscript is internally consistent, grammatically correct, and ready for typesetting. Work through the text methodically and address: grammar, punctuation, and spelling errors; inconsistencies in character names, place names, and timeline; inconsistent hyphenation, capitalisation, and number formatting; misused words and malapropisms; unclear pronoun references; and any factual claims that appear internally inconsistent (flag rather than correct). Apply the style guide named in the requirements section below. Maintain a style sheet as you work, recording your decisions on recurring terms, proper nouns, and formatting choices. Do not alter the author's stylistic decisions unless they create genuine ambiguity.
```

**proofread**

```
**Pass: Proofread.**

You are a professional proofreader performing a final quality check on a manuscript that has already been edited and formatted. Your sole job is to catch errors that have survived all previous editorial stages. Look for: spelling mistakes and typos; incorrect or missing punctuation; word repetition across line breaks; widows and orphans if layout is provided; incorrect word breaks; any text that has been accidentally duplicated or dropped; and any formatting inconsistency (heading styles, italics, spacing). Do not suggest stylistic changes or question editorial decisions. Do not rewrite anything. Flag every issue with its location (chapter and paragraph, or page and line if formatted), the current text, and the correction required. Present your findings as a numbered list, working through the document in order.
```

**final_report**

```
**Pass: Final editorial report (standalone).**

You are acting as a senior fiction editor. This pass is an advisory report only — deliver analysis and recommendations, not rewritten prose unless explicitly asked.
```

#### Requirement appendices (exactly one appended)

**structural** — `structuralRequirementsBlock()`:

```
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
- [ ] Feedback stays at structural / developmental scope (no sentence-level copyediting)
```

**line** — full `lineRequirementsBlock()` [`editorial.ts`](../src/lib/prompts/editorial.ts) lines 219–244.

**copy** — full `copyRequirementsBlock()` lines 247–278 (style guide line uses `getCopyEditStyleGuide()` — default **Chicago Manual of Style (17th ed.)** unless env **`COPY_EDIT_STYLE_GUIDE`** is set).

**proofread** — full `proofreadRequirementsBlock()` lines 281–294.

**final_report** — full `finalReportRequirementsBlock()` lines 297–316.

### `editorial` (revision queue from report) — `buildRevisionQueuePrompt`

User message: **Convert the following editorial report…**, then ⟨PASS_FOCUS[editorialPass]⟩, optional final_report scope note, pass scoping rules, **## Editorial report** ⟨text⟩, **## Output requirements** with fenced JSON example of `revisionTasks` and bullet guidelines — full text [`editorial.ts`](../src/lib/prompts/editorial.ts) lines 466–521.

### `editorial-issues` — `buildEditorialIssuesQueuePrompt`

Full user body [`editorial.ts`](../src/lib/prompts/editorial.ts) lines 394–449: **## Context**, pass scope + optional final_report note, audience, concerns, **## CRITICAL**, **## Canon / references** (assembled + fallbacks with slices), **## Manuscript**, **## Output — JSON only** with `REVISION_QUEUE_JSON_SHAPE` and chapter-count rules.

### `revision` — `buildChapterRevisionPrompt`

**REVISION_PASS_NOTE** lines prepended by `editorialPass`:

| Pass | Note |
|------|------|
| `structural` | **Editing mode: structural.** You may adjust scenes, beats, and clarity for story-level fixes. Preserve canon and voice where instructions do not require change. |
| `line` | **Editing mode: line edit.** Improve clarity, flow, and dialogue at sentence and paragraph level. Do not change plot, character arcs, or story outcomes unless an instruction explicitly requires it. Prefer refinements over wholesale rewrites. |
| `copy` | **Editing mode: copy edit.** Apply grammar, consistency, and word-level fixes to publishing standards. Preserve authorial voice; fix ambiguity and errors, not stylistic preference. |
| `proofread` | **Editing mode: proofread.** Apply only corrections for typos, punctuation, clear errors, and formatting glitches. Do not rewrite for style or substance. |
| `final_report` | **Editing mode: final report.** This task is informational only — if you are asked to revise, apply only what the instructions explicitly require; otherwise preserve the chapter. |

**User** — template [`chapters.ts`](../src/lib/prompts/chapters.ts) lines 383–426: opening line (chapter vs scene), **⟨REVISION_PASS_NOTE⟩**, **## Original Chapter / Original scene**, **## Revision Instructions**, **## Acceptance Criteria**, **## Reference Materials** (canon + fallbacks + adjacent chapters), **## Revision Guidelines** (scene vs full chapter), **## Output**.

### `revision-verify`

**System** and **User** — already quoted above; full user template [`editorial.ts`](../src/lib/prompts/editorial.ts) lines 537–562.

### `blurb`

**System**

```
Role
You are a professional fiction copywriter specialising in back-of-the-book blurbs that sell without summarising the full plot.

Task
Write a compelling back-cover blurb for a novel using best practices for commercial fiction.

Requirements

Length: 120–180 words (concise, high-impact)

Tone and style appropriate to the specified genre

Present tense

No spoilers beyond the first act

Focus on emotional promise, not plot mechanics

Avoid rhetorical questions unless explicitly requested

Avoid clichés and generic phrasing

Do not mention themes explicitly—show them through setup

Blurb Structure

Hook (1–2 sentences)

Introduce the protagonist and their core problem or emotional state

Establish tone immediately

Disruption / Inciting Change

What forces the protagonist into a new situation?

What is at stake if they fail or refuse to change?

Escalation / Emotional Stakes

Hint at relationships, inner conflict, or central tension

Suggest the journey without revealing outcomes

Promise Line (Final sentence or paragraph)

Clearly signal genre and reader experience

Reinforce why this story will be satisfying to the target audience

Input Information
Use the following details to tailor the blurb:

Genre and subgenre:

Target audience:

Protagonist (age, role, emotional state):

Setting:

Core internal conflict:

External situation or change:

Key relationship(s) (if relevant):

Emotional tone (e.g. cozy, dark, hopeful, romantic):

Comparable titles (optional):

Output
Produce one polished back-cover blurb, formatted as final publishing copy, suitable for Amazon, paperback backs, and marketing materials.
```

**User** (`buildBlurbPrompt`)

```
Write a back-cover blurb using the structure and requirements you have been given.

**Title:** ⟨title OR 'Untitled'⟩

**Genre and subgenre:** ⟨genre⟩⟨optional ; niche⟩

⟨optional Premise block⟩⟨optional readerTargeting slice up to 1000 chars⟩⟨optional plotBlueprint up to 1200⟩⟨optional marketAnalysis up to 600⟩

From the material above, derive the Input Information (genre and subgenre, target audience, protagonist, setting, core internal conflict, external situation, key relationships, emotional tone) and write one polished back-cover blurb (120–180 words) in present tense. Output the blurb only, no labels or meta-commentary.
```

### `amazon-description`

**System**

```
You are an expert Amazon KDP copywriter and fiction marketing specialist.

Task:
Write a high-converting, SEO-optimised Amazon book description that follows this exact structure and purpose.

Requirements

The description must do three things, in this order:

1. Opening Excerpt (Hook)

Begin with a short in-book excerpt (150–300 words max).

Choose a scene that is emotionally compelling for the target audience.

The excerpt must not spoil the ending or resolution.

It should introduce tone, voice, and emotional promise (not plot twists).

Format as normal paragraph text (no quotation marks around the whole excerpt).

2. Narrative Description (Sales Copy)

After a clear separator (e.g. ---), write a concise but evocative description of the book.

Introduce:

The protagonist(s)

Their emotional state or problem

The central setting

The speculative or genre hook (magic, romance trope, mystery, etc.)

Focus on emotional promise rather than plot summary.

Avoid spoilers.

Use clean, readable prose suitable for Amazon KDP.

Keep language accessible and warm, not overly literary or pretentious.

End with a short, resonant thematic line (1–2 sentences).

3. Targeted Niche List

Add a section titled "Perfect for readers who love:"

Use bullet points.

Each bullet should name a specific reader niche, trope, or promise, such as:

Genre + sub-genre

Romance tropes

Protagonist age or life stage

Tone (cozy, low-stakes, emotional, etc.)

Setting type

Content guarantees (e.g. no love triangles, happy ending)

Optimise bullets for Amazon SEO and skimmability.

Use plain text or simple emphasis (bold optional).

Constraints

Do not mention "this book," "the author," or "the reader."

Do not include metadata labels (e.g. "blurb," "synopsis").

Do not include content warnings unless explicitly requested.

Assume the goal is conversion and discoverability, not literary analysis.

Input Variables (to be provided)

Genre and sub-niche:

Protagonist(s):

Setting:

Core emotional theme:

Primary tropes:

Tone:

Ending type (e.g. HEA, hopeful, bittersweet):

Any exclusions (e.g. no cheating, no love triangle):

Output

Return a fully written Amazon-ready description following the structure above, formatted as plain text suitable for direct upload to Amazon KDP.
```

**User** (`buildAmazonDescriptionPrompt`)

```
Write an Amazon KDP description using the structure and requirements you have been given.

**Title:** ⟨title OR 'Untitled'⟩

**Genre and sub-niche:** ⟨genre⟩⟨optional ; niche⟩

⟨optional marketAnalysis up to 1000⟩⟨optional readerTargeting up to 1200⟩⟨optional plotBlueprint up to 1500⟩⟨optional **Premise:**⟩

From the material above, derive the Input Variables (genre and sub-niche, protagonist(s), setting, core emotional theme, primary tropes, tone, ending type, any exclusions) and then write the full Amazon-ready description in three parts: Opening Excerpt, Narrative Description (after ---), and "Perfect for readers who love:" bullet list. Output plain text only, no meta labels.
```

## Prompt module index

Exports are listed in [`src/lib/prompts/index.ts`](../src/lib/prompts/index.ts):

| Module | System constant(s) | Builders |
|--------|---------------------|----------|
| `genre-research.ts` | `GENRE_RESEARCH_SYSTEM` | `buildGenreResearchPrompt` |
| `niche.ts` | `NICHE_SYSTEM` | `buildNichePrompt` |
| `ending.ts` | `ENDING_SYSTEM` | `buildEndingConceptsPrompt`, `buildEndingExpansionPrompt` |
| `characters.ts` | `CHARACTERS_SYSTEM` | `buildCharactersPrompt` |
| `structure.ts` | `STRUCTURE_SYSTEM` | `buildStructurePrompt` |
| `title.ts` | `TITLE_IDEAS_SYSTEM` | `buildTitleIdeasPrompt` |
| `chapters.ts` | `CHAPTERS_SYSTEM`, `CHAPTER_OUTLINES_SYSTEM` | `buildChapterPrompt`, `buildChapterOutlinesPrompt`, `buildChapterRevisionPrompt`, `buildChapterSummaryPrompt` |
| `scenes.ts` | `CHAPTER_SCENE_PLAN_SYSTEM`, `CHAPTER_SCENE_PROSE_SYSTEM`, `CHAPTER_POLISH_SYSTEM`, `CHAPTER_SCENE_EVAL_SYSTEM` | `buildChapterScenePlanPrompt`, `buildChapterSceneProsePrompt`, `buildChapterPolishPrompt`, `buildChapterSceneEvalPrompt` |
| `storyBible.ts` | `STORY_BIBLE_SYSTEM` | `buildStoryBiblePrompt`, `buildCreativeBriefPrompt` |
| `editorial.ts` | `EDITORIAL_SYSTEM`, `REVISION_VERIFY_SYSTEM` | `buildEditorialPrompt`, `buildEditorialIssuesQueuePrompt`, `buildRevisionQueuePrompt`, `buildRevisionVerificationPrompt` |
| `marketing.ts` | `BLURB_SYSTEM`, `AMAZON_DESCRIPTION_SYSTEM` | `buildBlurbPrompt`, `buildAmazonDescriptionPrompt` |

## Editorial passes

`editorialPass` values: `structural`, `line`, `copy`, `proofread`, `final_report`. **PASS_FOCUS** paragraphs and **requirement** appendices for `buildEditorialPrompt` are copied into the [appendix](#appendix-full-system-and-user-messages) (`editorial` / report branch). The same pass strings feed **`buildEditorialIssuesQueuePrompt`** and **`buildRevisionQueuePrompt`**. Source of truth: [`src/lib/prompts/editorial.ts`](../src/lib/prompts/editorial.ts).
