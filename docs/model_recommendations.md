# Claude Model Routing by Stage

**App:** StoryForge  
**Last updated:** 2026-05-25  
**Default model strings used:** `claude-sonnet-4-6`, `claude-sonnet-4-6` with medium thinking, `claude-opus-4-6`

> **Note:** These are the default Anthropic routes in `STAGE_DEFAULT_MODEL_IDS` plus the conditional routing in `/api/generate`. A request-level `model` field or saved UI model preference can still override the default.

---

## Suggested Per-Stage Routing

| Stage | Recommended model | Why |
|---|---|---|
| `chapters`, `chapter-scenes-prose`, `chapter-polish`, `revision` | Sonnet 4.6 | High volume; prose quality is strong at this tier. |
| `chapter-summary`, `chapter-scene-plan`, `chapter-scene-eval` (`lite` / `standard`) | Sonnet 4.6 | Structured outputs, no need to escalate. |
| `editorial` (`structural`, `line`, `copy`, `proofread`), `editorial-issues`, `editorial` (`createQueue`) | Sonnet 4.6 with medium thinking | Existing editorial gate fallback profile; keep reasoning for working edit passes and queue extraction. |
| `editorial` (`final_report`), `chapter-scene-eval` (`deep`) | Opus 4.6 | The two places where deeper reasoning earns the premium. |
| `revision-verify` | Sonnet 4.6 | Checklist-style structured pass, not depth-sensitive. |
| Planning stages (`genre-research`, `niche`, `ending`, `characters`, `structure`, `title`, `chapter-outlines`) | Sonnet 4.6 | Structured analysis fits comfortably. |
| `story-bible`, cover/A+ brief stages | Sonnet 4.6 with medium thinking | Canon/art-direction synthesis benefits from a bounded reasoning budget. |
| `creative-brief`, `blurb`, `amazon-description` | Sonnet 4.6 | Extraction and short-form copywriting. |

---

## Decision Logic

Three factors drive each recommendation:

**1. Is the task high-volume prose or bounded refinement?**  
Use Sonnet 4.6 for drafting, scene prose, polish, and revisions so the common path stays cost-efficient.

**2. Does the task require unusually deep whole-book judgment?**  
Use Opus 4.6 only for the final editorial report and deep chapter-scene evaluation.

**3. Is it structured extraction or short-form copy?**  
Summaries, JSON schemas, briefs, marketing blurbs, and verification stay on Sonnet 4.6.

**Thinking budget:** Use Sonnet medium thinking for editorial working passes, `editorial-issues`, revision-queue generation, story-bible synthesis, and cover/A+ briefs. Use non-thinking Sonnet 4.6 elsewhere unless a request explicitly overrides the model.

---

## Quick Reference

| Stage | Model | Effort |
|---|---|---|
| `genre-research` | Sonnet 4.6 | Low |
| `niche` | Sonnet 4.6 | Low |
| `ending` (concepts) | Sonnet 4.6 | Low |
| `ending` (expansion) | Sonnet 4.6 | Low |
| `characters` | Sonnet 4.6 | Low |
| `structure` | Sonnet 4.6 | Low |
| `title` | Sonnet 4.6 | Low |
| `chapter-outlines` | Sonnet 4.6 | Low |
| `chapter-summary` | Sonnet 4.6 | Low |
| `story-bible` | Sonnet 4.6 | Medium |
| `creative-brief` | Sonnet 4.6 | Low |
| `chapters` | Sonnet 4.6 | Low |
| `chapter-scene-plan` | Sonnet 4.6 | Low |
| `chapter-scenes-prose` | Sonnet 4.6 | Low |
| `chapter-polish` | Sonnet 4.6 | Low |
| `chapter-scene-eval` (`lite` / `standard`) | Sonnet 4.6 | Low |
| `chapter-scene-eval` (`deep`) | Opus 4.6 | Low |
| `editorial` (`structural`, `line`, `copy`, `proofread`) | Sonnet 4.6 | Medium |
| `editorial` (`final_report`) | Opus 4.6 | Low |
| `editorial` (queue) | Sonnet 4.6 | Medium |
| `editorial-issues` | Sonnet 4.6 | Medium |
| `revision` | Sonnet 4.6 | Low |
| `revision-verify` | Sonnet 4.6 | Low |
| `blurb` | Sonnet 4.6 | Low |
| `amazon-description` | Sonnet 4.6 | Low |
| `a-plus-brief` | Sonnet 4.6 | Medium |
| `cover-brief` | Sonnet 4.6 | Medium |
| `back-cover-brief` | Sonnet 4.6 | Medium |

---

## Costing Note

This file is the routing source of truth only. Use actual generation usage logs for budget estimates, especially after model-routing changes, because thinking tokens, retries, repair calls, prompt caching, and manuscript length can move real cost more than the nominal model choice.
