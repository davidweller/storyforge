# Claude Model & Effort Recommendations by Stage

**App:** StoryForge  
**Last updated:** 2026-05-02  
**Model strings used:** `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`

> **Note:** These are recommendations for the Anthropic model catalog only. The app currently defaults all stages to `qwen-3.6-thinking-openrouter` via `STAGE_DEFAULT_PROVIDERS`. Override per stage using the `model` field in `/api/generate` or the UI model selector.

---

## Prose generation - highest quality needed

| Stage | Model | Effort | Rationale |
|---|---|---|---|
| `chapters` (single-pass) | Opus 4.7 | xHigh | The core creative output. Opus 4.7's long-horizon coherence improvements are directly relevant; xHigh is warranted for the primary product artifact. |
| `chapter-scenes-prose` | Opus 4.7 | High | Per-scene prose is still primary artifact material. Bounded per scene so xHigh is not needed; High gives full reasoning depth. |
| `chapter-polish` | Opus 4.7 | Medium | Line-level smoothing over stitched scenes. Low-effort Opus 4.7 ≈ medium-effort Opus 4.6, so Medium is the right ceiling here. |
| `revision` | Opus 4.7 | Medium | Surgical edits to existing prose. Bounded task; same effort-efficiency logic as polish. |

---

## Editorial and evaluation - depth over creativity

| Stage | Model | Effort | Rationale |
|---|---|---|---|
| `editorial` (report branch) | Opus 4.7 | High | Reads the full manuscript. Opus 4.7's long-context reasoning improvements directly strengthen report quality; xHigh not needed for analytical work. |
| `editorial` (`createQueue` branch) | Sonnet 4.6 | Medium | Converts an existing report to structured JSON tasks - extraction, not deep reasoning. |
| `editorial-issues` | Sonnet 4.6 | Medium | Direct manuscript → revision-queue JSON; simpler than the full editorial report. |
| `revision-verify` | Sonnet 4.6 | Low | Checklist-style pass on already-revised content. Fast is fine. |
| `chapter-scene-eval` | Sonnet 4.6 | Medium | Rubric scoring against a scene plan; structured and bounded. |

---

## Planning and structured outputs - smart but not maximally expensive

| Stage | Model | Effort | Rationale |
|---|---|---|---|
| `ending` (expansion) | Opus 4.7 | Medium | This doc shapes the entire book. Opus 4.7 at Medium gives more capability than Opus 4.6 at Medium for the same cost. |
| `ending` (concepts) | Sonnet 4.6 | Medium | JSON list generation; Sonnet handles it well. |
| `characters` | Sonnet 4.6 | Medium | Structured profiles with some creative judgment needed for voice and arc coherence. |
| `structure` | Sonnet 4.6 | Medium | Beat sheet is logic-heavy, not prose-heavy. Sonnet + Medium reasoning is well-matched. |
| `chapter-outlines` | Sonnet 4.6 | Medium | Important planning artifact but JSON-shaped; benefits from reasoning, not raw creativity. |
| `chapter-scene-plan` | Sonnet 4.6 | Medium | Scene card JSON per chapter; structured planning that benefits from a reasoning chain. |
| `story-bible` | Sonnet 4.6 | Medium | Consolidating existing docs into canon JSON - synthesis and extraction, not invention. |
| `creative-brief` | Sonnet 4.6 | Low | Compressing an already-built bible into a compact brief; straightforward extraction. |

---

## Research and analysis - low-stakes structured work

| Stage | Model | Effort | Rationale |
|---|---|---|---|
| `genre-research` | Sonnet 4.6 | Low | Market analysis prose. Sonnet's knowledge is sufficient; no deep reasoning chain needed. |
| `niche` | Sonnet 4.6 | Low | Positioning strategy; same profile as genre research. |
| `chapter-summary` | Haiku 4.5 | Low | Summarizing existing chapter text into 150-200 words. Simplest task in the pipeline. |
| `title` | Haiku 4.5 | Low | JSON list of title strings. Practically a lookup task. |

---

## Marketing - copywriting, not creative fiction

| Stage | Model | Effort | Rationale |
|---|---|---|---|
| `blurb` | Sonnet 4.6 | Low | Polished copywriting. Sonnet is well-trained on this format; no extended reasoning needed. |
| `amazon-description` | Sonnet 4.6 | Low | Structured three-part copy format. Same profile as blurb. |

---

## Decision logic

Three factors drive each recommendation:

