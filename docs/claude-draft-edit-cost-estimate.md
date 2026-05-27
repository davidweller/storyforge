# Claude Draft and Editing Cost Estimate

**App:** StoryForge  
**Last updated:** 2026-05-25  
**Scope:** Anthropic API pricing for creating and editing a commercial-fiction draft with Claude Sonnet 4.6 and Claude Opus 4.7 thinking models.

This is an order-of-magnitude estimate, not a billing guarantee. Actual cost depends on manuscript length, chapter count, prompt size, model effort, retries, JSON repair calls, rejected generations, and how much thinking the model uses.

For stage-level model recommendations, see [`model_recommendations.md`](model_recommendations.md).

---

## Pricing Assumptions

Prices are per million tokens (MTok), billed separately for input and output. Verified against Anthropic pricing information in May 2026.

| Model | API model | Input | Output |
|---|---|---:|---:|
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | $3.00 / MTok | $15.00 / MTok |
| Claude Opus 4.7 | `claude-opus-4-7` | $5.00 / MTok | $25.00 / MTok |

Important billing notes:

- Thinking tokens are billed as output tokens. A response with 3,000 visible output tokens and 12,000 thinking tokens is billed as 15,000 output tokens.
- Opus 4.7 uses adaptive thinking. In app-facing terms, the "High" and "xHigh" presets should be understood as higher-effort generations that may consume more output/thinking tokens.
- Prompt caching can reduce repeated reference input by up to about 90% on cache hits. The biggest opportunity is the reused story bible / creative brief / assembled context block during chapter drafting and revisions.
- Batch API can reduce input and output token cost by 50%, but it is async and not suitable for every interactive workflow.
- These figures do not include platform markup, OpenRouter pricing, taxes, free-tier credits, or Claude subscription plan limits.

Formula:

```text
cost = (input_tokens / 1,000,000 * input_rate) + (output_tokens / 1,000,000 * output_rate)
```

For thinking models:

```text
output_tokens = visible_output_tokens + thinking_tokens
```

---

## Baseline Novel Assumptions

The baseline below models a typical commercial-fiction project:

| Assumption | Value |
|---|---:|
| Final manuscript length | 80,000 words |
| Chapter count | 25 chapters |
| Average chapter length | 3,200 words |
| Draft output tokens per chapter | ~4,300 visible tokens |
| Full manuscript input for editorial | ~105,000-130,000 tokens |
| Reused canon/context block | ~6,000-8,000 tokens |
| Drafting model | Opus 4.7 thinking |
| Planning / extraction model | Sonnet 4.6, often with medium thinking |
| Revision model | Opus 4.7 medium thinking by default |

Token estimates use the rough rule that prose is about 1.3 tokens per English word before model-specific tokenizer differences. Opus 4.7 may tokenize some text more heavily than earlier models, so long-context calls should be benchmarked against real usage logs.

---

## Recommended Model Mix

Use Sonnet 4.6 for structured planning, extraction, summaries, queues, and validation. Use Opus 4.7 thinking where the generated prose or deep editorial judgment directly affects the book.

| Workflow area | Suggested model | Why |
|---|---|---|
| Market/niche/planning docs | Sonnet 4.6 | Structured reasoning, lower cost |
| Characters, structure, chapter outlines | Sonnet 4.6 thinking | Good balance for multi-step planning |
| First-draft chapter prose | Opus 4.7 thinking | Reader-visible creative output |
| Scene prose | Opus 4.7 thinking | Reader-visible creative output |
| Chapter polish | Opus 4.7 medium thinking | Direct line-level prose refinement |
| Editorial report | Opus 4.7 high thinking | Long-context judgment over the manuscript |
| Revision queue / issue extraction | Sonnet 4.6 thinking | Structured extraction from report/manuscript |
| Applying revisions | Opus 4.7 medium thinking | Prose edits affect final manuscript |
| Revision verification | Sonnet 4.6 | Checklist-style validation |

---

## Draft Creation Estimate

### One-time planning and canon

Approximate total for market research, niche, endings, characters, structure, title, chapter outlines, story bible, and creative brief:

| Component | Model mix | Estimate |
|---|---|---:|
| Planning and canon | Mostly Sonnet 4.6, one Opus ending expansion | ~$0.70 |

### Chapter drafting options

| Drafting approach | What happens | Estimate for 25 chapters |
|---|---|---:|
| Single-pass drafting | One Opus 4.7 xHigh-style call per chapter | ~$3.50-$4.25 |
| Scene pipeline without polish | Scene plan, per-scene prose, scene eval | ~$10-$11 |
| Scene pipeline with polish | Scene plan, per-scene prose, scene eval, Opus polish | ~$14-$15 |

The scene pipeline costs more because it makes many more calls and adds evaluation/polish passes. The benefit is better control over scene structure, easier retries, and more opportunities to catch weak chapters before approval.

### Draft-only subtotal

