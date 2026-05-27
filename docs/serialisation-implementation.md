# Serialisation Implementation Overview

**Companion to:** [`novel_serialisation_prd.md`](novel_serialisation_prd.md)
**Sister docs:** [`novel-workflow-overview.md`](novel-workflow-overview.md), [`ai-stages-and-prompts.md`](ai-stages-and-prompts.md)
**Audience:** Engineering. Stage keys, route wiring, schema migrations, sidebar config, state transitions. Product-level rationale lives in the PRD; this doc is wiring and shape.

---

## 1. Stage Keys

Extend the existing `WorkflowStage` union with serial-prefixed keys. Serial stages live outside `STAGE_ORDER` (similar to marketing, cover-*, and aplus-* stages).

```ts
type SerialStage =
  | 'serial-setup'           // deterministic; transition handler
  | 'serial-source'          // deterministic; upload + parse
  | 'serial-mapping'         // composite stage; UX-facing
  | 'serial-hook-score'      // /api/generate
  | 'serial-repartition'     // /api/generate
  | 'serial-enhance'         // /api/generate
  | 'serial-feedback'        // deterministic; capture
  | 'serial-feedback-impact' // /api/generate
  | 'serial-revision'        // /api/generate (see Section 6.5)
  | 'serial-export';         // deterministic; markdown render
```

`serial-mapping` is the UX-facing stage. Under the hood it dispatches `serial-hook-score` then `serial-repartition` as two distinct generate calls. Keep them separate at the route layer so each can be regenerated independently and cached separately.

---

## 2. Document Types

Add to the document type union:

- `source-manuscript` - markdown source, versioned
- `story-bible-rr` - forked RR canon, versioned
- `serial-chapter-mapping` - mapping artifact (JSON content)

`serial-chapter` content does **not** live in `documents`. It lives in a dedicated table, paralleling how `chapters` and `chapter_versions` are separate from `documents` today.

`serial-feedback` is also a dedicated table, not a document type. The artifact is structured and small; the document store is overkill.

---

## 3. Schema Migrations

### 3.1 Project additions

```sql
ALTER TABLE projects
  ADD COLUMN serialisation_enabled INTEGER DEFAULT 0,
  ADD COLUMN serialisation_entered_at TEXT,
  ADD COLUMN serialisation_status TEXT DEFAULT 'not_started',
  ADD COLUMN serial_source_document_id TEXT,
  ADD COLUMN serial_bible_id TEXT,
  ADD COLUMN royal_road_fiction_id TEXT;
```

`serialisation_status` enum: `'not_started' | 'in_progress' | 'completed'`.

### 3.2 New tables

```sql
CREATE TABLE serial_chapters (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  ordinal INTEGER NOT NULL,
  title TEXT NOT NULL,
  hook_score REAL,
  hook_categories_json TEXT,
  mapping_id TEXT NOT NULL,            -- FK to documents.id (type='serial-chapter-mapping')
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (project_id, ordinal)
);

CREATE TABLE serial_chapter_versions (
  id TEXT PRIMARY KEY,
  serial_chapter_id TEXT NOT NULL REFERENCES serial_chapters(id),
  version INTEGER NOT NULL,
  parent_version_id TEXT,
  content TEXT NOT NULL,               -- markdown
  pre_note TEXT,
  post_note TEXT,
  triggered_by_delta_id TEXT,          -- nullable; FK to bible_deltas if revision-derived
  triggered_by_feedback_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (serial_chapter_id, version)
);

CREATE TABLE serial_feedback (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  scope TEXT NOT NULL,                 -- 'chapter' | 'arc'
  chapter_ids_json TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_impact',
  -- 'pending_impact' | 'pending_delta' | 'pending_revisions' | 'complete' | 'dismissed'
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bible_deltas (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  bible_id TEXT NOT NULL,              -- FK to documents.id (type='story-bible-rr')
  triggered_by_feedback_id TEXT NOT NULL REFERENCES serial_feedback(id),
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  bible_path TEXT NOT NULL,
  rationale TEXT,
  approved_at TEXT,
  approved_by TEXT,
  reversal_of_id TEXT REFERENCES bible_deltas(id),
  affected_chapter_ids_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bible_deltas_project ON bible_deltas(project_id, created_at);
CREATE INDEX idx_serial_feedback_project ON serial_feedback(project_id, created_at);
```

### 3.3 Extend `revision_tasks`

