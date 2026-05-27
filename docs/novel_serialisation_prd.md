# Product Requirements Document (PRD) - Serialisation

**Product:** StoryForge
**Feature:** Serialisation (Royal Road)
**Parent doc:** [`novel_prd.md`](novel_prd.md)
**Related implementation docs:** [`novel-workflow-overview.md`](novel-workflow-overview.md), [`ai-stages-and-prompts.md`](ai-stages-and-prompts.md)
**Audience:** Product-level spec for the Serialisation feature. Implementation detail (stage keys, sidebar wiring, prompt content, generate-route handlers) belongs in the workflow overview and prompt docs.

---

## Purpose

Convert a completed novel into a serialised chapter set optimised for Royal Road, with re-pacing for web-fiction conventions and a feedback-driven ripple-edit loop for canon-aware revisions. Output is exported as formatted markdown for manual posting to Royal Road. No automated publishing in v1.

---

## Problem Statement

A finished commercial novel has chapter structure optimised for paperback reading: variable chapter length, scene transitions that suit print, and chapter-ends that close beats rather than open hooks. Royal Road expects the opposite: tight word-count bands (typically 2,000-3,500 words), strong cliffhangers at every chapter boundary, and a serialisation cadence where reader signal can influence later chapters.

Authors who want to cross-publish to Royal Road currently have to:

- Manually re-pace the novel into web-sized chapters
- Manually rewrite chapter endings for stronger hooks
- Manage two versions of canon when reader feedback shifts character arcs over a long serialisation run
- Format markdown into Royal Road's editor by hand

This is repetitive, error-prone, and breaks canon consistency over a long serialisation.

---

## Product Goal

Provide a guided, post-export production track that turns a completed manuscript into a Royal Road chapter set while:

- Preserving the KDP canonical version of the book by isolating all serialisation work behind a frozen boundary.
- Enabling reader-feedback-driven revisions that consult canon, propose downstream changes, and keep a full audit log of canon mutations.
- Producing per-chapter formatted markdown ready for manual paste into Royal Road's editor.

Serialisation should feel like a self-contained production track that begins where the KDP pipeline ends.

---

## Non-Goals

- No automated posting to Royal Road. Export is markdown-clipboard only in v1.
- No bidirectional sync between Royal Road and StoryForge.
- No modification of the KDP canonical chapters, manuscript, or Story Bible after Serialisation begins.
- No series-mode infrastructure (cross-book canon, shared characters across books). Series mode is a separate spec.
- No Royal Road metadata management (tags, descriptions, schedules) in v1. Author manages this in Royal Road's own dashboard.

---

## Position in Pipeline

Serialisation is a top-level sidebar group (peer to `Marketing`, `Cover`, `A+ Content`) and runs **outside `STAGE_ORDER`**. It does not block `export-final` and does not appear in the linear stage counter.

**Unlock rule:** Serialisation is unlocked when the project's `finalExportedAt` is set. Final export marks the KDP version as production-complete and triggers eligibility for Serialisation entry.

**Sequencing:**

