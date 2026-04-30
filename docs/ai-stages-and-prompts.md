# AI stages and prompts

This document describes what the app sends to the language model for each workflow stage that uses generation: **system message** (role and rules) and **user message** (task-specific prompt body).

**Last verified against:** [`src/app/api/generate/route.ts`](../src/app/api/generate/route.ts) and [`src/lib/prompts/`](../src/lib/prompts/). Update this doc when those change.

## API surface

`POST /api/generate` accepts a JSON body:

| Field | Description |
|--------|-------------|
| `stage` | One of the workflow stages listed below that this route handles |
| `data` | Record of string keys to arbitrary values; each stage reads specific keys (see tables) |
| `model` | Optional model ID; must exist in the app’s model catalog |

The handler builds `systemPrompt` and `prompt` (user), then calls `generateForStage` in [`src/lib/llm/router.ts`](../src/lib/llm/router.ts), which routes to OpenAI, Anthropic, or OpenRouter.

Additional behavior:

- `data.temperature` is passed through when present.
- When the route selects a **structured output kind** for the stage (see `getStructuredOutputKind` in the route), the LLM call uses **JSON mode** (`jsonMode: true`). That includes `editorial` with `createQueue === true`, and the per-chapter scene pipeline stages: `chapter-scene-plan`, `chapter-scenes-prose`, and `chapter-scene-eval`. If the returned JSON fails schema validation, the route runs a **repair** pass (second call, JSON-only repair system prompt).
- Editorial generation may switch models when the manuscript exceeds context limits (see route logic).
- `chapter-scene-eval` may use a higher **max output token** cap than other stages (see `CHAPTER_SCENE_EVAL_OUTPUT_TOKEN_BUDGET` in the route).

## Stages not handled by this route

The Zod schema allows these `stage` values in the union, but **only** stages wired in `SIMPLE_STAGE_HANDLERS` or the `switch` succeed. Posting any other allowed value hits the default branch and returns **400 Invalid stage**.

In practice, these workflow stages do **not** use `/api/generate` for LLM calls:

- `setup`
- `compilation`
- `export-draft`
- `export-final`

(They are part of the overall pipeline but are not implemented in the generate route’s handler map.)

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
    Ch [chapters legacy]
    CSP [chapter-scene-plan]
    CSPW [chapter-scenes-prose]
    CP [chapter-polish]
  end
  subgraph edit [Edit]
    Ed [editorial]
    R [revision]
  end
  subgraph market [Marketing]
    B [blurb]
    AMZ [amazon-description]
  end
  GR --> N --> E --> C --> S --> T --> CO --> Ch --> Ed --> R --> B --> AMZ
  CO -. optional scene pipeline .-> CSP --> CSPW --> CP
```

After approved outlines, the chapter UI may either generate with **`chapters`** (single pass) or run the scene pipeline: **`chapter-scene-plan`** (stored document per chapter) → **`chapter-scenes-prose`** (per scene JSON) → optional **`chapter-polish`** → client merges deterministic checks plus chunked **`chapter-scene-eval`** calls with merged rubric output.


## Stage reference

For each stage: **system** constant (file), **user** builder, and **`data` keys** read in the route (from [`route.ts`](../src/app/api/generate/route.ts)).

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

- If `data.selectedEnding` is set → **expansion** prompt: `premise`, `genre`, `nicheReference`, `selectedEnding`.
- Else → **concepts** prompt: `premise`, `genre`, `nicheReference`.

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
| **`data`** | `genre`, `premise` (optional), `nicheReference` (optional), `structureReference` (optional), `endingReference` (optional), `charactersReference` (optional) |

### `chapter-outlines`

| | |
|---|---|
| **System** | `CHAPTER_OUTLINES_SYSTEM` — [`src/lib/prompts/chapters.ts`](../src/lib/prompts/chapters.ts) |
| **User** | `buildChapterOutlinesPrompt` with `maxTotalWords` from `TARGET_MANUSCRIPT_WORDS` |
| **`data`** | `genre`, `premise` (optional), `structureReference`, `charactersReference`, `endingReference`, `genreResearch` (optional), `nicheReference` (optional) |

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
| **`data`** | `genre`, `chapterNumber`, `chapterTitle`, `scenePlanJson`, `chapterText` (chunk of prose), `compactCanon` (assembled evaluation canon text), `chunkLabel` (optional; scene ids in chunk for logging/traceability) |
| **Output** | Structured JSON evaluation (`checks` with required `sceneId`, severities `info` \| `warn` \| `fail`). The app may call this stage multiple times for disjoint prose chunks and **merge** results with deterministic checks in [`src/lib/chapter/evaluator.ts`](../src/lib/chapter/evaluator.ts). |

### `editorial`

| | |
|---|---|
| **System** | `EDITORIAL_SYSTEM` — [`src/lib/prompts/editorial.ts`](../src/lib/prompts/editorial.ts) |
| **User** | `buildEditorialPrompt` **or** `buildRevisionQueuePrompt` |

**Branch A — revision queue (`data.createQueue` truthy):**

- **User** | `buildRevisionQueuePrompt`: `editorialReport`, `chapterCount`, `editorialPass` (parsed; default structural).
- **JSON mode** enabled on the LLM call.

**Branch B — editorial report (default):**

- Requires non-empty `data.manuscript`.
- **User** | `buildEditorialPrompt`: `manuscript`, `genre`, optional `nicheReference`, `charactersReference`, `endingReference`, `structureReference`, `editorialPass`, optional `intendedAudience`, `premise`, `research`.
- Pass-specific instructions come from `PASS_FOCUS` and requirement blocks in [`editorial.ts`](../src/lib/prompts/editorial.ts) (`structural`, `line`, `copy`, `proofread`, `final_report`).

Model selection and manuscript size checks (including automatic fallback model) are implemented in the route.

### `revision`

| | |
|---|---|
| **System** | `CHAPTERS_SYSTEM` (same as chapter drafting) — [`src/lib/prompts/chapters.ts`](../src/lib/prompts/chapters.ts) |
| **User** | `buildChapterRevisionPrompt` |
| **`data`** | `originalContent` (required), `revisionInstructions`, `acceptanceCriteria` (array), `assembledContext` (optional), `charactersReference`, `endingReference`, `structureReference` (optional), `nicheReference` (optional), `previousChapterContext` / `nextChapterContext` (optional), `editorialPass` (optional; affects pass note text via `REVISION_PASS_NOTE`), `sceneRevisionSceneId` (optional; when set, prompt framing restricts revision to that scene segment — used by evaluation “Apply fix”) |

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
| **`data`** | Same shape as blurb: `genre`, `niche`, `title`, `premise`, `marketAnalysis`, `readerTargeting`, `plotBlueprint` (all optional except as required by the builder’s logic) |

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
| `editorial.ts` | `EDITORIAL_SYSTEM` | `buildEditorialPrompt`, `buildRevisionQueuePrompt` |
| `marketing.ts` | `BLURB_SYSTEM`, `AMAZON_DESCRIPTION_SYSTEM` | `buildBlurbPrompt`, `buildAmazonDescriptionPrompt` |

## Editorial passes

Editorial behavior for both `buildEditorialPrompt` and `buildRevisionQueuePrompt` is keyed by `editorialPass`: `structural`, `line`, `copy`, `proofread`, `final_report`. Definitions live in `PASS_FOCUS` and related requirement blocks in [`src/lib/prompts/editorial.ts`](../src/lib/prompts/editorial.ts).
