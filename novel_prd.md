# Product Requirements Document (PRD)

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
Create a **local desktop application** that guides a user from *idea → niche → outline → chapters → full manuscript → marketing copy*, using:
- **OpenAI API** (GPT-5.2, GPT-4.1 family) for research, planning, analysis, and editorial
- **Anthropic API** (Claude Opus 4.5, Claude Sonnet 4.5) for long-form creative writing and revision
- **Human approval gates** between every stage

The product should feel like a **guided production pipeline**, not a chat tool.

All project data is stored locally on the user's machine. No cloud database, no authentication, no internet dependency beyond LLM API calls.

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

## Core User Journey (Happy Path)

1. User launches the StoryForge desktop app
2. User creates a **New Project**
3. User inputs:
   - Genre and niche (via guided selector)
   - Initial premise
   - Optional external research (pasted text)
4. App guides user through **locked stages**, one at a time
5. At each stage:
   - AI generates output (using the best model for that task)
   - User reviews
   - User approves / edits / regenerates
6. Approved outputs become **canonical project documents**
7. User progresses through chapter outlines → chapter drafting
8. Chapters are compiled into a full manuscript
9. User runs editorial review and applies revisions
10. User generates marketing copy (blurb, Amazon description)
11. User exports final manuscript as `.docx` or `.txt`

---

## Workflow Stages

### Stage 0 – Project Setup (Manual)
**User inputs:**
- Project name
- Genre (from curated selector)
- Niche and microniche (from curated selector)
- Working premise
- Optional pasted research

**System action:**
- Create project container in local SQLite database
- Initialise empty document set

---

### Stage 1 – Genre & Niche Research (OpenAI)
**Prompt type:** Market analysis

**Inputs:** User premise, optional research

**Outputs:**
- Genre opportunities
- Underserved niches
- Emotional demand analysis

**Saved as:** `Reference – Genre`

---

### Stage 2 – Niche Positioning & Audience (OpenAI)
**Prompt type:** Publishing strategy

**Inputs:** Approved Genre reference

**Outputs:**
- Reader avatar
- Emotional promise
- Tropes to include / avoid

**Saved as:** `Reference – Niche`

**Gate:** User must approve to continue

---

### Stage 3 – Ending First Development (Anthropic)
**Prompt type:** Developmental fiction planning

**Inputs:** Genre, niche reference, setting + protagonist notes

**Outputs:**
- 8–10 ending concepts (selectable cards)
- Expanded selected ending

**User flow:**
1. Review endings list
2. Select one
3. Generate expanded ending

**Saved as:** `Reference – Ending`

---

### Stage 4 – Character Design (OpenAI)
**Prompt type:** Character & continuity design

**Inputs:** Niche reference, ending reference

**Outputs:**
- Character list
- Full character profiles
- Relationship map

**Saved as:** `Reference – Characters`

**Canon lock:** Once approved, characters are locked unless explicitly edited

---

### Stage 5 – Story Structure (Save the Cat) (OpenAI)
**Prompt type:** Story architecture

**Inputs:** Characters, ending, niche

**Outputs:**
- 15-beat Save the Cat outline
- Chapter mapping
- Emotional arcs

**Saved as:** `Reference – Story Structure`

---

### Stage 6 – Title (OpenAI)
**Prompt type:** Commercial title generation

**Inputs:** Genre, niche, premise, characters, story structure

**Outputs:**
- Multiple title concepts
- User selects their preferred title as the official book name

**Saved as:** Project title

---

### Stage 7 – Chapter Outlines (OpenAI)
**Prompt type:** Scene-level planning

**Inputs:** Story structure, characters, ending, niche

**Outputs:**
- Detailed outline per chapter
- Scene goals, POV, emotional beats

**Saved as:** `Reference – Chapter Outlines`

**Purpose:** Provides Claude a tight blueprint for each chapter, improving consistency and hitting the ~80,000 word target.

---

### Stage 8 – Chapter Drafting (Anthropic)
**Prompt type:** Long-form creative writing

**Flow:**
- Chapters generated one at a time
- Each chapter is guided by:
  - Specific story beat
  - Chapter outline
  - POV and scene goal
  - Prior chapter context

**User actions per chapter:**
- Approve
- Edit
- Regenerate
- Leave notes

**Saved as:** `Chapter 01`, `Chapter 02`, etc.

**Constraints:**
- Claude receives only relevant references + prior chapter
- No retroactive canon changes allowed
- Target: ~2,000 words per chapter, ~40 chapters total (~80,000 word manuscript)

**Full Auto Mode:** User may enable Full Auto to generate all chapters sequentially without manual approval at each step. Can be paused and resumed at any point.