1. KDP pipeline runs to completion (`setup` through `export-final`).
2. User optionally enters Serialisation.
3. Bible fork is established on entry (see [Bible Fork Mechanics](#bible-fork-mechanics)).
4. Serialisation proceeds as a self-contained track.

**Reversibility:** Returning to earlier KDP stages remains possible per existing rules. However, edits to KDP-canonical chapters or Story Bible after Serialisation entry are flagged in the UI, since Serialisation works from a frozen source. Edits force an explicit "discard RR canon" action.

---

## Core User Journey (Happy Path)

1. User completes the KDP pipeline; `finalExportedAt` is set.
2. User enters the Serialisation sidebar group; bible fork is created.
3. User selects the source manuscript: either the last compiled manuscript or an uploaded markdown file with post-export edits.
4. Source is parsed into scenes; the chapter-mapping engine proposes Royal Road chapter boundaries.
5. User reviews the proposed mapping in a side-by-side view, adjusts boundaries with drag-and-drop dividers, merges or splits chunks.
6. For each proposed chapter, user sees a hook score and can opt in to AI-generated cliffhanger enhancements.
7. User reviews enhancement diffs per chapter, approves or rejects.
8. Serialised chapters are saved as a distinct document set.
9. User exports each chapter as formatted markdown, pastes into Royal Road manually.
10. Over time, user attaches feedback notes to individual chapters or arcs. Each feedback triggers a canon-impact analysis.
11. If the feedback mutates canon, an RR bible delta is proposed; user approves the canon change.
12. Approved delta spawns revision tasks for downstream chapters; user reviews and approves each task.
13. (Future) User promotes the completed serialisation back into a KDP v2 manuscript and seeds the next book.

---

## Workflow Stages

Stages use the prefix `serial-` and live outside `STAGE_ORDER`.

### Stage S0 - Serialisation Setup (`serial-setup`) (System)

**Entry conditions:**

- Project's `finalExportedAt` is set.
- User explicitly opts in to enter Serialisation.

**System actions:**

- Set `serialisationEnteredAt` on the project.
- Create `story-bible-rr` document by cloning the approved `story-bible`.
- Create empty `serial-chapter-mapping` artifact.
- Initialise `bible_deltas` log for the project.
- Lock KDP-side `story-bible` and `chapters` against mutation.

**Outputs:** Forked RR bible, empty serialisation workspace.

*Does not call `/api/generate`.*

---

### Stage S1 - Source Selection (`serial-source`) (System)

**User inputs:**

- Option A: Use last compiled manuscript (default).
- Option B: Upload a markdown file containing the post-export edited version.

**System actions on upload:**

- Parse markdown into chapter and scene structure (chapter headings, scene-break markers).
- Compute parsed-diff against the existing compiled manuscript.
- Surface diff to user for confirmation (catches half-uploaded files, wrong-version uploads, accidental structural changes).

**Outputs:** Approved `source-manuscript` artifact, version-tracked.

*Does not call `/api/generate`. Parsing is deterministic.*

---

### Stage S2 - Re-pacing (`serial-mapping`) (OpenAI + System)

**Phase 1: Scene parse (System, deterministic).**
Tokenise source manuscript by scene-break markers (`***`, `# # #`, or equivalents). Produce a flat scene list with word counts and source-chapter associations.

**Phase 2: Hook scoring (`serial-hook-score`, OpenAI, structured output).**
For each scene-end, score hook strength against the RR bible. Categories include: question raised, tension level, character stakes, momentum carried.

Structured JSON output per scene: `{sceneId, hookScore: 0-10, categories: {...}, weakHookFlag: bool, rationale}`.

**Phase 3: Repartition (`serial-repartition`, OpenAI, structured output).**
Group scenes into RR-sized chapter chunks (target 2,000-3,500 words, user-configurable). Constraint: maximise sum of boundary hook scores while respecting word-count band. Output: ordered `serial-chapter` definitions with constituent scenes and proposed titles.

**User actions:**

- Side-by-side view: source chapters on the left, proposed RR chapters on the right.
- Drag-and-drop dividers to override boundaries.
- Merge / split chunks manually.
- See per-chunk hook score and word count live.
- Approve mapping to lock it.

**Outputs:** Approved `serial-chapter-mapping`, ordered set of `serial-chapter` definitions.

---

### Stage S3 - Enhancement (`serial-enhance`) (Anthropic, per-chapter opt-in)

**Inputs:** Approved serial chapter, hook score, RR bible.

**System action:**
For chapters flagged with weak hooks, propose enhancement: appended closing beat, sharpened final paragraph, or structural suggestion (scene reorder within the chunk). For chapters with strong hooks, enhancement is available on request but not flagged.

**User actions:**

- Review enhancement as inline diff against the source scenes.
- Approve, reject, or regenerate with notes.

**Outputs:** New `serial-chapter` version with enhancement applied (if approved). Original source content preserved in version history.

**Constraint:** Enhancement may add up to a configurable percentage of chapter word count (default 10%) to avoid invasive rewrites. Beyond that threshold, the user is warned.

---

### Stage S4 - Export (`serial-export`) (System)

**Per-chapter action:**

- Render serial chapter content as Royal Road-flavoured markdown:
  - Italics for thoughts and emphasis.
  - Bold for system messages where present.
  - Scene breaks as `***` centred line.
  - Smart quotes preserved.
  - Optional pre / post author notes (separate fields, not embedded in chapter content).
- "Copy to clipboard" action.
- "Open in Royal Road" action: opens `https://www.royalroad.com/fiction/{id}/chapter/new` if `royalRoadFictionId` is set; the generic new-chapter URL otherwise.

**Outputs:** Formatted markdown on clipboard. No persisted export artifact required (chapter content remains the source of truth).

*Does not call `/api/generate`. Rendering is deterministic.*

---

## Feedback Loop (Stage F, Ongoing)

The feedback loop is not a linear stage. It can be entered repeatedly at any point after Serialisation setup, including after export.

### Sub-stage F1 - Feedback Capture (`serial-feedback`)

**User inputs:**

- Scope: single chapter, or arc spanning multiple chapters.
- Feedback body: free-form note (e.g. "Sarah's reaction in this chapter is too cold given her arc").
- Optional: explicit tag of bible entries the user believes are involved (character, world rule, theme).

**Outputs:** Persisted `serial-feedback` artifact, scoped and timestamped.

---

### Sub-stage F2 - Canon Impact Analysis (`serial-feedback-impact`) (OpenAI, structured output)

**Inputs:** Feedback artifact, current RR bible, all serial chapters.

**System action:**

- Classify feedback type: *canon-altering* (changes a bible entry) or *local prose adjustment* (no canon change).
- If canon-altering:
  - Propose a structured bible delta: `{biblePath, before, after, rationale}`.
  - Run impact analysis across all serial chapters via semantic retrieval plus per-scene classification.
  - Output: list of impacted chapters with reasoning.
- If local-only:
  - Skip bible delta. Generate a single revision task for the feedback's named chapter.

**Outputs:** Proposed `bible-delta` (if canon-altering) and impact list.

**Note on arc-scoped feedback:** The chapter range named in arc-scoped feedback is the *seed*, not the *scope*. Impact analysis still scans all subsequent serial chapters, since a canon change can affect chapters the user did not name. UI must make this explicit.

---

### Sub-stage F3 - Bible Delta Approval (System + User)

**User actions:**

- Review proposed bible delta with before / after diff.
- Approve, reject, or edit the delta.

**System actions on approval:**

- Apply delta to `story-bible-rr`.
- Append entry to `bible_deltas` log: trigger feedback ID, before / after, approved-at, approving-user, list of chapters that will receive revision tasks.
- Generate revision tasks for each impacted chapter (subject to the one-open-task safeguard).

**Constraint:** Downstream revision tasks cannot be generated until the bible delta is approved or rejected.

---

### Sub-stage F4 - Revision Tasks (`serial-revision-task`)

**Per-chapter task:**

- Reuses existing `revision_tasks` table with serial scope flag.
- Task carries `triggered_by_delta_id` and `triggered_by_feedback_id` for traceability.

**Safeguard: one open task per chapter.**
A chapter can have at most one open revision task at a time. If new feedback would generate a task for a chapter that already has one open, the new task is *queued*, not created. UI shows: "Chapter N has unresolved revisions; this feedback will apply once those are approved."

**User actions:**

- Review proposed chapter revision as side-by-side diff.
- Approve → new `serial-chapter` version.
- Reject → task is dismissed; bible delta remains in place (delta and revision are separately reversible).

---

### Sub-stage F5 - Rollback

**Per-delta rollback:**

- User can roll back any approved delta from the `bible_deltas` log.
- Rollback reverses the bible mutation *and* all `serial-chapter` versions generated from that delta cluster.
- Chapters revert to their pre-delta version (chapter versioning preserves this lineage).
- Rollback is recorded as a new append-only entry in `bible_deltas` (the log is append-only; rollback is recorded as a reversal event, not a deletion).

---

## Bible Fork Mechanics

The bible fork is load-bearing for the entire Serialisation feature. It establishes a clean boundary between KDP canon and RR canon, and makes the future promote-back feature tractable.

### Fork Timing

**Eager fork.** `story-bible-rr` is created at Stage S0 entry, before any feedback has been submitted. The boundary is unambiguous in the UI from the moment Serialisation begins. Lazy forking is rejected: it creates intermediate states where the user does not know which bible they are looking at.

### Fork Rules

- On fork: `story-bible-rr` is a deep copy of the approved `story-bible` at the moment of Serialisation entry. The source bible's id is recorded as `forkedFromBibleId` on the RR bible.
- `story-bible` is locked for mutation while `serialisationEnteredAt` is set. Edits to KDP canon require an explicit "discard RR canon" action, which deletes the RR bible and all serialisation state and is irreversible.
- `story-bible-rr` is the canon source for all Serialisation-stage prompts (impact analysis, enhancement, repartition).
- The KDP-stage `story-bible` remains the canon source for any KDP-side flows that may still run (e.g. late marketing prompts).

### Bible Delta Log

The `bible_deltas` table records every mutation:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `project_id` | uuid | FK |
| `bible_id` | uuid | FK to `story-bible-rr` |
| `triggered_by_feedback_id` | uuid | FK to `serial-feedback` |
| `before_json` | text | Bible entry state before delta |
| `after_json` | text | Bible entry state after delta |
| `bible_path` | text | Dotted path to the affected entry (e.g. `characters.sarah.motivation`) |
| `rationale` | text | LLM-generated explanation, may be edited by user before approval |
| `approved_at` | timestamp | Null if pending |
| `approved_by` | text | User identifier |
| `reversal_of_id` | uuid | If this entry reverses a prior delta |
| `affected_chapter_ids_json` | text | List of chapters that received revision tasks |
| `created_at` | timestamp | |

The log is append-only. It is the source of truth for any future promote-back feature.

---

## Data Model Additions

### Project fields

- `serialisationEnabled: boolean` - Whether the project has Serialisation as an available track.
- `serialisationEnteredAt: timestamp | null` - Set on Stage S0 completion.
- `serialisationStatus: 'not_started' | 'in_progress' | 'completed'`
- `serialSourceDocumentId: uuid | null` - Currently selected `source-manuscript`.
- `serialBibleId: uuid | null` - Pointer to `story-bible-rr`.
- `royalRoadFictionId: text | null` - Optional, for export URL deep-linking.

### New document types

- `source-manuscript` - Markdown source, versioned. Either the compiled manuscript or an uploaded post-export edit.
- `story-bible-rr` - Forked RR canon, versioned.
- `serial-chapter-mapping` - Mapping from source scenes to serial chapters.
- `serial-chapter` - Individual RR chapter, versioned (carries `pre_note`, `post_note`, `hook_score`).
- `serial-feedback` - Feedback note, chapter- or arc-scoped.

### New tables

- `bible_deltas` - Schema above.
- `serial_chapters` - If not modelled as documents: `id`, `project_id`, `ordinal`, `title`, `content`, `version`, `parent_version_id`, `pre_note`, `post_note`, `hook_score`, `mapping_id`.
- `serial_feedback` - `id`, `project_id`, `scope` (`chapter` | `arc`), `chapter_ids_json`, `body`, `created_at`, `status`.

### Reused tables

- `revision_tasks` - Extended with `serial_scope: boolean`, `triggered_by_delta_id: uuid`, `triggered_by_feedback_id: uuid`.

---

## Generation API Contract

New stages routed through `POST /api/generate`:

**Re-pacing:**

- `serial-hook-score` - Score scene-ends; structured JSON output.
- `serial-repartition` - Group scenes into RR chapters; structured JSON output.
- `serial-enhance` - Generate cliffhanger enhancement for a flagged chapter.

**Feedback loop:**

- `serial-feedback-impact` - Classify feedback and run canon impact analysis; structured JSON output (bible delta proposal plus impacted chapter list).
- `serial-revision` - Apply revision to a chapter from a delta-triggered task. May reuse the existing `revision` stage with a serial scope flag; implementation choice.

**Bible:**

- `story-bible-rr` is not regenerated by an LLM. It is mutated only through approved `bible_deltas`. No `/api/generate` stage required.

**Stages that do not use `/api/generate`:**

- `serial-setup`, `serial-source`, `serial-export`. All deterministic.

---

## UI / UX Requirements

### Sidebar group

New top-level group `Serialisation`, peer to `Marketing`, `Cover`, `A+ Content`. Locked until `finalExportedAt` is set.

### Sub-navigation

Pill-style sub-nav matching the existing Marketing / Cover pattern:

- **Setup** - Entry confirmation, fork status, source selection summary.
- **Source** - Upload / compiled selector, parsed-diff confirmation view.
- **Mapping** - Side-by-side scene-to-chapter mapping editor.
- **Enhancement** - Per-chapter hook score view, enhancement opt-in, diff review.
- **Feedback & Canon** - Feedback inbox, bible delta log, RR bible viewer, revision task queue.
- **Chapters** - Per-chapter editor list with status (draft / enhanced / revised / exported).
- **Export** - Per-chapter clipboard export and RR-link launcher.

### Mapping editor (Stage S2)

- Two-column layout: source manuscript chapters on the left, proposed RR chapters on the right.
- Drag-and-drop dividers between scenes to reassign scene-to-chapter membership.
- Per-chunk inline display: word count, hook score (colour-coded), weak-hook flag, scene count.
- "Recompute mapping" action regenerates the proposal from current scene scores.

### Feedback & Canon panel

- **Feedback inbox** - list of submitted feedback, scope, status (pending impact / pending delta approval / pending revisions / complete).
- **Bible delta log** - chronological timeline of canon mutations, each expandable to before / after diff, with rollback action.
- **RR bible viewer** - read-only by default, with "compare to KDP bible" toggle showing divergences.
- **Revision task queue** - per-chapter open tasks with delta provenance, side-by-side diff, approve / reject / regenerate.

### Per-chapter status indicators

Sidebar chapter entries show: draft (grey), enhanced (amber), exported (green), has-pending-revision (red dot).

### Source change warning

If the user attempts to change the source manuscript after mapping is approved, a confirmation dialog warns that the existing mapping and chapter versions will be invalidated and must be regenerated. Feedback artifacts and bible deltas are preserved.

---

## Safeguards & Constraints

- **Final export required.** Serialisation cannot be entered until `finalExportedAt` is set.
- **Eager bible fork.** `story-bible-rr` is created on Stage S0 entry, not lazily on first mutation.
- **KDP canon lock.** While `serialisationEnteredAt` is set, the KDP `story-bible` and `chapters` cannot be edited without an explicit "discard RR canon" action.
- **One open revision task per chapter.** New tasks targeting a chapter with an open task are queued, not created.
- **Bible delta approval gates downstream revisions.** Revision tasks are not generated until the delta is approved.
- **Append-only delta log.** Rollbacks are recorded as new reversal entries, not deletions.
- **Enhancement word-count cap.** Enhancement may add up to 10% of chapter word count by default; user is warned beyond that.
- **Manual export only.** No automated posting to Royal Road in v1.

---

## Edge Cases & Known Limitations

- **Flashback ordering.** "Later chapters" in impact analysis means *subsequent in serialisation order*, which is almost always equivalent to forward chronological story time. Flashback-heavy novels (a serial chapter 12 covering events before serial chapter 8) are an acknowledged edge case in v1; impact analysis may surface false negatives. Manual user override available.
- **Cascading canon changes.** A bible delta from feedback on chapter 4 may, after revisions are applied, surface new inconsistencies in chapter 10 that were not visible at impact-analysis time. v1 does not auto-rerun impact analysis after revisions are applied. User can submit follow-up feedback explicitly.
- **Arc-scope feedback impact is still global.** Arc-scoped feedback names a chapter range as the seed, but impact analysis still scans all subsequent chapters. UI must make this clear so the user is not surprised by changes to chapters they did not name.
- **Manuscript upload structural mismatch.** If the uploaded markdown has a different chapter count or scene count from the compiled version, the parsed-diff view should clearly highlight added / removed chapters, not just word-level diffs.
- **Long serialisation runs.** The `bible_deltas` log will grow unbounded. UI must paginate and filter (by chapter, by character, by date).

---

## Phased Build

**Phase 1: Re-pacing engine (no feedback loop)**

- Stage S0 setup with eager bible fork.
- Stage S1 source selection with markdown upload and parsed-diff.
- Stage S2 mapping with hook scoring and repartition.
- Stage S3 enhancement with opt-in per chapter.
- Stage S4 markdown export to clipboard.
- Sidebar group, sub-nav, mapping editor UI.

**Phase 2: Feedback loop (chapter scope)**

- Feedback capture (chapter scope only).
- Canon impact analysis with bible delta proposals.
- Bible delta approval flow plus `bible_deltas` log.
- Per-chapter revision tasks with one-open-task safeguard.
- Feedback & Canon panel with bible delta log timeline.

**Phase 3: Arc-scope feedback and rollback**

- Arc-scoped feedback.
- Per-delta rollback action.
- RR bible viewer with compare-to-KDP-bible toggle.
- Cascading canon-change detection (optional, may defer).

**Phase 4: Future, separate specs**

- Promote-back-to-KDP-v2 with delta-log-driven reconciliation UI.
- Seed-next-book flow (depends on series-mode spec).
- Royal Road metadata management.
- Public-page scraper for stats.
- Optional automated posting via headless browser (opt-in, with clear user warnings).

---

## Success Metrics

- Time from `export-final` to first chapter ready for posting.
- Number of chapters posted to Royal Road from a single Serialisation track.
- Bible delta count per Serialisation track (signal of feedback engagement).
- Revision task approval rate (signal of impact-analysis quality).
- User-reported satisfaction with hook strength after enhancement.

---

## Future Enhancements (Post-v1)

- **Promote-back-to-KDP-v2:** delta-log-driven reconciliation UI that lets the user fold approved RR canon changes back into the KDP bible, producing a KDP v2 manuscript from the revised serial chapters.
- **Seed-next-book:** use the completed RR bible and final manuscript as input to a new project's planning phase. Depends on series-mode spec.
- **Royal Road metadata management:** fiction title, tags, content warnings, release schedule.
- **Public-page scraper:** ingest views, followers, ratings into an in-app stats dashboard.
- **Automated posting (opt-in):** Playwright-based posting from Electron, with explicit user warnings about Royal Road's automation expectations.
- **Cliffhanger enhancement model selection:** per chapter or project-wide.
- **Per-chapter Patreon-advance tracking:** indicator showing how many chapters are queued ahead on Patreon.

---

## Summary

Serialisation is a guided post-export production track that turns a completed novel into a Royal Road chapter set, with re-pacing for web-fiction conventions and a canon-aware feedback loop for ripple-edits. It runs outside `STAGE_ORDER`, isolates all changes behind a forked RR Story Bible, keeps an append-only log of every canon mutation, and exports formatted markdown for manual posting. The KDP canonical version remains untouched, preserving the option to ship the polished novel to Amazon while the serialisation runs in parallel.
