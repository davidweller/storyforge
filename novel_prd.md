# Product Requirements Document (PRD)

## Product Name (Working)
**StoryForge** (working title)

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
Create a **simple, opinionated web app** that guides a user from *idea → niche → outline → chapters → full manuscript*, using:
- **ChatGPT API** for research, analysis, editing
- **Claude API** for long-form creative writing
- **Human approval gates** between every stage

The product should feel like a **guided production pipeline**, not a chat tool.

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

## Non-Goals
- No marketplace or social features (v1)
- No collaborative multi-user editing (v1)
- No direct KDP publishing integration (v1)

---

## Core User Journey (Happy Path)

1. User creates a **New Project**
2. User inputs:
   - Working title
   - Genre
   - Initial idea / premise
   - Optional external research (pasted text or upload)
3. App guides user through **locked stages**, one at a time
4. At each stage:
   - AI generates output
   - User reviews
   - User approves / edits / regenerates
5. Approved outputs become **canonical project documents**
6. User progresses to chapter drafting
7. Chapters are compiled into a full manuscript
8. User downloads manuscript as `.docx` or `.txt`

---

## Workflow Stages (Core Feature)

### Stage 0 – Project Setup (Manual)
**User inputs:**
- Project name
- Genre
- Intended niche (optional)
- Working premise
- Optional pasted research

**System action:**
- Create project container
- Initialise empty document set

---

### Stage 1 – Genre & Niche Research (ChatGPT API)

**Prompt Type:** Market analysis

**Inputs:**
- User premise
- Optional research

**Outputs:**
- Genre opportunities
- Underserved niches
- Emotional demand analysis

**User Actions:**
- Approve output
- Edit inline
- Regenerate

**Saved as:**
`Reference – Genre`

---

### Stage 2 – Niche Positioning & Audience (ChatGPT API)

**Prompt Type:** Publishing strategy

**Inputs:**
- Approved Genre reference

**Outputs:**
- Reader avatar
- Emotional promise
- Tropes to include / avoid

**Saved as:**
`Reference – Niche`

**Gate:** User must approve to continue

---

### Stage 3 – Ending First Development (Claude API)

**Prompt Type:** Developmental fiction planning

**Inputs:**
- Genre
- Niche reference
- Setting + protagonist notes

**Outputs:**
- 8–10 ending concepts
- Expanded selected ending

**User Flow:**
1. Review endings list
2. Select one
3. Generate expanded ending

**Saved as:**
`Reference – Ending`

---

### Stage 4 – Character Design (ChatGPT API)

**Prompt Type:** Character & continuity design

**Inputs:**
- Niche reference
- Ending reference

**Outputs:**
- Character list
- Full character profiles
- Relationship map

**Saved as:**
`Reference – Characters`

**Canon Lock:**
Once approved, characters are locked unless explicitly edited

---

### Stage 5 – Story Structure (Save the Cat) (ChatGPT API)

**Prompt Type:** Story architecture

**Inputs:**
- Characters
- Ending
- Niche

**Outputs:**
- 15-beat Save the Cat outline
- Chapter mapping
- Emotional arcs

**Saved as:**
`Reference – Story Structure`

---

### Stage 6 – Chapter Drafting (Claude API)

**Prompt Type:** Long-form creative writing

**Flow:**
- Chapters generated one at a time
- Each chapter tied to:
  - Specific beat
  - POV
  - Scene goal

**User Actions per chapter:**
- Approve
- Edit
- Regenerate
- Leave notes

**Saved as:**
`Chapter 01`, `Chapter 02`, etc.

**Constraints:**
- Claude receives only relevant references + prior chapters
- No retroactive canon changes allowed

---

### Stage 7 – Compilation (System)

**Functionality:**
- Combine all approved chapters
- Optional front/back matter

**Exports:**
- `.docx`
- `.txt`

---

### Stage 8 – Editorial Review (ChatGPT API)

**Prompt Type:** Senior editorial report

