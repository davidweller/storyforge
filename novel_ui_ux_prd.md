# UI / UX Product Requirements Document (UI PRD)

## Purpose
This document defines the **user interface and user experience requirements** for the AI Novel Workflow Web App.

The UI must support a **structured, human-in-the-loop fiction production workflow**, prioritising clarity, control, and trust over speed or novelty.

This UI PRD is intentionally opinionated: the product should *guide* users, not overwhelm them.

---

## Design Principles (Non-Negotiable)

1. **Pipeline, Not Chat**
   - The UI must never resemble a conversational chat interface
   - Users progress through clearly defined stages

2. **Explicit Progress & State**
   - Users should always know:
     - where they are
     - what is complete
     - what is locked

3. **Human Authority**
   - Nothing becomes canonical without explicit approval
   - Regeneration is scoped and reversible

4. **Low Cognitive Load**
   - Minimal visual noise
   - No hidden system behaviour

5. **Trust Through Transparency**
   - Clearly show which model produced which output
   - Allow users to inspect context inputs when relevant

---

## Global Layout

### Primary Layout Structure

The application uses a **persistent workflow layout**:

```
┌─────────────┬──────────────────────────┬──────────────┐
│ Workflow    │ Main Work Surface         │ Context      │
│ Sidebar     │                          │ Drawer       │
└─────────────┴──────────────────────────┴──────────────┘
```

### A. Workflow Sidebar (Persistent)

**Purpose:** Orientation and navigation

**Contents:**
- Project title
- Vertical list of workflow stages
- Nested chapters under “Chapters”

**Visual states:**
- Grey: not started
- Amber: in progress
- Green: approved
- Red indicator: requires attention

**Behaviour:**
- Click any stage to navigate
- Locked stages show lock icon

---

### B. Main Work Surface

**Purpose:** Execute the current task

Varies by stage:
- Structured document viewer/editor
- Chapter writing editor
- Editorial issue viewer
- Revision diff view

Design requirements:
- Distraction-free
- Large readable text
- Clear hierarchy

---

### C. Context Drawer (Collapsible)

**Purpose:** Provide reference without clutter

**Contents (contextual):**
- Locked canon documents
- Character cheat sheet
- Beat summary
- Ending constraints
- Optional “What the AI sees” toggle

---

## Screen-Level Requirements

## 1. Project Dashboard

**Purpose:** Immediate project orientation

**Required elements:**
- Project title
- Genre
- Overall status
- Progress bar (Idea → Draft → Revised → Export)
- Key stats:
  - Chapters approved
  - Total word count
  - Last activity

**Primary CTA:**
- “Continue where I left off”

---

## 2. Research & Planning Screens (Stages 1–5)

**Shared pattern across stages**

### Header
- Stage name
- Description
- Model used (ChatGPT)

### Main content
- AI-generated structured output
- Editable until approved

### Bottom action bar (sticky)
- Approve & continue
- Regenerate
- Edit manually
- Leave internal note

**Post-approval behaviour:**
- Content becomes read-only
- Lock icon displayed

---

## 3. Chapter Writing Screen

**Purpose:** Focused long-form drafting

### Header bar
- Chapter number + title
- Story beat reference
- Word count
- Model indicator (Claude)

### Main editor
- Rich text editor
- Autosave
- No markdown noise

### Context drawer (high importance)
- Character summaries
- Current beat intent
- Ending reminder

### Actions
- Approve chapter
- Regenerate chapter
- Add notes
- Navigate to adjacent chapters

**Approval result:**
- Chapter becomes immutable v1
- Version badge shown

---

## 4. Editorial Review Screen

**Purpose:** Diagnosis, not editing

### Layout
- Left panel: chapter list with issue counts
- Main panel: editorial issues grouped by category

Each issue shows:
- Chapter reference
- Problem description
- Recommended fix

**Primary CTA:**
- “Create Revision Queue”

---

## 5. Revision Queue Screen

**Purpose:** Controlled application of editorial fixes

### Queue view
- List of chapters
- Number of unresolved issues
- Status badge (queued / in progress / done)

Selecting a chapter opens the Revision Workspace.

---

## 6. Revision Workspace (Chapter-Level)

**Purpose:** Review and approve revised chapters

### Top section
- Chapter identifier
- List of issues being addressed (checklist)

### Main area
- Side-by-side diff view:
  - Left: original chapter (read-only)
  - Right: revised chapter
- Highlighted changes

### Right panel
- Acceptance criteria
- Canon reminders

### Actions
- Approve revision → new version becomes canonical
- Regenerate with notes
- Reject revision

---

## 7. Export Screen

**Purpose:** Final output delivery

**Options:**
- Compile manuscript
- Include/exclude front/back matter
- Export formats:
  - .docx
  - .txt

**Display:**
- Final word count
- Revision status

---

## Interaction Rules & Safeguards

- No global regenerate actions
- Regeneration is always scoped
- Approved content is immutable
- Clear visual confirmation for approvals

---

## Accessibility & Usability

- Keyboard navigation supported
- High-contrast mode
- Large default font sizes

---

## UX Anti-Patterns to Avoid

- Chat bubbles
- Infinite scrolling conversations
- Hidden auto-changes
- Ambiguous progress states

---

## Success Indicators

- Users can explain their current stage in under 5 seconds
- Users feel confident approving content
- Projects feel finite, not endless

---

## Summary

This UI is designed to make novel production feel:
- Manageable
- Intentional
- Professional

If the backend is the engine, this UI is the **dashboard**, not the playground.