---

### Stage 9 – Export Draft
**Purpose:** Mid-process export before editorial

**Exports:** `.docx`, `.txt`

**Use case:** Allows user to review the full draft before committing to editorial and revision

---

### Stage 10 – Compilation (System)
**Functionality:**
- Combine all approved chapters
- Display total word count and chapter count

**Output:** In-app compiled manuscript view

---

### Stage 11 – Editorial Review (Anthropic)
**Prompt type:** Senior editorial report

**Inputs:**
- Full compiled manuscript (up to 190k tokens)
- Canon references (niche, characters, ending, structure)

**Outputs:**
- Issue list with locations (chapter + approximate scene)
- Categorised recommendations: continuity, character drift, pacing, prose, logic
- Concrete fix suggestions

**Critical requirement:** Output is structured for downstream revision tasks (Stage 12).

---

### Stage 12 – Revision Loop (Anthropic + OpenAI)
**Goal:** Apply editorial recommendations via controlled re-generation, chapter by chapter, with human approval.

**Inputs:**
- Editorial report (Stage 11)
- Chapter text (current approved version)
- Canon references (locked)

**Process:**
1. **Issue extraction & packaging (OpenAI):** Convert editorial report into a Revision Queue — one task per chapter, with issue summary, fix intent, constraints, and acceptance criteria.
2. **Chapter revision generation (Anthropic):** For each selected chapter, send current text + revision tasks + canon snippets → Claude outputs revised chapter.
3. **Diff + review:** UI shows side-by-side comparison (old vs revised) with highlighted changes.
4. **User approval gate:**
   - Approve → becomes new canonical chapter version (v2, v3, etc.)
   - Reject → regenerate with adjusted notes

**Outputs:**
- Revised chapter versions (Chapter 01 v2, etc.)
- Updated compilation

**Constraints:**
- No new plot threads unless explicitly requested
- No canon changes without explicit user edits
- Maintain tone and POV consistency

**End state:** "Revision complete" when all Revision Queue tasks are resolved

---

### Stage 13 – Final Export
**Purpose:** Final manuscript delivery

**Options:**
- Export approved revised chapters
- Export formats: `.docx`, `.txt`

**Display:** Final word count, revision status

---

### Stage 14 – Marketing: Blurb (OpenAI)
**Prompt type:** Commercial copywriting

**Inputs:** Genre, niche, premise, characters, ending

**Outputs:** Back-cover blurb (several variations)

**Saved as:** `Marketing – Blurb`

---

### Stage 15 – Marketing: Amazon Description (OpenAI)
**Prompt type:** Retail copywriting

**Inputs:** Genre, niche, blurb, premise

**Outputs:** Amazon-formatted product description with hooks, comparables, and reader promise

**Saved as:** `Marketing – Amazon Description`

---

## Full Auto Mode

A special mode available during chapter drafting (Stage 8).

**Behaviour:**
- App generates all remaining chapters sequentially without pausing for manual approval at each step
- Progress shown via an overlay with current chapter indicator
- Can be paused at any chapter and resumed
- Chapters are still saved individually and can be reviewed/edited after completion

**Safeguards:**
- User explicitly opts in via a setup option
- Pause button always visible during auto generation
- Each generated chapter is still stored with version history

---

## UI / UX Requirements

### Core Layout
- **Left sidebar:** Workflow stages (visual progress tracker) — grey (not started), amber (in progress), green (approved)
- **Main panel:** Current stage content
- **Right drawer (collapsible):** Reference docs quick view — character cheat sheet, beat summary, ending reminder, "What the AI sees" toggle

### Project Dashboard
- Title, genre, niche, status
- Progress bar (Setup → Draft → Revised → Export)
- Key stats: chapters approved, total word count, last activity
- "Continue where I left off" CTA

### Chapter Writing Interface
- Clean, distraction-free editor
- Version history per chapter (v1, v2, etc.)
- Word count
- Inline notes
- Regenerate with model selector

### Revision Interface
- Revision Queue view: chapters with open issue counts and status badges
- Side-by-side diff (old vs revised) with highlighted changes
- Acceptance criteria checklist
- Approve / Reject / Regenerate with notes

### Settings Page
- Input fields for OpenAI and Anthropic API keys
- Keys stored locally in `settings.json` (never transmitted beyond LLM API calls)
- Masked display with "change" option

---

## Technical Architecture

### Application Type
**Local desktop application** built with:
- **Electron** — wraps the Next.js app in a native Windows window; distributes as a `.exe` NSIS installer
- **Next.js (App Router)** — UI and server-side API layer, running locally via Electron's bundled Node.js server

