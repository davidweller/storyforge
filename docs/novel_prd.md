# Product Requirements Document (PRD)

**Product:** StoryForge  
**Audience:** This document is the product-level spec. For **implementation detail** (every `WorkflowStage` key, sidebar behavior, and generate-route wiring), see [`novel-workflow-overview.md`](novel-workflow-overview.md) and [`ai-stages-and-prompts.md`](ai-stages-and-prompts.md).

---

## Product Name
**StoryForge**

## Problem Statement
Writing commercially viable fiction using AI requires a *structured, multi-stage workflow* with strong human-in-the-loop controls. Current tools (ChatGPT, Claude, Reedsy, Vellum) are either:
- Unstructured (chat-based, context drift)
- Overly manual (copy/paste between tools)
- Not designed for long-form, multi-document fiction projects

Authors need a **clear, step-by-step system** that:
- Guides them through proven prompts
- Locks canon and prevents drift
- Separates research, planning, drafting, and editing
- Uses best-in-class models for each task
- Produces export-ready manuscripts

## Product Goal
Create a **local-first application** that guides a user from *idea → niche → outline → chapters → full manuscript → marketing copy*, using:
- **OpenAI API** (GPT-5.2, GPT-4.1 family) for research, planning, analysis, and editorial
- **Anthropic API** (Claude Opus 4.5, Claude Sonnet 4.5) for long-form creative writing and revision
- **Human approval gates** between every stage (with optional **Full Auto** for chapter-scale automation)

The product should feel like a **guided production pipeline**, not a chat tool.

All project data is stored locally on the user's machine. No cloud database, no authentication, no internet dependency beyond LLM API calls.

Current implementation ships as a Next.js app (with optional Electron desktop packaging), and LLM generation is orchestrated through a server-side `POST /api/generate` route.

## Target User
Primary:
- Indie fiction authors (KDP-focused)
- AI-assisted writers producing 1–6 novels/year

Secondary:
- Writers experimenting with AI workflows
- Small publishers / pen-name farms

User profile:
- Comfortable with AI tools
- Wants control, not full automation
- Values consistency, structure, and exportability
- Prefers a dedicated desktop tool over a browser tab

## Non-Goals
- No marketplace or social features
- No collaborative multi-user editing
- No direct KDP publishing integration (v1)
- No cloud sync or remote access

---

## Navigation and pipeline semantics

### Sidebar groups
The workflow sidebar groups stages for clarity:

| Group | Stages (conceptually) |
|--------|------------------------|
| **Planning** | Setup through title |
| **Writing** | Chapter outlines and chapter drafting (expands to **per-chapter links** once chapters exist) |
| **Editing** | Manuscript assembly, draft export, editorial, revisions, final export — plus nested **Editing passes** when multi-pass editorial is enabled |
| **Marketing** | Blurb and Amazon description (**outside** the linear stage counter; does not block export final) |
| **Project Dashboard** | Overview, canon tooling shortcuts, usage, and cross-cutting actions |

### Linear order (`STAGE_ORDER`)
The app tracks a **current stage** on the project. Sidebar items **ahead** of that stage are locked until progress advances; users can usually **return** to earlier stages.

Official sequence (indices 0–13):

| # | Stage key | User-facing idea |
|---|-----------|-------------------|
| 0 | `setup` | Project bootstrap |
| 1 | `genre-research` | Market analysis |
| 2 | `niche` | Reader targeting |
| 3 | `ending` | Ending-first planning |
| 4 | `characters` | Cast / continuity |
| 5 | `structure` | Plot blueprint (Save the Cat style) |
| 6 | `title` | Title selection |
| 7 | `chapter-outlines` | Per-chapter outlines |
| 8 | `chapters` | Chapter drafting |
| 9 | `compilation` | Assemble manuscript |
| 10 | `export-draft` | Export WIP |
| 11 | `editorial` | Editorial analysis |
| 12 | `revision` | Apply revisions |
| 13 | `export-final` | Final export |

**Progress exceptions (implemented behavior):**
- **Compilation** may unlock while you are still in **chapters** if **every chapter is already approved**, so you can assemble without artificially advancing the stored stage first.
- **Export Final** follows stricter completion rules when **four-pass editorial** is enabled on a project (revision/export-final unlock only after the full pass ladder, including **final report** tasks, is satisfied).