```sql
ALTER TABLE revision_tasks
  ADD COLUMN serial_scope INTEGER DEFAULT 0,
  ADD COLUMN serial_chapter_id TEXT,
  ADD COLUMN triggered_by_delta_id TEXT,
  ADD COLUMN triggered_by_feedback_id TEXT;
```

When `serial_scope=1`, `serial_chapter_id` is populated instead of the existing `chapter_id`. Enforce mutual exclusion in the data access layer (SQLite CHECK constraints are workable but historically annoying with `better-sqlite3` migrations; pick whichever fits your existing pattern).

---

## 4. Sidebar Wiring

Add a new sidebar group, peer to Marketing, Cover, and A+ Content.

```ts
const SERIALISATION_GROUP: SidebarGroup = {
  key: 'serialisation',
  label: 'Serialisation',
  lock: (project) => !project.finalExportedAt
    ? { locked: true, reason: 'Complete the KDP export first.' }
    : { locked: false },
  items: [
    { key: 'setup',       label: 'Setup',            route: '/project/[id]/serial/setup' },
    { key: 'source',      label: 'Source',           route: '/project/[id]/serial/source' },
    { key: 'mapping',     label: 'Mapping',          route: '/project/[id]/serial/mapping' },
    { key: 'enhancement', label: 'Enhancement',      route: '/project/[id]/serial/enhancement' },
    { key: 'chapters',    label: 'Chapters',         route: '/project/[id]/serial/chapters' },
    { key: 'feedback',    label: 'Feedback & Canon', route: '/project/[id]/serial/feedback' },
    { key: 'export',      label: 'Export',           route: '/project/[id]/serial/export' },
  ],
};
```

Per-item lock predicates:

| Item | Lock predicate |
|---|---|
| `setup` | always available once the group is unlocked |
| `source` | requires `serialisation_entered_at` |
| `mapping` | requires `serial_source_document_id` set and approved |
| `enhancement` | requires approved `serial-chapter-mapping` |
| `chapters` | requires approved `serial-chapter-mapping` |
| `feedback` | requires at least one `serial_chapter` row |
| `export` | requires at least one `serial_chapter` with a current version |

Per-chapter entries appear under `chapters` once they exist, mirroring how Writing/Per-chapter is built today.

---

## 5. State Transitions

```
serialisation_status:
  not_started ─[user enters S0]──────────▶ in_progress
  in_progress ─[user marks complete]─────▶ completed
  in_progress ─[user discards RR canon]──▶ not_started   (destructive)
  completed   ─[user reopens]────────────▶ in_progress
```

### 5.1 Side effects on transition into `in_progress`

1. Insert `documents(type='story-bible-rr')` cloning current approved `story-bible` content; record `forkedFromBibleId` in the document's metadata.
2. Set `serial_bible_id` on the project to the new bible's id.
3. Set `serialisation_entered_at = now()`.
4. Set `serialisation_status = 'in_progress'`.
5. Activate the KDP lock predicate (Section 7).

All five must run in a single transaction. If any step fails, roll back and surface the error; the project must never be left in a partial fork state.

### 5.2 Side effects on discard

Cascade delete (in order, in a single transaction):

- `serial_chapter_versions` for the project
- `serial_chapters` for the project
- `serial_feedback` for the project
- `bible_deltas` for the project
- `revision_tasks WHERE serial_scope=1 AND project_id=?`
- `documents WHERE project_id=? AND type IN ('story-bible-rr', 'serial-chapter-mapping')`
- `documents WHERE project_id=? AND type='source-manuscript' AND uploaded_at > serialisation_entered_at`

The source-manuscript filter is conservative: uploads made *after* entering Serialisation are dropped; compiled manuscripts from before entry are untouched.

Reset project fields:

```sql
UPDATE projects
   SET serialisation_status = 'not_started',
       serialisation_entered_at = NULL,
       serial_source_document_id = NULL,
       serial_bible_id = NULL
 WHERE id = ?;
```

Discard requires explicit confirmation in the UI with a typed confirmation token (e.g. user types the project name to confirm). This is irreversible.

---

## 6. Generate Route Contracts

All routed through `POST /api/generate`, payload shape `{ stage, data, model?, projectId }`. Response shape matches the existing generate contract.

### 6.1 `serial-hook-score`

Request `data`:

```ts
{
  sceneList: Array<{
    sceneId: string;
    text: string;            // tail-of-scene window; default last 500 words
    sourceChapterRef?: string;
  }>;
  rrBibleExcerpt: string;    // promises, character stakes, ongoing arcs
}
```