### Frontend
- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **State management:** Zustand
- **Editor:** TipTap (ProseMirror-based rich text editor)

### Backend (Local)
- **Runtime:** Next.js Route Handlers (server-side, local)
- **API style:** REST via Next.js route handlers
- **Prompt orchestration:** Server-side only (prompt templates never exposed to client)

### Database
- **SQLite** via `better-sqlite3`
- Database file: `%APPDATA%\StoryForge\data\storyforge.db` (production) / `.data/storyforge.db` (development)
- Schema: relational tables with JSON columns for arrays
- All reads/writes go through a server-side `/api/db` dispatcher route; client uses a fetch-based abstraction that never bundles SQLite directly

**Tables:**
- `projects`
- `documents`
- `chapters`
- `chapter_versions`
- `editorial_issues`
- `revision_tasks`

### Authentication
None. StoryForge is a **single-user local application**. All data belongs to the machine owner. No login, no session management, no user isolation required.

### API Key Management
- OpenAI and Anthropic API keys entered by the user via the Settings page
- Stored in `settings.json` in the app data directory
- Loaded into the server process environment at startup by Electron
- Never sent anywhere other than the respective LLM APIs

### LLM Integration

**OpenAI (research, planning, editorial)**
- Models: GPT-5.2 Thinking (default), GPT-4.1, GPT-4.1 Mini, GPT-4.1 Nano
- Used for: genre research, niche, characters, structure, title, chapter outlines, editorial issue extraction, revision task packaging, marketing copy
- JSON-structured outputs for downstream processing (editorial issues, revision tasks)

**Anthropic (long-form creative writing)**
- Models: Claude Opus 4.5 (default), Claude Sonnet 4.5, Claude 3.5 Sonnet, Claude 3.5 Haiku
- Used for: ending development, chapter drafting, chapter revision, editorial analysis
- Chapter-scoped context packaging with strict constraints (no canon edits)

**Key constraints:**
- Strict token budgeting per stage
- Context assembly logic per stage (only send required references, not full manuscript)
- Model routing handled server-side
- Manuscript capped at ~190k tokens for editorial input
- Per-chapter context: relevant canon snippets + prior chapter recap only (not entire manuscript)
- Model selector available per stage — user can override the default for any stage

### File & Export Handling
- DOCX generation: server-side using `docx` library
- Download: direct response stream via Next.js route handler
- Markdown → formatted DOCX with proper paragraph structure, italics, and Arial 11pt font

### Distribution
- **Packager:** `electron-builder`
- **Windows installer:** NSIS `.exe`
- **Build command:** `npm run electron:build:win`
- **Dev command:** `npm run electron:dev` (runs Next.js + Electron concurrently)

---

## Data Model

**Project**
- id, title, genre, niche, microniche, premise, research
- status (active / complete)
- currentStage
- fullAutoMode (boolean)
- blurb, amazonDescription
- finalExportedAt
- createdAt, updatedAt

**Document**
- id, projectId, type, content, approved
- type: genre | niche | ending | characters | structure | title | chapter-outlines | blurb | amazon-description

**Chapter**
- id, projectId, chapterNumber, title, beat, status

**ChapterVersion**
- id, chapterId, projectId, versionNumber, content, approved, parentVersionId

**EditorialIssue**
- id, projectId, chapterNumber, locationHint, category, description, recommendedFix, status

**RevisionTask**
- id, projectId, chapterId, chapterNumber, issueIds, instructions, acceptanceCriteria, status

---

## Permissions & Safety
- Explicit user approval before stage progression
- Manual override to unlock stages
- Approved content is immutable (new versions are created, originals preserved)
- Clear indication of model used per output
- Full Auto Mode requires explicit opt-in

---

## Success Metrics
- Time from idea → first chapter
- Completion rate to full manuscript
- Chapters approved without regeneration
- Export usage

---

## Future Enhancements (Post-v1)
- Series mode (shared canon across books)
- Style presets per pen name
- Scene-level drafting
- Beat-level rewrites
- Vellum-compatible export
- KDP metadata generation
- Cloud sync / backup option

---

## Summary
StoryForge is a **guided fiction production system**, not a chatbot.

It runs entirely on the author's own machine, keeps all data private, and calls OpenAI and Anthropic directly with the author's own API keys.

Its strength is:
- Structured prompts tied to proven frameworks (Save the Cat, Ending First)
- Canon enforcement (locked reference documents, immutable approved versions)
- Human-in-the-loop control at every stage
- Model specialisation (right model for each task)
- Complete data ownership (local SQLite, no cloud dependency)

Built correctly, it becomes a *repeatable novel factory* without sacrificing creative ownership.