**Inputs:**
- Full compiled manuscript
- (Optional) Project canon references (Niche / Characters / Ending / Structure)

**Outputs:**
- Issue list with locations (chapter + approximate paragraph/scene)
- Categorised recommendations (continuity, character drift, pacing, prose, logic)
- Concrete fix suggestions

**Critical requirement:**
- The editorial output must be *structured for downstream chapter revisions* (see Stage 9).

---

### Stage 9 – Revision Loop (Chapter-by-Chapter Regeneration) (Claude API + ChatGPT API)

**Goal:** Apply editorial recommendations via controlled re-generation, chapter by chapter, with human approval.

**Inputs:**
- Editorial report (Stage 8)
- Chapter text (current approved version)
- Canon references (locked)

**Process:**
1. **Issue extraction & packaging (ChatGPT API):**
   - Convert the editorial report into a **Revision Queue**:
     - One revision task per chapter
     - Each task includes: issue summary, exact intent of fix, constraints, and acceptance criteria
2. **Chapter revision generation (Claude API):**
   - For a selected chapter, send:
     - Current chapter text
     - The chapter’s revision tasks
     - Relevant canon snippets (characters + outline beat + ending constraints)
   - Claude outputs a **revised chapter**.
3. **Diff + review:**
   - UI shows side-by-side comparison (old vs revised) with highlighted changes.
4. **User approval gate:**
   - Approve revised chapter → becomes new canonical chapter version
   - Reject → regenerate with adjusted notes
   - Partial accept (v1 optional): copy specific paragraphs from revised → manual merge

**Outputs:**
- Revised chapter versions (Chapter 01 v2, etc.)
- Updated compilation

**Constraints / Guardrails:**
- No new plot threads unless explicitly requested
- No canon changes without explicit user edits to canon documents
- Maintain tone and POV consistency

**End state:**
- “Revision complete” status when all tasks in the Revision Queue are resolved
- Recompile manuscript for export

---

## UI / UX Requirements

### Core Layout
- **Left sidebar:**
  - Project stages (visual progress tracker)
  - Green = approved, amber = in progress
- **Main panel:**
  - Current stage content
- **Right panel (optional):**
  - Reference docs quick view

### Project Overview Screen
- Title, genre, status
- List of reference documents
- List of chapters with word counts
- Jump-to-stage navigation

### Writing Interface
- Clean, distraction-free editor
- Version history per output (especially chapters)
- Inline notes
- Regenerate controls with model selection (where permitted)

### Revision Interface (Post-Editorial)
- **Revision Queue** view:
  - Chapters listed with number of open issues
  - Status badges: queued / in progress / done
- Chapter revision workspace:
  - Side-by-side diff (old vs revised)
  - Highlighted changes
  - Checklist of acceptance criteria
  - Approve / Reject / Regenerate with notes

---

## Technical Requirements (High Level)

### Hosting / Deployment
- **Vercel** for frontend hosting and serverless deployment
- Preview deployments per branch (staging-by-default)
- Environment variable management via Vercel (secrets for API keys)

### Frontend
- **Next.js (React)**
- App Router (recommended)
- Tailwind CSS (or equivalent utility-first CSS)
- Rich text editing component for long-form content (must handle 50k–150k word projects)

### Backend
Two viable patterns (choose one; both compatible with Vercel):

**Option A (recommended): Next.js Route Handlers**
- Use Next.js server actions / route handlers as API surface
- Keep prompt templates, model routing, and token policies server-side

**Option B: Separate API service**
- Node.js or Python (FastAPI) hosted on Vercel (where suitable) or separate hosting

### Database / Storage
- **Firebase**
  - Firestore for project/doc/chapter data
  - Firebase Storage for exports and optional uploads
  - Indexed queries for project overview, chapter list, revision queue

### Authentication
- **Firebase Authentication**
  - Google login (OAuth)
  - Optional: email/password (future)

### LLM Integration