**1. Will the end reader see this output directly?**  
Yes → Opus 4.7. The `chapters` and `chapter-scenes-prose` stages are the only ones where the output is literally the product. `chapter-polish` and `revision` touch that output but are refinements, not first-draft generation.

**2. Does the output have outsized downstream leverage?**  
The `ending` expansion and `editorial` report both shape or constrain everything that follows. A weak ending blueprint or shallow editorial read cascades through the whole book. These get Opus 4.7 even though they are not prose.

**3. Is it structured extraction or short-form copy?**  
Summaries, JSON schemas, briefs, marketing blurbs - Sonnet 4.6 or Haiku 4.5 at Low effort. The reasoning chain adds cost without adding quality for tasks that are bounded and well-defined.

**On xHigh effort:** Opus 4.7 introduces a new `xhigh` effort level. It is reserved here for `chapters` (single-pass) only - the stage where long-horizon coherence across character voice, continuity, and narrative arc within one large generation matters most. Per-scene prose (`chapter-scenes-prose`) is bounded enough that `High` is the right ceiling.

**On effort calibration for Opus 4.7:** Low-effort Opus 4.7 is roughly equivalent to medium-effort Opus 4.6 in practice. Where Opus 4.7 replaces Opus 4.6 on refinement tasks (`chapter-polish`, `revision`), Medium effort is the ceiling rather than High.

**Effort levels** otherwise follow the same logic as before: High where the model must hold a large context in its reasoning window. Medium for multi-step planning where some chain-of-thought improves coherence. Low for extraction and short-form tasks.

---

## Quick reference - all stages

| Stage | Model | Effort |
|---|---|---|
| `genre-research` | Sonnet 4.6 | Low |
| `niche` | Sonnet 4.6 | Low |
| `ending` (concepts) | Sonnet 4.6 | Medium |
| `ending` (expansion) | Opus 4.7 | Medium |
| `characters` | Sonnet 4.6 | Medium |
| `structure` | Sonnet 4.6 | Medium |
| `title` | Haiku 4.5 | Low |
| `chapter-outlines` | Sonnet 4.6 | Medium |
| `chapter-summary` | Haiku 4.5 | Low |
| `story-bible` | Sonnet 4.6 | Medium |
| `creative-brief` | Sonnet 4.6 | Low |
| `chapters` | Opus 4.7 | xHigh |
| `chapter-scene-plan` | Sonnet 4.6 | Medium |
| `chapter-scenes-prose` | Opus 4.7 | High |
| `chapter-polish` | Opus 4.7 | Medium |
| `chapter-scene-eval` | Sonnet 4.6 | Medium |
| `editorial` (report) | Opus 4.7 | High |
| `editorial` (queue) | Sonnet 4.6 | Medium |
| `editorial-issues` | Sonnet 4.6 | Medium |
| `revision` | Opus 4.7 | Medium |
| `revision-verify` | Sonnet 4.6 | Low |
| `blurb` | Sonnet 4.6 | Low |
| `amazon-description` | Sonnet 4.6 | Low |

---

## Token pricing

Prices are per million tokens (MTok), billed separately for input and output. Verified against Anthropic's API pricing page as of April 2026.

### Standard rates

| Model | API ID | Input | Output |
|---|---|---|---|
| Opus 4.7 | `claude-opus-4-7` | $5.00 | $25.00 |
| Sonnet 4.6 | `claude-sonnet-4-6` | $3.00 | $15.00 |
| Haiku 4.5 | `claude-haiku-4-5-20251001` | $1.00 | $5.00 |

All three models follow a consistent 5:1 output-to-input ratio. Sonnet is 1.67x the cost of Haiku; Opus is 1.67x the cost of Sonnet.

### Discounts

| Mechanism | Saving | Notes |
|---|---|---|
| **Prompt caching** | Up to 90% off cached input | Cache reads billed at ~10% of standard input rate. Set `cache_control` on reused blocks. |
| **Batch API** | 50% off input and output | Async processing; results returned within 24 hours. Not suitable for real-time generation. |
| **Combined** | Up to 95% off eligible input | Batch + caching together on high-cache-hit workloads. |

### Tokenizer note for Opus 4.7

Opus 4.7 ships with a new tokenizer that can map the same input text to roughly **1.0x - 1.35x more tokens** than Opus 4.6. Per-token prices are unchanged, but effective cost per request can increase by up to 35% depending on content. Benchmark your longest prompts (particularly the `editorial` report branch, which passes the full manuscript as input) before assuming cost parity with Opus 4.6.

### StoryForge-specific cost notes

**Where token volumes are largest:**