### Marketing outside the ladder
`blurb` and `amazon-description` are valid workflow stages but are **not** in `STAGE_ORDER`, so marketing never blocks **Export Final**.

---

## Core User Journey (Happy Path)

1. User launches the StoryForge desktop app
2. User creates a **New Project**
3. User inputs genre, niche, premise, optional research
4. App guides user through **locked stages**, one at a time
5. At each stage: AI generates → user reviews → approves / edits / regenerates
6. Approved outputs become **canonical project documents**
7. User progresses through chapter outlines → chapter drafting (single-pass and/or **scene pipeline**; see below)
8. User assembles chapters into a manuscript, optionally exports a draft
9. User runs editorial review (single pass or **multi-pass editorial**)
10. User applies revisions from structured tasks
11. User exports the final manuscript
12. User may generate marketing copy (blurb, Amazon description) **in parallel** with late pipeline steps

---

## Workflow Stages

### Stage 0 – Project Setup (`setup`)
**User inputs:**
- Project name
- Genre (from curated selector)
- Niche and microniche (from curated selector)
- Working premise
- Optional pasted research

**System action:**
- Create project container in local SQLite database
- Initialise empty document set

*Does not call `/api/generate`.*

---

### Stage 1 – Genre & Niche Research (`genre-research`) (OpenAI)
**Prompt type:** Market analysis  

**Outputs:** Genre opportunities, niches, emotional demand analysis → **`Reference – Genre`**

---

### Stage 2 – Niche Positioning & Audience (`niche`) (OpenAI)
**Prompt type:** Publishing strategy  

**Inputs:** Approved genre reference  

**Outputs:** Reader avatar, emotional promise, tropes → **`Reference – Niche`**  

**Gate:** User must approve to continue

---

### Stage 3 – Ending First Development (`ending`) (Anthropic)
**Prompt type:** Developmental fiction planning  

**Outputs:** Multiple ending concepts (selectable); expanded selected ending → **`Reference – Ending`** (plus optional separate **`ending-choice`** artifact where implemented)

---

### Stage 4 – Character Design (`characters`) (OpenAI)
**Outputs:** Character list, profiles, relationship map → **`Reference – Characters`**  

**Canon lock:** Once approved, characters are locked unless explicitly edited

---

### Stage 5 – Story Structure (`structure`) (OpenAI)
**Outputs:** Beat-style outline, chapter mapping, emotional arcs → **`Reference – Story Structure`**

---

### Stage 6 – Title (`title`) (OpenAI)
**Outputs:** Title concepts; user selection becomes the official book name

---

### Stage 7 – Chapter Outlines (`chapter-outlines`) (OpenAI)
**Outputs:** Detailed outline per chapter (scene goals, POV, beats, targets) → **`Reference – Chapter Outlines`**

---

### Stage 8 – Chapter Drafting (`chapters`) (Anthropic)

**Two authoring modes (product-level):**

1. **Legacy single-pass chapter generation** — one `chapters` generation per chapter from outline + context.
2. **Scene pipeline** — finer stages under the same “Write Chapters” umbrella:
   - `chapter-summary` — running summaries for long-book coherence
   - `chapter-scene-plan` — structured **scene cards** (JSON-validated)
   - `chapter-scenes-prose` — prose **per scene** (structured output with scene id)
   - `chapter-polish` — optional pass over concatenated scenes
   - `chapter-scene-eval` — model **rubric evaluation** (structured checks, possible chunking for long chapters); supports quality signals before approval

**User actions per chapter:** Approve, edit, regenerate, notes, scene-plan edits where enabled.

**Saved as:** `Chapter 01`, `Chapter 02`, etc., with **version history**.

**Constraints:** Bounded context per call (assembler / story bible / brief); no silent retroactive canon rewrites.

**Full Auto Mode:** User may enable Full Auto to advance many generations with minimal prompts; progress is **checkpointed** so runs can pause and resume. Scene-pipeline full-auto may be gated by product flags (see roadmap).

---

### Stage 9 – Compilation (`compilation`) (System)
Combine approved chapters; show total word count and chapter count; in-app compiled manuscript view.

*Does not call `/api/generate`.*

---

### Stage 10 – Export Draft (`export-draft`)
Mid-process **`.docx` / `.txt`** export before editorial.

*Export is via dedicated routes; not the generate route.*