Send a tail-of-scene window rather than full scenes. Default 500 words, configurable per project. Reduces token use materially on long books with no meaningful loss of hook signal.

Response (structured JSON, schema-validated, repair pass on failure):

```ts
{
  scores: Array<{
    sceneId: string;
    hookScore: number;       // 0-10
    categories: {
      questionRaised: number;
      tension: number;
      stakes: number;
      momentum: number;
    };
    weakHookFlag: boolean;   // true if hookScore < 5 by convention
    rationale: string;       // one sentence
  }>;
}
```

### 6.2 `serial-repartition`

Request `data`:

```ts
{
  scenes: Array<{ sceneId: string; wordCount: number; hookScore: number; }>;
  targetMin: number;         // default 2000
  targetMax: number;         // default 3500
  hardMax: number;           // default 4500
}
```

Response:

```ts
{
  chapters: Array<{
    ordinal: number;
    title: string;            // proposed; user-editable
    sceneIds: string[];
    estimatedWordCount: number;
    boundaryHookScore: number; // == hookScore of final scene in chapter
  }>;
}
```

Server-side validation: if any chapter exceeds `hardMax` or falls below `targetMin/2`, run a single repair pass. If repair fails, return the invalid mapping with a `validationErrors` array attached and let the UI flag it; never auto-discard.

### 6.3 `serial-enhance`

Request `data`:

```ts
{
  chapterId: string;
  chapterContent: string;
  hookScore: number;
  bibleExcerpt: string;
  enhancementMode: 'closing_beat' | 'sharpen_final' | 'scene_reorder_suggestion';
  maxAddedWords: number;     // cap per project settings; default 10% of chapter wordCount
}
```

Response:

```ts
{
  proposal: {
    mode: string;
    diff: string;            // unified diff of original to proposed
    addedWordCount: number;
    rationale: string;
  };
}
```

`scene_reorder_suggestion` returns a textual recommendation, not new prose. The UI surfaces it as an info-only suggestion the user implements manually via the mapping editor.

### 6.4 `serial-feedback-impact`

Request `data`:

```ts
{
  feedbackId: string;
  feedbackBody: string;
  scope: 'chapter' | 'arc';
  seedChapterIds: string[];
  rrBible: object;           // full RR bible, JSON form
  serialChaptersIndex: Array<{
    serialChapterId: string;
    ordinal: number;
    summary: string;         // pre-computed chapter summary
  }>;
}
```

Use chapter summaries, not full content, for the impact-scan input. Full chapter content is only fetched for chapters the model flags as candidates, in a second pass. This keeps the impact analysis under a manageable token budget even for 80-chapter serialisations.

Response:

```ts
{
  classification: 'canon_altering' | 'local_prose';
  proposedDelta?: {
    biblePath: string;
    before: object;
    after: object;
    rationale: string;
  };
  impactedChapterIds: string[];
  perChapterRationale: Record<string, string>;
}
```

### 6.5 `serial-revision`

Two implementation choices:

(a) New stage with payload analogous to existing `revision`, scoped to `serial_chapters`.

(b) Reuse existing `revision` stage with an added `target: 'kdp' | 'serial'` field.

**Recommendation: (b).** Lower risk of drift between the two revision flows, single prompt template to maintain. The `target` flag routes to the correct chapter table and the correct bible reference (KDP or RR), but the prompt itself is unchanged.

---

## 7. KDP Lock Predicate

```ts
function canEditKdpCanon(project: Project): { allowed: boolean; reason?: string } {
  if (project.serialisation_status === 'in_progress' ||
      project.serialisation_status === 'completed') {
    return {
      allowed: false,
      reason: 'Serialisation is active. Discard RR canon to edit KDP-side content.'
    };
  }
  return { allowed: true };
}
```

Apply at write sites:

- `chapter_versions` inserts/updates
- `documents` writes for `type IN ('story-bible', 'creative-brief', 'chapter-outlines', 'characters', 'structure', 'ending', 'ending-choice')`

Explicitly **not** locked:

- Marketing documents (`blurb`, `amazon-description`)
- Cover documents (`cover-brief`, `cover-image`, `back-cover-brief`, `cover-full-wrap`)
- A+ documents

These remain editable during Serialisation since they are independent of canon.

UI surfaces the lock as a banner on KDP stages when active, with a "Discard RR canon" action that fires the destructive transition from Section 5.2.

---

## 8. Safeguard Implementation

### 8.1 One open revision task per chapter

Before inserting a new task:

```sql
SELECT COUNT(*) FROM revision_tasks
 WHERE serial_chapter_id = ?
   AND status IN ('open', 'in_progress');
```

If count > 0, do **not** insert. Instead, mark the originating feedback's `status = 'pending_revisions'` and add the blocked chapter to a queue field on the feedback row (or a separate `queued_revision_tasks` table if you want stronger normalisation).

Post-resolve hook: when an existing task moves to `resolved` or `rejected`, scan for any feedback rows blocked on that chapter and emit their queued tasks now.

### 8.2 Delta approval gates revision task generation

Before inserting `revision_tasks` for a feedback that produced a canon-altering classification:

```sql
SELECT approved_at FROM bible_deltas
 WHERE triggered_by_feedback_id = ?
   AND reversal_of_id IS NULL;
```

Block generation while `approved_at IS NULL`. For `local_prose` classifications (no delta), revision task generation is immediate.

### 8.3 Append-only bible deltas

`bible_deltas` allows only one `UPDATE` per row: setting `approved_at` and `approved_by` from NULL once, as part of approval. No other field updates allowed.

Rollbacks insert a new row with `reversal_of_id` pointing at the original. The reversal row is itself immutable.

Enforce in the data access layer. A SQLite trigger that rejects updates to immutable columns is a reasonable belt-and-braces backstop if your migration pipeline supports adding triggers cleanly.

---

## 9. Markdown Parser (Source Upload)

Use a small in-house parser rather than pulling in `remark`. The requirements are narrow:

- Detect chapter headings: `^# `, `^## `, or `^Chapter \d+` (configurable per project).
- Detect scene-break markers: `^\*\*\*$`, `^---$`, `^# # #$`, `^\s*\*\s*\*\s*\*\s*$`.
- Strip front matter (title page, copyright, dedication) by detecting first `Chapter 1` heading.
- Preserve inline markdown (`*italics*`, `**bold**`, `>blockquote`) without transformation.
- Compute word counts per scene and per chapter.

Parser output:

```ts
{
  chapters: Array<{
    ordinal: number;
    title: string;
    rawHeading: string;
    scenes: Array<{
      sceneId: string;       // deterministic hash of position + first 64 chars
      content: string;
      wordCount: number;
    }>;
  }>;
}
```

Scene IDs are deterministic so a re-uploaded slightly edited manuscript preserves most IDs and the mapping survives. Where IDs do change (scene insertion / deletion / reorder), the parser also emits a `sceneIdDriftReport` for the diff confirmation view.

---

## 10. Diff Confirmation View (Source Upload)

After parsing the uploaded markdown, run a structural diff against the existing compiled manuscript:

- Chapter count difference: shown prominently.
- Per-chapter word count delta beyond ±5%: flagged.
- Scene count change per chapter: flagged.
- Word-level diff per scene: shown on-demand only (collapsed by default).

The user must click "Use this as source" to commit. Until then, the upload is staged in `documents` with a `staged=1` flag and is **not** yet referenced by `serial_source_document_id`. Staged documents older than 24 hours can be garbage-collected.

---

## 11. Prompt Templates

See [`ai-stages-and-prompts.md`](ai-stages-and-prompts.md) for prompt content. Stage keys to register:

| Stage key | Provider | Output mode |
|---|---|---|
| `serial-hook-score` | OpenAI | Structured JSON (Zod schema at route boundary) |
| `serial-repartition` | OpenAI | Structured JSON |
| `serial-enhance` | Anthropic | Markdown text + structured diff metadata |
| `serial-feedback-impact` | OpenAI | Structured JSON |
| `serial-revision` | Anthropic | Markdown text (reuses existing `revision` template if option (b) is taken) |

Context assembler addition:

```ts
function assembleSerialContext(
  project: Project,
  stage: SerialStage,
  payload: unknown
): SerialContext;
```

Returns `{ rrBible, chapterSummaries, sourceManuscriptExcerpt, weakHookContext }` depending on stage. Reuses existing `assembleContext` primitives for bible reads, just sourced from `story-bible-rr` rather than `story-bible`.

---

## 12. Component Map (Next.js)

```
app/(project)/project/[id]/serial/
  setup/page.tsx                     # entry CTA, fork status, source summary
  source/page.tsx                    # upload dropzone, diff view, source selector
  mapping/page.tsx                   # two-column mapping editor (DnD)
  enhancement/page.tsx               # per-chapter hook score grid, diff modal
  chapters/page.tsx                  # per-chapter list, status badges
  chapters/[ordinal]/page.tsx        # individual serial chapter editor
  feedback/page.tsx                  # tabs: inbox, delta log, bible viewer, task queue
  export/page.tsx                    # clipboard + open-in-RR per chapter
```