- `editorial` (report branch) - the full compiled manuscript is passed as input. A 80,000-word novel is roughly 100,000-110,000 tokens. At Opus 4.7 standard rates, input alone costs ~$0.50-$0.55 per run before caching. With prompt caching on the canon/reference blocks, repeat editorial runs drop significantly.
- `chapters` at xHigh - a 3,000-word chapter output is roughly 4,000 tokens. At $25/MTok output, one chapter generation costs ~$0.10 in output tokens. Across 25 chapters, output tokens alone are ~$2.50. Input context (assembledContext, story bible, prior summaries) adds to this per call.
- `chapter-scenes-prose` - similar output volume to single-pass chapters but split across multiple scene calls. Per-call cost is lower; total cost per chapter is comparable.

**Where caching saves most:**

The `assembledContext` / story bible block is reused across every chapter generation call. Marking this as a cached block with `cache_control` is the single highest-impact caching opportunity in the pipeline - it typically represents the majority of input tokens on drafting calls.

**Where Haiku saves most:**

`chapter-summary` and `title` calls are the highest-frequency low-stakes tasks in the pipeline. Running 25 chapter summaries on Haiku 4.5 instead of Sonnet 4.6 costs roughly $0.05 total vs $0.15 - negligible in absolute terms but a clean win with no quality trade-off.

### Auto mode preflight ↔ USD (Write chapters UI)

The **Write chapters → Auto mode** line that shows something like **~11.9–17.5M tokens** comes from `estimateFullAutoTokens` in `src/lib/cost/preflight.ts`. For each planned API call it sums **stage template overhead** (system prompts, instructions, JSON scaffolding) and the stage model’s **max output budget** (`maxTokens`). That total is useful as an order-of-magnitude capacity hint; it is **not** the same as billed usage, because real prompts grow with your manuscript and replies rarely sit at the output ceiling.

On the chapters stage, that preflight assumes **scene pipeline + polish** when `FULL_AUTO_USE_SCENE_PIPELINE_DEFAULT` is true (the app default). It does **not** add editorial or revision—those are estimated separately when Full Auto includes post-draft legs.

**Rough Anthropic API cost for the same drafting-focused slice** (25 chapters, recommended Sonnet / Opus / Haiku mix from this doc, assembled-context caching as in the scenario assumptions below):

| Preflight shape | Order-of-magnitude cost |
|---|---|
| Scene pipeline **with** polish (matches default preflight) | **~$15** (planning + scene pipeline with polish + summaries + marketing—sums the planning, scene-pipeline, summary, and marketing rows in the breakdown below) |
| Scene pipeline **without** polish | **~$11** |
| Single-pass `chapters` instead of scene pipeline | **~$4–5** |

If your project uses **many more chapters** than the ~25-chapter baseline here, scale roughly linearly for the per-chapter stages (scene prose, polish, evals, summaries).

**Provider note:** The app’s global default is OpenRouter (`qwen-3.6-thinking-openrouter`), whose pricing is unrelated to the Anthropic table above. Treat these dollar figures as applying when you route generation through Claude per this document.

---

## Full-book cost estimate

Estimates below assume a **25-chapter, ~80,000-word commercial fiction novel** - a typical KDP target length. All figures use the model and effort recommendations in this doc and assume prompt caching is enabled on the assembled context / story bible block across chapter calls.

**Key assumptions:**
- Chapters average 3,200 words (~4,300 output tokens each)
- Assembled context (story bible + creative brief): ~6,000 nominal tokens, ~7,200 after Opus 4.7 tokenizer adjustment (1.2x average)
- Chapter-specific input (outline slice, prior summaries, instructions): ~5,000 tokens per chapter
- Editorial report input: full 80,000-word manuscript (~129,000 tokens after tokenizer adjustment) + 8,000 tokens of canon references
- Revision input per chapter: ~12,000 tokens (chapter content + instructions + context)
- Prompt caching applied to assembled context on all chapter drafting and revision calls

---

### Phase-by-phase breakdown

#### Planning and canon (one-time)

| Stage | Model | Est. cost |
|---|---|---|
| `genre-research` | Sonnet 4.6 | $0.04 |
| `niche` | Sonnet 4.6 | $0.05 |
| `ending` (concepts) | Sonnet 4.6 | $0.03 |
| `ending` (expansion) | Opus 4.7 | $0.09 |
| `characters` | Sonnet 4.6 | $0.09 |
| `structure` | Sonnet 4.6 | $0.10 |
| `title` | Haiku 4.5 | $0.01 |
| `chapter-outlines` | Sonnet 4.6 | $0.12 |
| `story-bible` | Sonnet 4.6 | $0.10 |
| `creative-brief` | Sonnet 4.6 | $0.04 |
| **Planning total** | | **~$0.67** |