| Draft route | Includes | Estimated subtotal |
|---|---|---:|
| Budget draft | Planning + single-pass chapters + summaries | ~$4-$5 |
| Controlled draft | Planning + scene pipeline without polish + summaries | ~$11-$12 |
| Higher-quality draft | Planning + scene pipeline with polish + summaries | ~$15-$16 |

---

## Editing Estimate

### Single editorial pass

| Component | Model | Estimate |
|---|---|---:|
| Full manuscript editorial report | Opus 4.7 high thinking | ~$0.80-$1.00 |
| Revision queue from report | Sonnet 4.6 thinking | ~$0.05-$0.15 |
| Total editorial analysis | Mixed | ~$0.90-$1.15 |

The editorial report is usually the largest single API call because it reads the full manuscript plus canon/context. It is still relatively cheap in raw API terms because it is mostly input tokens; revision and polish become more expensive when they produce substantial output.

### Applying revisions

| Revision scope | Model mix | Estimate |
|---|---|---:|
| Partial revision, 60% of chapters | Opus 4.7 revision + Sonnet verify | ~$3-$4 |
| Full-book revision, all chapters | Opus 4.7 revision + Sonnet verify | ~$5-$6 |
| Full-book revision using Sonnet for lighter copy/proof tasks | Sonnet-heavy | ~$2-$4 |

Opus is worth using for structural, voice, pacing, and line-edit revisions. Sonnet is usually sufficient for mechanical proofing, checklist verification, and structured issue extraction.

### Four-pass editing

For structural edit, line edit, copy edit, and proofread:

| Component | Estimate |
|---|---:|
| 4 editorial reports | ~$3-$4 |
| 4 revision queue generations | ~$0.25-$0.50 |
| Revisions across passes | ~$16 if all Opus; ~$11 if copy/proof use Sonnet |
| Verification across passes | ~$3 |
| Four-pass editing subtotal | ~$18-$23 |

---

## End-to-End Scenario Rollup

| Scenario | Drafting approach | Editing approach | Estimated total |
|---|---|---|---:|
| Budget | Single-pass chapters | One editorial pass, partial revisions | ~$8 |
| Standard | Single-pass chapters | One editorial pass, full revisions | ~$10 |
| Controlled | Scene pipeline without polish | One editorial pass, full revisions | ~$17 |
| Higher quality | Scene pipeline with polish | One editorial pass, full revisions | ~$21 |
| Full quality | Scene pipeline with polish | Four editorial passes | ~$35-$40 |

All totals assume an 80,000-word, 25-chapter book, a mixed Sonnet/Opus model strategy, and some prompt caching on repeated context. Without caching, add a few dollars for repeated long context. With Batch API on non-interactive runs, some totals could drop by up to about 50% on eligible work.

---

## Sensitivity by Manuscript Length

Costs scale roughly with chapter count, word count, and revision coverage.

| Manuscript | Approx. scale vs baseline | Standard scenario |
|---|---:|---:|
| 60,000 words / ~20 chapters | ~0.75x | ~$7-$8 |
| 80,000 words / ~25 chapters | 1.00x | ~$10 |
| 100,000 words / ~32 chapters | ~1.30x | ~$13-$15 |
| 120,000 words / ~38 chapters | ~1.55x | ~$16-$18 |

The four-pass workflow scales faster than the draft-only workflow because each pass rereads and revises manuscript content.

---

## Main Cost Drivers

1. **Thinking output.** High and xHigh efforts can spend many more output tokens than the visible prose suggests.
2. **Retries.** Regenerating a chapter doubles that chapter's generation cost.
3. **Scene pipeline fan-out.** Four scenes per chapter turns 25 chapter calls into 100 prose calls, plus planning/eval/polish calls.
4. **Revision coverage.** Revising 25 chapters costs much more than revising the 10-15 chapters that actually need changes.
5. **Repeated context.** Passing the same story bible, creative brief, and prior summaries repeatedly is cheap only if prompt caching is used well.
6. **Long editorial context.** Editorial reports read the full manuscript. Large novels and multi-pass workflows multiply this cost.

---

## Practical Cost Controls

- Use Sonnet 4.6 for planning, structured extraction, queues, summaries, verification, blurbs, and mechanical proofing.
- Reserve Opus 4.7 thinking for first-draft prose, polish, deep editorial reports, and meaningful prose revisions.
- Cache the assembled canon/context block for chapter drafting and revision calls.
- Prefer partial revision queues over blanket full-book rewrites.
- Run copy edit and proofread passes on Sonnet unless the prose needs significant stylistic rewriting.
- Track actual token usage per stage and replace these estimates with measured medians once enough projects have run.

---

## Quick Answer

For an 80,000-word novel, expect raw Anthropic API cost of roughly:

- **~$4-$5** to create a basic single-pass draft.
- **~$10** to create the draft and do one full editorial/revision cycle.
- **~$17-$21** for a scene-controlled draft plus one full edit.
- **~$35-$40** for a scene-controlled draft with polish and a four-pass editorial workflow.

The biggest quality-per-dollar pattern is Sonnet 4.6 for structured work and Opus 4.7 thinking only where the model is producing or deeply judging reader-visible prose.