**ChatGPT API** (research, planning, editing)
- Model routing per stage
- JSON-structured outputs where downstream processing is needed (editorial issues, revision tasks)

**Claude API** (chapter drafting, chapter revisions)
- Chapter-scoped context packaging
- Deterministic prompt templates with strict constraints (no canon edits)

### Key Engineering Constraints
- Token/window management:
  - Retrieve only necessary references per stage
  - For chapters: include *relevant* canon snippets + prior chapter recap, not the entire manuscript
- Versioning:
  - Immutable approved versions
  - Lineage tracking for revisions (v1 → v2)
- Reliability:
  - Retry + idempotency for LLM calls
  - Background-safe generation jobs (queue) if responses exceed typical serverless limits
- Security:
  - Never expose model API keys to the client
  - Per-user data isolation in Firestore rules

---

### Frontend
- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State Management:** React Context or lightweight state (e.g. Zustand)
- **Editor:** Rich text editor with diff support (e.g. TipTap / ProseMirror-based)

---

### Backend
- **Runtime:** Vercel Serverless Functions
- **API Style:** REST or lightweight RPC (Next.js route handlers)
- **Prompt orchestration:** Server-side only (never expose prompt templates to client)

---

### Authentication
- **Auth Provider:** Firebase Authentication
- **Login Methods:** Google OAuth (email/password optional future)
- **Session Handling:** Firebase ID tokens verified in serverless functions

---

### Database
- **Primary DB:** Firebase Firestore
- **Data Model Style:** Document-based with subcollections
- **Key Collections:**
  - projects
  - documents
  - chapters
  - chapter_versions
  - editorial_issues
  - revision_tasks

- **Indexes:**
  - project_id
  - chapter_number
  - status fields (for queues)

---

### File & Export Handling
- **Temporary file generation:** Serverless memory or short-lived storage
- **Docx generation:** Server-side (e.g. docx library)
- **Download:** Signed URLs or direct response stream

---

### LLM Integration

**ChatGPT API**
- Research
- Planning
- Editorial analysis
- Issue extraction

**Claude API**
- Chapter drafting
- Chapter regeneration

**Key constraints:**
- Strict token budgeting per stage
- Context assembly logic per stage (only send required references)
- Model routing handled server-side

---

### Security & Quotas
- Per-user project limits (configurable)
- Per-project token budgets
- Rate limiting per user
- Firestore security rules scoped by user ID

---

## Data Model (Simplified)

**Project**
- id
- title
- genre
- status

**Document**
- id
- project_id
- type (genre, niche, ending, character, structure, chapter, editorial)
- content
- version
- approved (boolean)
- created_at

**ChapterVersion** (recommended to model explicitly)
- id
- project_id
- chapter_number
- version
- content
- approved (boolean)
- parent_version_id (for lineage)

**EditorialIssue**
- id
- project_id
- chapter_number (nullable for global issues)
- location_hint (e.g., scene/paragraph estimate)
- category (continuity, character, pacing, prose, logic)
- description
- recommended_fix
- status (open/resolved)

**RevisionTask**
- id
- project_id
- chapter_number
- issue_ids[]
- instructions (packaged for Claude)
- acceptance_criteria
- status (queued/in_progress/done)

---

## Permissions & Safety
- Explicit user approval before progression
- Manual override to unlock stages
- Clear indication of model used per output

---

## Success Metrics
- Time from idea → first chapter
- Completion rate to full manuscript
- Chapters approved without regeneration
- Export usage

---

## Future Enhancements (Post‑v1)
- Series mode
- Style presets per pen name
- Scene-level drafting
- Beat-level rewrites
- Vellum-compatible export
- KDP metadata generation

---

## Summary
This product is a **guided fiction production system**, not a chatbot.

Its strength is:
- Structured prompts
- Canon enforcement
- Human-in-the-loop control
- Model specialization

Built correctly, it becomes a *repeatable novel factory* without sacrificing creative ownership.