#### Chapter drafting — single-pass (25 chapters, Opus 4.7 xHigh)

| | Tokens | Cost |
|---|---|---|
| Input (fresh, per chapter) | 5,000 | |
| Input (cached context, per chapter) | 7,200 | |
| Output (per chapter) | 4,300 | |
| Chapter 1 (no cache) | - | $0.17 |
| Chapters 2-25 (cache hit on context) | - | $0.14 each |
| **Total 25 chapters** | | **~$3.43** |

Caching the assembled context saves roughly **$0.03 per chapter** ($0.72 total over 24 cached calls) compared to no caching. Without caching: ~$4.15.

#### Chapter drafting — scene pipeline (25 chapters, optional alternative)

| Sub-stage | Calls | Model | Est. cost |
|---|---|---|---|
| `chapter-scene-plan` | 25 | Sonnet 4.6 | $1.61 |
| `chapter-scenes-prose` (4 scenes/ch) | 100 | Opus 4.7 | $5.11 |
| `chapter-scene-eval` (2 chunks/ch) | 50 | Sonnet 4.6 | $3.38 |
| `chapter-polish` (optional) | 25 | Opus 4.7 | $3.59 |
| **Scene pipeline without polish** | | | **~$10.28** |
| **Scene pipeline with polish** | | | **~$13.87** |

The scene pipeline is **3x the cost** of single-pass drafting without polish, and **4x with polish**. The tradeoff is granular scene-level control and a quality eval pass before chapter approval.

#### Chapter summaries (25 × Haiku 4.5)

~$0.18 total.

#### Single editorial pass

| Stage | Model | Est. cost |
|---|---|---|
| `editorial` report | Opus 4.7 High | $0.83 |
| Revision queue generation | Sonnet 4.6 | $0.08 |
| **Single pass total** | | **~$0.91** |

The editorial report is the single most expensive individual API call in the pipeline - a 129,000-token input against Opus 4.7. Subsequent editorial passes on the same manuscript cost the same.

#### Revisions and verification

| | Chapters | Model | Est. cost |
|---|---|---|---|
| `revision` (partial - 60% of chapters) | 15 | Opus 4.7 Medium | $2.52 |
| `revision` (full - all chapters) | 25 | Opus 4.7 Medium | $4.19 |
| `revision-verify` (with partial revision) | 15 | Sonnet 4.6 | $0.50 |
| `revision-verify` (with full revision) | 25 | Sonnet 4.6 | $0.83 |

**Note:** Copy edit and proofread revision passes involve lighter, more mechanical changes than structural or line passes. In practice these could use Sonnet 4.6 instead of Opus 4.7, cutting revision cost per chapter from $0.17 to $0.07. Potential saving on those two passes: ~$2.50 across 25 chapters each.

#### Four-pass editorial (structural → line → copy → proofread)

| Component | Est. cost |
|---|---|
| 4 editorial reports | $3.34 |
| 4 revision queues | $0.33 |
| Revisions (structural 20ch + line 25ch + copy 25ch + proofread 25ch = 95 total) | $15.91 |
| Revision verify (95 chapters) | $3.14 |
| **Four-pass editorial total** | **~$22.72** |

Revisions dominate four-pass cost. If copy edit and proofread revisions use Sonnet 4.6 instead of Opus 4.7, the 50-chapter saving is ~$5.00, bringing the four-pass total to ~$17.70.

#### Marketing (optional)

`blurb` + `amazon-description`, both Sonnet 4.6: **~$0.04**

---

### Scenario rollup

| Scenario | Drafting approach | Editorial | Chapters revised | **Est. total** |
|---|---|---|---|---|
| **A - Budget** | Single-pass | 1 pass | 15 (60%) | **~$8** |
| **B - Standard** | Single-pass | 1 pass | 25 (all) | **~$10** |
| **C - Scene pipeline** | Scene pipeline, no polish | 1 pass | 25 (all) | **~$17** |
| **D - Full quality** | Scene pipeline + polish | 4 passes | All chapters, all passes | **~$37** |

All scenarios include planning, chapter summaries, one revision verify pass, and marketing.

---

### What moves the number most

**Biggest cost drivers in order:**

1. **Revisions** - each full-chapter revision on Opus 4.7 Medium costs $0.17. In four-pass editorial with all 25 chapters revised per pass, revisions alone account for **~$16** of the total bill - more than all other stages combined.