---

### Stage 11 – Editorial Review (`editorial`) (Anthropic + structured follow-ons)

**Inputs:** Compiled manuscript (large-context limits apply; model may auto-switch on overflow), canon references.

**Outputs:** Editorial feedback; when applicable, structured data for downstream revision (e.g. issue lists / revision queue).

**Multi-pass editorial (optional per project):** Structural → Line → Copy → Proofread → **Final report**. Sidebar **Editing passes** expose Review + Revisions per pass; passes unlock in order. Document types include pass-specific editorial artifacts (e.g. `editorial-structural`, … `editorial-final`).

**Related generate stages (experienced inside Editorial / Revision flows):**
- `editorial-issues` — structured revision-queue style output from manuscript/editorial context

**Pass-specific modes** align with implementation: `structural`, `line`, `copy`, `proofread`, `final_report`.

---

### Stage 12 – Revision Loop (`revision`) (Anthropic + OpenAI)

**Goal:** Apply recommendations with human approval, chapter by chapter.

**Typical flow:**
1. Packaged revision tasks per chapter (OpenAI or structured pipeline)
2. Chapter revision generation (Anthropic)
3. Diff / review in UI
4. Approve → new canonical chapter version

**Helper stage:** `revision-verify` — post-revision structured checklist pass when configured.

**End state:** Revision complete when queue / pass ladder rules are satisfied (stricter under four-pass editorial).

---

### Stage 13 – Export Final (`export-final`)
Final **`.docx` / `.txt`**; show final word count and revision status.

---

### Marketing (parallel) — Blurb & Amazon Description
- **`blurb`** (OpenAI) → `Marketing – Blurb`
- **`amazon-description`** (OpenAI) → `Marketing – Amazon Description`

**Not in `STAGE_ORDER`;** available from Marketing group / dashboard without blocking **Export Final**.

---

### Canon tooling (Project Dashboard — not numbered in `STAGE_ORDER`)
- **`story-bible`** — consolidated canon document (voice, themes, continuity) generated from approved planning docs
- **`creative-brief`** — compact brief derived from an approved story bible

These feed **`assembleContext`** / bounded context for drafting, scene planning, and evaluation.

---

## Generation API Contract (Current)

Requests: `POST /api/generate` with `stage`, `data`, optional `model` (and related optional fields validated per stage).

### Stages routed through `/api/generate` (LLM-backed)
Including but not limited to:

**Planning & draft:**  
`genre-research`, `niche`, `ending`, `characters`, `structure`, `title`, `chapter-outlines`, `chapters`

**Chapter helpers:**  
`chapter-summary`, `chapter-scene-plan`, `chapter-scenes-prose`, `chapter-polish`, `chapter-scene-eval`

**Canon:**  
`story-bible`, `creative-brief`

**Editing:**  
`editorial`, `editorial-issues`, `revision`, `revision-verify`

**Marketing:**  
`blurb`, `amazon-description`

### Stages that do not use `/api/generate` for LLM
`setup`, `compilation`, `export-draft`, `export-final`

### Editorial behavior (summary)
- Pass-specific editorial modes: `structural`, `line`, `copy`, `proofread`, `final_report`
- Structured JSON outputs (with **repair** pass on schema failure) for editorial queue generation and scene pipeline stages as implemented
- Large-manuscript editorial analysis may switch models for context limits

---

## Full Auto Mode

**Behaviour:**
- Advances through configured pipeline steps with minimal per-step confirmation
- Progress UI (e.g. overlay) with current step / chapter
- **Pause / resume**; **checkpoint** storage restores interrupted runs
- Outputs remain persisted per chapter / document; reviewable after a run

**Safeguards:**
- Explicit opt-in
- Pause always available during auto runs
- Version history preserved per artifact

---

## UI / UX Requirements

### Core Layout
- **Left sidebar:** Workflow stages (progress tracker) — grey (not started), amber (in progress), green (approved); **per-chapter** entries under Writing when chapters exist; **Editing passes** when multi-pass editorial is on
- **Main panel:** Current stage content
- **Right drawer (collapsible):** Reference docs quick view; “what the AI sees” / context transparency where implemented

### Project Dashboard
- Title, genre, niche, status
- Progress relative to `STAGE_ORDER`
- Key stats: chapters approved, word count, last activity
- Shortcuts to canon tools (story bible, brief), usage metrics where shown
- **Continue where I left off** CTA