API routes (deterministic transitions and persistence; LLM stages go through `/api/generate`):

```
app/api/serial/
  enter/route.ts                     # POST: enter S0, perform fork
  discard/route.ts                   # POST: destructive transition
  source/upload/route.ts             # POST: stage uploaded markdown
  source/commit/route.ts             # POST: commit staged source
  mapping/approve/route.ts           # POST: lock mapping
  feedback/route.ts                  # POST: capture feedback
  delta/[id]/approve/route.ts        # POST: approve bible delta
  delta/[id]/rollback/route.ts       # POST: append reversal row
  chapter/[id]/version/route.ts      # POST: create new serial chapter version
  export/[id]/route.ts               # GET: rendered markdown for clipboard
```

---

## 13. Zustand Store Additions

```ts
interface SerialSlice {
  status: SerialisationStatus;
  enteredAt: string | null;
  sourceDocumentId: string | null;
  bibleId: string | null;
  mapping: SerialChapterMapping | null;
  chapters: SerialChapter[];
  feedbackInbox: SerialFeedback[];
  deltaLog: BibleDelta[];
  openRevisionTasks: RevisionTask[];

  enterSerialisation: () => Promise<void>;
  discardRRCanon: (confirmationToken: string) => Promise<void>;
  uploadSource: (file: File) => Promise<{ stagedDocId: string }>;
  commitSource: (stagedDocId: string) => Promise<void>;
  approveMapping: () => Promise<void>;
  submitFeedback: (input: FeedbackInput) => Promise<void>;
  approveDelta: (deltaId: string) => Promise<void>;
  rollbackDelta: (deltaId: string) => Promise<void>;
  approveRevisionTask: (taskId: string) => Promise<void>;
}
```

Keep this slice separate from the existing project slice; cross-reference through selectors. The `project` slice owns the project row; the `serial` slice owns everything that hangs off the project for serialisation.

---

## 14. Build Sequencing (Phase 1)

Recommended commit order, each behind feature flag `features.serialisation`:

1. Schema migration (project fields + new tables + `documents` type additions).
2. Lock predicate + sidebar group registration (returns "locked" until S0 enabled).
3. Stage S0 transition: `enter` and `discard` endpoints, bible clone logic, KDP lock activation.
4. Stage S1: markdown parser, `source/upload` route, `source/commit` route, diff confirmation view.
5. Stage S2 part A: scene parser + `serial-hook-score` generate route + score persistence.
6. Stage S2 part B: `serial-repartition` generate route + mapping editor UI + `mapping/approve` route.
7. Stage S3: `serial-enhance` generate route + diff approval UI + chapter version writes.
8. Stage S4: markdown renderer + clipboard export UI + "Open in RR" action.

Each commit is independently mergeable.

Phase 2 (feedback loop) and Phase 3 (arc-scope, rollback) sequencing belongs in a separate plan once Phase 1 ships.

---

## 15. Telemetry

Per existing usage-metrics conventions, log:

- Generate calls per serial stage: tokens, model, duration, error class.
- Mapping regenerations per project (signal of poor first-pass quality).
- Enhancement approval rate (per chapter and aggregate).
- Time from S0 entry to first chapter exported.
- Bible delta count per project, and approval latency per delta.
- Revision task approval / rejection split per delta.

---

## 16. Open Implementation Questions

The PRD's open items are product-level. Implementation has additional unknowns to resolve before Phase 1 ships:

- **Tail-of-scene window size for hook scoring.** Default 500 words is a guess; validate against real manuscripts. If hook signal lives in the last 200 words, the budget can be tightened further.
- **Repair-pass model fallback.** If the primary model returns unparseable JSON after one repair attempt, do we fail the call or fall back to a different model? Existing editorial pattern likely sets precedent; align with that.
- **Decision on `serial-revision` vs reused `revision`.** Recommended (b) above; confirm before Phase 2 begins.
- **Scene ID stability across re-uploads.** Hashing position + first 64 chars is fragile if the user reorders scenes. Consider a fuzzy-match step that pairs old and new scene IDs to preserve mapping continuity.
- **Cascading delete order on discard.** Application-level cascade vs FK ON DELETE CASCADE. Application-level gives clearer error handling and reporting but is more code. Pick one and apply it consistently across the new tables.

---

End of document.