2. **Scene pipeline polish** - optional but expensive at ~$3.60 for 25 chapters on Opus 4.7. Skip it unless chapter-level voice consistency is a priority.

3. **Editorial reports** - $0.83 per pass, driven entirely by the large manuscript input. Four passes cost ~$3.34. This is largely fixed and unavoidable.

4. **Scene prose generation** - 100 API calls at ~$0.05 each. The call count is the issue, not the per-call cost.

**Biggest savings levers:**

- **Prompt caching on assembled context** - saves ~$0.72 across 25 chapter drafting calls; more on revision calls. Implement `cache_control` on the story bible / creative brief block.
- **Downgrade copy and proofread revision passes to Sonnet 4.6** - saves ~$2.50 per pass if you treat those as mechanical rather than creative work.
- **Skip `chapter-polish`** - saves $3.59 with minimal impact on structural quality.
- **Partial revision** - not every chapter needs a full revision. Targeting 60% of chapters in Scenario A saves ~$1.70 in revision output costs vs revising all 25.

---

## Prompt caching analysis

### What the scenario estimates already assume

The per-chapter drafting costs ($3.43 for 25 chapters) and scene prose costs already include caching on the assembled context block. That is the most obvious win - ~7,200 tokens of story bible / creative brief cached across all 25 chapter calls, saving roughly $0.78 vs no caching at all.

### What the estimates do not account for

The revision calls were calculated without caching, which is an omission. Revisions pass the same assembled context block on every call, just like chapter drafting does. Applying the same cache to 24 out of 25 revision calls saves:

> 24 × 7,200 tokens × ($5.00 - $0.50) / 1,000,000 = **~$0.78**

That is effectively free money on every scenario - the context has not changed between drafting and revising.

### The scene pipeline is where caching matters most

100 scene prose calls all receive the same assembled context. Caching that block across 99 of those 100 calls saves:

> 99 × 7,200 tokens × $4.50 / 1,000,000 = **~$3.21**

Without caching, the scene pipeline costs roughly $3.21 more in input tokens alone. This is the single largest caching opportunity in the whole pipeline, and is already baked into the scene pipeline estimates above.

### Other cacheable content worth considering

Beyond the assembled context, there are other static blocks passed repeatedly:

- The `CHAPTERS_SYSTEM` prompt is identical across every chapter drafting, revision, and summary call - around 300-500 tokens, reused 75+ times. Saving is modest (~$0.10) but requires no extra work.
- The characters reference and genre research blocks are included as fallback context on many drafting and revision calls and could be cached as a secondary block for additional small savings.

### The honest limitation: cache TTL

Anthropic's ephemeral prompt cache has a minimum TTL of 5 minutes. This has a significant practical implication for how caching performs in StoryForge:

- **Full Auto runs** - the cache stays warm throughout the session. All savings apply as calculated.
- **Manual chapter-by-chapter across multiple sessions** - the cache is cold at the start of each session. Each chapter generation is effectively the first call, with no hit on the assembled context from the previous session. Realistic saving in manual workflows drops to roughly 20-30% of the theoretical maximum.

For manual workflows the dominant strategy is still to implement caching - it saves within a session even if not across sessions - but the per-book savings are lower than the Full Auto figures suggest.

### Revised scenario totals with revision caching included

Adding the missed ~$0.78 saving on revision calls to each scenario:

| Scenario | Previous estimate | With revision caching | Saving |
|---|---|---|---|
| A - Budget | $8.24 | ~$7.80 | ~$0.44 |
| B - Standard | $10.25 | ~$9.80 | ~$0.45 |
| C - Scene pipeline | $16.91 | ~$16.45 | ~$0.46 |
| D - Full quality | $37.29 | ~$36.83 | ~$0.46 |

The revision saving is consistent across scenarios because all of them pass roughly the same context block. Not dramatic in absolute terms, but a zero-effort implementation change.

### Implementation priority

In order of impact:

1. **Cache the assembled context / story bible block on every chapter drafting, scene prose, and revision call** - already the highest-value action; should be implemented first if not already in place.
2. **Apply the same cache to revision calls** - identical block to what is passed during drafting; currently not reflected in the revision cost estimates.
3. **Cache the `CHAPTERS_SYSTEM` prompt as a secondary block** - low absolute saving, zero downside.
4. **For multi-session manual workflows, refresh the cache at the start of each writing session** - keep the TTL warm so the first call of a session gets a hit rather than a cold miss.