### Chapter Writing Interface
- Distraction-free editor
- Version history (v1, v2, …)
- Word count, notes, regenerate with model selector
- **Scene pipeline** UI when enabled: scene plan editor, per-scene generation, optional polish, evaluator panel, gating before approve

### Revision Interface
- Revision Queue / per-pass task lists
- Side-by-side diff where implemented
- Approve / reject / regenerate with notes

### Settings Page
- OpenAI and Anthropic API keys (optional OpenRouter path per routing config)
- Keys stored locally (e.g. app data `settings.json`); masked display

---

## Technical Architecture

### Application Type
**Local desktop application:**
- **Electron** — wraps Next.js; Windows NSIS `.exe` via `electron-builder`
- **Next.js (App Router)** — UI + Route Handlers locally

### Frontend
- **Framework:** Next.js (App Router), **TypeScript**, **Tailwind CSS v4**
- **State:** Zustand
- **Editor:** TipTap (ProseMirror)

### Backend (Local)
- **API:** Next.js Route Handlers (REST-style)
- **Prompts:** Server-side only

### Database
- **SQLite** via `better-sqlite3`
- Paths: `%APPDATA%\StoryForge\data\storyforge.db` (production) / `.data/storyforge.db` (development)
- Client accesses data via server routes / fetch abstractions (no SQLite in the bundle)

**Core tables (conceptual):**  
`projects`, `documents`, `chapters`, `chapter_versions`, editorial/revision tracking as implemented (`editorial_issues`, `revision_tasks`, etc.)

### Authentication
None — single-user local app.

### LLM Integration

**OpenAI** — research, planning, structured packaging, marketing  
**Anthropic** — long-form prose, revision, editorial reads  
**OpenRouter** — optional routing path  

**Principles:** Token budgeting per stage, context assembly (`assembleContext`), server-side model routing, manuscript size limits for editorial input, per-chapter context bounded to relevant canon + recap (not full book every call).

### File & Export Handling
- DOCX via `docx` library; streaming download from route handlers
- Markdown-style content mapped to paragraphs / emphasis per house style

### Distribution
- `npm run electron:build:win`, `npm run electron:dev`

---

## Data Model (conceptual)

**Project**
- Identifiers, title, genre, niche, microniche, premise, research
- `status`: active / completed / archived (per implementation types)
- `currentStage`: `WorkflowStage`
- `fullAutoMode`, `fourPassEditorial` (multi-pass editorial flag)
- Marketing fields, `finalExportedAt`, timestamps

**Document**
- `type` includes: `genre`, `niche`, `ending`, `ending-choice`, `characters`, `structure`, `chapter-outlines`, `chapter-scene-plan`, `story-bible`, `creative-brief`, pass-specific `editorial-*` types, legacy `editorial`, etc.
- `chapterNumber` when type is chapter-scoped (e.g. scene plan)
- `content`, `version`, `approved`

**Chapter / ChapterVersion**
- Chapter metadata; versions with `content`, `approved`, parent version lineage

**Editorial & revision entities**
- Issues and tasks linking chapters, categories, acceptance criteria, status (per schema)

---

## Permissions & Safety
- Explicit approval before advancing stages
- Manual unlock / return to earlier stages where permitted
- Immutable approved history via new versions
- Model transparency per generation
- Full Auto explicit opt-in; checkpointing does not bypass persistence rules

---

## Success Metrics
- Time from idea → first chapter
- Completion rate to full manuscript
- Chapters approved without regeneration
- Export usage

---

## Future Enhancements (Post-v1)
- Deeper series mode (shared canon across books)
- Style presets per pen name
- Richer scene-level tooling across Full Auto
- Beat-level rewrites
- Vellum-compatible export
- KDP metadata generation
- Optional cloud backup

---

## Summary
StoryForge is a **guided fiction production system**, not a chatbot. It runs locally, keeps data private, and calls LLM providers with the author’s keys. Its strengths: structured prompts (**Save the Cat**, ending-first), **canon enforcement** (documents, story bible, assembler), **human-in-the-loop** control, **model specialization**, optional **scene-level quality gates**, **multi-pass editorial**, and complete **data ownership** (local SQLite).

Built correctly, it becomes a *repeatable novel factory* without sacrificing creative ownership.
