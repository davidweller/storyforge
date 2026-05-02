**Product:** StoryForge  
**Feature:** Cover Generation (Kindle front + paperback full wrap)  
**Status:** Draft  
**Depends on:** Approved canon (story-bible / creative-brief), title, genre, niche, word count.  
**Pipeline position:** After Marketing  
**Stage keys introduced:** `cover-brief`, `cover-archetype`, `cover-generate`, `cover-refine`, `cover-export` (digital front only), `paperback-spec`, `back-cover-brief`, `back-cover-generate`, `back-cover-refine`, `paperback-export`  
**Image model:** gpt-image-2 (OpenAI Images API)  
**Compositing:** `sharp` for raster placement, scaling, spine fill, and barcode reserve rectangle (see §3 Stage J, §12)

---

## 1. Overview

Cover Generation is a structured, canon-driven pipeline for producing commercially viable book cover images within StoryForge. It follows the same approved-document philosophy as the rest of the product: AI generates options, the user reviews and approves, and approved outputs become canonical project assets.

The feature sits **after Marketing** in the sidebar so listing copy can precede cover art workflow. Like Marketing, Cover does not block Export Final; front-cover stages unlock once canon and title are in place.

**Two deliverables:**

- **Kindle / ebook:** **Front cover only** — the existing five-stage front pipeline and **digital export** formats (KDP ebook cover asset, thumbnail, social). No spine, no back panel.
- **Paperback:** **Full-wrap** single PNG — back panel (**image-only** background continuing the front style), spine (colour/gradient only, no text), front panel, and **reserved barcode zone** (white rectangle drawn at export, not by the image model), at the **exact pixel dimensions** from the user’s paperback spec (computed from KDP inputs or pasted from KDP Cover Creator).

The pipeline has **five shared front-cover stages**, then a **paperback branch** after the front is approved:

**Front cover (shared)**

1. **Cover Brief** - derive a visual direction document from locked canon  
2. **Archetype Selection**  
3. **Generation** - gpt-image-2 variants per archetype  
4. **Refinement**  
5. **Export (digital)** - Kindle/ebook front + thumbnail + social only (§3 Stage E)

**Paperback branch** (unlocks when front cover is approved — **no Marketing dependency**)

6. **Paperback spec** (`paperback-spec`) — KDP trim size, paper type, page count → canvas and panels (§3 Stage F)  
7. **Back cover brief** (`back-cover-brief`) — visual continuation of the front for the **back panel image only**  
8. **Back cover generation** (`back-cover-generate`) — background-only image (no text)  
9. **Back cover refinement** (`back-cover-refine`)  
10. **Paperback full-wrap export** (`paperback-export`) — `sharp` composite: front art + spine fill + back art + barcode reserve  

A completed front cover can **feed back into** Marketing: it enriches the Amazon Description (and optionally Blurb) prompts with the cover’s visual tone. With Cover after Marketing, that enrichment is usually applied when re-running those stages after the cover is approved.

---

## 2. Pipeline position and sidebar integration

### 2.1 Sidebar group

A new sidebar group **Cover** is added **after Marketing**. It has two sub-entries: **Front cover** (Kindle / ebook + shared art pipeline) and **Paperback** (full wrap).

```
Planning
Writing
Editing
  └── Multi-pass: Review under Editorial Analysis; Revisions under Apply Revisions
Marketing
  ├── Blurb
  └── Amazon Description
Cover                          ← after Marketing
  ├── Front cover
  │     ├── Cover Brief
  │     ├── Archetype Selection
  │     ├── Generation
  │     ├── Refinement
  │     └── Export (Kindle / ebook front + thumbnails)
  └── Paperback                ← locked until front approved
        ├── Paperback spec (KDP dimensions)
        ├── Back cover brief (visual style continuation)
        ├── Back cover generation (image only)
        ├── Back cover refinement
        └── Full-wrap export (front + spine + back image + barcode zone)
```

### 2.2 Stage ordering

Cover Generation stages are **not** inserted into `STAGE_ORDER`. Like Marketing, they sit outside the linear unlock sequence and never block Export Final. The feature becomes available once the story-bible or creative-brief document exists on the project (i.e. canon is locked).

If neither document exists, the Cover Generation sidebar entry is shown but locked, with a tooltip: "Complete your Story Bible first to unlock Cover Generation."

**Ordering rationale:** Marketing precedes Cover so authors can complete listing-oriented copy before investing in art. **Paperback** does not depend on Marketing.

**Paperback unlock:** **Front cover** approved (`approvedCoverImageId`). No Marketing dependency for paperback. Tooltip if locked: approve the front cover first.

### 2.3 Progress state

Each sub-stage tracks one of: `not-started`, `in-progress`, `complete`. **Front cover** and **Paperback** each have their own progress summary. An approved front image completes the front-cover export track for digital; an approved **back-cover background** plus successful **full-wrap export** completes paperback (exact rules in §3 Stages F–J).

---

## 3. Stage definitions

### Stage A - Cover Brief (`cover-brief`)

**Purpose:** Produce a structured visual direction document from existing canon before any image credits are spent. Mirrors the creative-brief pattern: a compact, human-reviewable document that feeds all downstream generation.

**Inputs (assembled automatically from project documents):**


| Canon field                | Source                                           |
| -------------------------- | ------------------------------------------------ |
| Genre                      | Project metadata                                 |
| Niche / subgenre           | Niche reference document                         |
| Title                      | Approved title                                   |
| Tone and mood              | Creative brief / story bible `voiceAndStyle`     |
| Protagonist description    | Story bible `characters[0]`                      |
| Key symbols and objects    | Story bible `worldRules`, `unresolvedThreads`    |
| Ending promise             | Story bible `endingPromises`                     |
| Style rules and avoid list | Story bible `voiceAndStyle.styleRules`, `.avoid` |
| Word count                 | Stored chapter word count total                  |


**Output:** A structured document stored as document type `cover-brief`, containing:

- `recommendedArchetypes` - array of 3-4 archetype IDs ranked with one-sentence rationale each
- `paletteDirection` - 2-3 sentences on colour, tone, and contrast
- `visualElements` - elements to include (drawn from canon)
- `visualAvoid` - elements to exclude (also drawn from canon)
- `typographyDirection` - font style guidance appropriate to genre
- `moodKeywords` - 4-6 adjectives distilled from tone analysis
- `coverComps` - 2-3 comparable published covers named for reference (AI-suggested; user-editable)

**Prompt transparency:** The full assembled prompt is shown in an expandable panel before the user runs generation, consistent with the right-drawer "what the AI sees" philosophy. Users can edit the assembled context before firing.

**User actions:** Review, edit individual fields, regenerate, approve. Approval is required before proceeding to archetype selection.

**JSON mode:** Yes. Schema validated; repair pass on failure.

---

### Stage B - Archetype Selection (`cover-archetype`)

**Purpose:** User selects which archetypes to generate covers for. This is a configuration step, not an LLM call.

**UI:** A card grid showing all 13 archetypes. Each card contains:

- A static reference thumbnail (curated, shipped with the app - see Section 6.2)
- Archetype name
- Primary genres (small tags)
- Thumbnail strength indicator (High / Very High)
- A "Recommended" badge if the archetype appears in `cover-brief.recommendedArchetypes`

Genre filtering is applied automatically: the 4-5 archetypes most relevant to the project's genre and niche appear first in a "Recommended for your genre" row, with all 13 available below.

**Selection:** User selects 1-4 archetypes. Selecting more than 4 shows a warning ("Generating more than 4 archetypes at once is expensive - consider narrowing your selection").

**High-Click toggle:** Each selected archetype card has a **High-Click optimised** toggle (off by default). When on, the universal high-click modifier is appended to that archetype's prompt (see Section 5.3). The toggle is accompanied by a tooltip: "Optimises for Amazon thumbnail performance - higher contrast, simplified background, oversized focal element. May reduce artistic subtlety."

**Prompt preview:** Below the card grid, an expandable **Prompt Preview** panel shows the fully assembled prompt for each selected archetype, with template placeholders resolved from the cover brief. Users can edit the prompt directly. This is the primary transparency surface for power users.

Placeholder resolution at this stage:

- `[GENRE]` - from project metadata
- `[TONE]` - from `cover-brief.moodKeywords` joined
- `[SYMBOL]` / `[OBJECT]` / `[DESCRIPTION]` - from `cover-brief.visualElements`
- `[SETTING]` - from story bible world rules
- `[PALETTE]` - from `cover-brief.paletteDirection`
- `[TITLE]` - from approved title

**No LLM call at this stage.** Proceed triggers generation.

---

### Stage C - Generation (`cover-generate`)

**Purpose:** Fire gpt-image-2 for each selected archetype and present results.

**API behaviour:**

- Model: `gpt-image-2`
- Size: `1024x1536` (portrait, closest to KDP 2:3 ratio available)
- Quality: `high`
- n: `4` per archetype call
- Calls are fired in parallel for all selected archetypes
- Each call uses the archetype's assembled and user-edited prompt from Stage B

**UI layout:**

Results are presented as a grid of archetype sections. Each section shows:

- Archetype name and high-click status as a header
- 2x2 image grid of the 4 variants
- The prompt used (collapsible)

Per image, the user can:

- **Select as candidate** - marks for refinement or export consideration
- **Discard** - removes from view (stored in history, not deleted)
- **View prompt** - shows the exact prompt used for that image

Multiple images across archetypes can be selected as candidates simultaneously, allowing cross-archetype comparison before committing to refinement.

**Generation cost estimate:** A pre-generation summary shows the estimated number of API calls and approximate cost (e.g. "4 archetypes x 4 images = 16 images") before the user confirms.

**Storage:** All generated images are stored as base64 in the project database as document type `cover-image`, linked to the `cover-generate` run. Each stores: `surface: 'front'`, `archetypeId`, `promptUsed`, `highClickEnabled`, `runId`, `variantIndex`, `status` (`candidate` / `discarded` / `approved`).

---

### Stage D - Refinement (`cover-refine`)

**Purpose:** Iterate on a selected candidate image using natural language change requests. This is where gpt-image-2's single-prompt text-and-image capability is used.

**Entry:** User selects one candidate image from the generation grid to enter refinement. The selected image is shown large on the left; the refinement interface is on the right.

**Refinement input:** A free-text field: "Describe your changes." Examples:

- "Make the rook larger and more central"
- "Darken the sky to deep navy"
- "The title font feels too thin - make it bolder"
- "Add more atmospheric fog at the base"
- "Shift the palette cooler - less amber"

The change request is composed with the original prompt to form the new prompt. The composition pattern is:

```
[original prompt]

Refinement: [user change request]. Keep all other elements consistent with the above.
```

**Quick-action buttons** for common refinements (append a preset modifier to the change request field):


| Button              | Appended text                                                     |
| ------------------- | ----------------------------------------------------------------- |
| Stronger contrast   | "Increase contrast significantly between subject and background." |
| Simplify background | "Simplify and de-clutter the background, reduce detail."          |
| Zoom in             | "Zoom in on the focal element, crop closer."                      |
| Darker mood         | "Shift the overall mood and lighting darker and more dramatic."   |
| Lighter mood        | "Shift the overall mood and lighting warmer and more inviting."   |
| Bolder typography   | "Make the title typography larger and heavier weight."            |
| Warmer palette      | "Shift the colour palette warmer."                                |
| Cooler palette      | "Shift the colour palette cooler."                                |


**Output per refinement:** 2 variants (n=2) by default to reduce cost while still offering a choice. User can request 4 if preferred.

**Version history:** Every refinement produces a new version. The version sidebar shows v1, v2, v3 etc. with a thumbnail and the change request that produced it - identical pattern to chapter versions. The original generation image is v1. Users can branch from any prior version.

**Approve:** When satisfied, the user approves a version. Approval sets `status: approved` on that image document and records `approvedCoverImageId` on the project. Only one cover image can be approved at a time.

**Prompt accumulation and drift.** Each refinement appends the change request to the accumulated prompt and fires a fresh generation — the model does not receive the previous image as input. After several rounds, the accumulated prompt can contain contradictory instructions (e.g. "darker sky... warmer mood... remove fog... add mist") and outputs will drift from the original direction.

To address this:

- After 3 or more refinements on a single candidate, show a banner: "Your prompt has accumulated several change requests. If results feel inconsistent, try 'Restart from here' to reset instructions while keeping this version as the new base."
- A **"Restart from here"** button on any version clears all accumulated refinement instructions and sets that version's prompt as the new base prompt (i.e. the resolved original archetype prompt only, with no refinement history appended). The user can then make targeted change requests from a clean slate.
- The full prompt history remains visible in the version sidebar for reference.

---

### Stage E - Export — digital / Kindle (`cover-export`)

**Purpose:** Download the approved **front** cover for **ebook / Kindle** and marketing thumbnails. **Does not** produce paperback spine, back panel, or full wrap.

**Export options (front art only):**


| Format               | Spec                                | Use                         |
| -------------------- | ----------------------------------- | --------------------------- |
| KDP ebook cover PNG  | 1600×2560px, RGB, 300dpi            | Kindle / KDP ebook upload   |
| Kindle Thumbnail PNG | 1000×1563px                         | Store preview, ads          |
| Square Social PNG    | 1400×1400px, title centred crop     | Social media                |


gpt-image-2 outputs at 1024×1536 (portrait, 2:3 ratio). The KDP ebook front cover target is 1600×2560px (portrait, 2:3 ratio, 300dpi equivalent) — the same aspect ratio, so upscaling is a clean 1.5625× on each axis with no cropping required. Upscaling uses `sharp`. The Kindle Thumbnail (1000×1563px) and Square Social (1400×1400px, centre-crop) follow the same source.

**Filename convention:** `[project-slug]-cover-[archetype-id]-v[version].png`

**Paperback:** Handled only in **Paperback → Full-wrap export** (`paperback-export`), which uses the dimensions from **Paperback spec** (§3 Stage F).

---

### Stage F - Paperback spec (`paperback-spec`)

**Purpose:** Lock the **exact pixel width and height** of the single full-wrap PNG, plus panel rectangles for back, spine, and front.

### Trim size selector

Present trim sizes as a labelled dropdown. Options match KDP's current print-on-demand offerings exactly:

| Label | Inches |
|-------|--------|
| 5 × 8 | 5.000 × 8.000 |
| 5.25 × 8 | 5.250 × 8.000 |
| 5.5 × 8.5 | 5.500 × 8.500 |
| 6 × 9 | 6.000 × 9.000 |
| 6.14 × 9.21 | 6.140 × 9.210 |
| 6.69 × 9.61 | 6.690 × 9.610 |
| 7 × 10 | 7.000 × 10.000 |
| 8 × 10 | 8.000 × 10.000 |
| 8.25 × 10.25 | 8.250 × 10.250 |
| 8.27 × 11.69 (A4) | 8.270 × 11.690 |
| Custom | user enters width × height in inches |

Default selection: **6 × 9** (most common KDP fiction trim).

### Paper type selector

Options match KDP's dropdown labels exactly:

- White 60lb (standard — default)
- Cream 60lb
- White 50lb (premium)
- Cream 50lb (premium)

### Page count

Integer. Pre-filled from project word count using the formula:

`estimatedPages = Math.ceil(wordCount / wordsPerPage(trimWidth, trimHeight))`

where `wordsPerPage` is a lookup from the table below. Pre-fill updates automatically when the user changes trim size. Always editable.

| Trim size | Words per page (approx) |
|-----------|------------------------|
| 5 × 8 in | 250 |
| 5.25 × 8 in | 260 |
| 5.5 × 8.5 in | 275 |
| 6 × 9 in | 300 |
| 6.14 × 9.21 in | 310 |
| 6.69 × 9.61 in | 330 |
| 7 × 10 in | 350 |
| 8 × 10 in | 390 |
| 8.25 × 10.25 in | 400 |
| 8.27 × 11.69 in (A4) | 440 |

These are mid-range estimates for 11–12pt body text with standard margins. The field is always editable; authors who know their exact page count from a formatted interior should override the pre-fill.

Store the `wordsPerPage` lookup in `src/lib/kdp/paperbackDimensions.ts` alongside the spine-width constants so both use the same trim-size data.

### Mode

- `calculated` (default): derive canvas from formulas below.
- `from_kdp_template`: user enters total canvas **width × height in px** (from Cover Creator download). Store as `canvasWidthPx` / `canvasHeightPx`. Panel rects are still computed using the calculated spine width (trim size + paper type + page count must still be entered). If the user also pastes **spine width in px** (optional advanced field), use that value instead of the formula result. Always display: **"Calculated: [n]px — Your template: [n]px"** so the user can see any discrepancy.

Warning if user-entered canvas dimensions differ from the calculated value by more than 5px on either axis: *"Your template dimensions differ slightly from our calculation. This is usually fine — KDP Cover Creator sometimes rounds differently. Proceeding will use your entered dimensions."*

### Amazon KDP spine-width formula (exact)

KDP's published formula for spine width:

```
spineWidthInches = pageCount × paperThicknessPerPage
```

Paper thickness per page constants (from KDP's Cover Creator documentation):

| Paper type | Thickness per page (inches) |
|------------|---------------------------|
| White 60lb | 0.002252 |
| Cream 60lb | 0.002500 |
| White 50lb | 0.002143 |
| Cream 50lb | 0.002381 |

KDP minimum spine width for text: 0.0625 inches (equivalent to roughly 100 pages on white 60lb). Spine **text** is out of scope for v1 — the spine is colour-filled only — so the only implication is display: show a note **"Spine will be colour-filled only"** regardless of width.

### Full canvas dimensions formula

At 300dpi (KDP's required print resolution):

```
// All values in inches first, then converted to px at 300dpi
bleedInches = 0.125  // each edge

canvasWidthInches  = bleedInches + trimWidthInches + spineWidthInches + trimWidthInches + bleedInches
canvasHeightInches = bleedInches + trimHeightInches + bleedInches

canvasWidthPx  = Math.round(canvasWidthInches  × 300)
canvasHeightPx = Math.round(canvasHeightInches × 300)
```

Panel rectangles (pixel coords, origin top-left of full canvas):

```
backPanelRect  = { x: bleedPx, y: bleedPx, width: trimWidthPx, height: trimHeightPx }
spineRect      = { x: bleedPx + trimWidthPx, y: bleedPx, width: spineWidthPx, height: trimHeightPx }
frontPanelRect = { x: bleedPx + trimWidthPx + spineWidthPx, y: bleedPx, width: trimWidthPx, height: trimHeightPx }
```

where:

```
bleedPx      = Math.round(0.125 × 300)          // = 38px
trimWidthPx  = Math.round(trimWidthInches × 300)
trimHeightPx = Math.round(trimHeightInches × 300)
spineWidthPx = Math.round(spineWidthInches × 300)
```

### Output (`paperback-spec` document)

Persist: `mode`, trim dimensions, `paperType`, `pageCount`, `canvasWidthPx`, `canvasHeightPx`, `bleedPx`, `frontPanelRect`, `spineRect`, `backPanelRect`, `updatedAt`, and optional `spineWidthPxOverride` / template canvas when in override mode.

### Implementation notes

- Store all paper-thickness constants and the canvas formula in `src/lib/kdp/paperbackDimensions.ts`.
- Unit-test against at least three KDP fixtures: a 250-page 6×9 white 60lb, a 400-page 5.5×8.5 cream 60lb, and a 150-page 5×8 white 60lb. Verify computed canvas dimensions match KDP Cover Creator output for those combinations.

**No LLM.** Save and proceed unlocks Back cover brief.

---

### Stage G - Back cover brief (`back-cover-brief`)

**Purpose:** Structured brief for the **back panel art only** — how the generated **image** should continue the front cover’s visual identity.

> **Back cover is image only.** The back panel is a background art image that continues the front cover's visual style — no text, no blurb, no author name, no barcode image. The only non-image element on the back panel in the exported full wrap is the barcode reserve rectangle (white, drawn by the compositing step, not by the image model).

**Inputs:**

- Approved `cover-brief` + `approvedCoverImageId` (archetype, palette, mood, `visualAvoid`)

**Output:** Document type `back-cover-brief` containing:

- `backgroundStyle: string` — description of how the back background should continue the front's visual identity
- `moodContinuity: string` — how atmosphere, lighting, and palette should carry across from the front
- `avoidElements: string[]` — visual elements to exclude (drawn from `cover-brief.visualAvoid` plus back-specific notes)
- `compositionNotes: string` — guidance on keeping the back calmer and less focal than the front, with generous negative space in the lower third for the barcode reserve zone
- `approvedAt: string | null`

**JSON-mode LLM** via `POST /api/generate`, stage `back-cover-brief`. User approves before generation.

---

### Stage H - Back cover generation (`back-cover-generate`)

**Purpose:** gpt-image-2 **image-only** art for the back panel (no baked-in text). Prompt continues front archetype environment/palette/mood; emphasises negative space suitable for the **barcode reserve zone** and a calmer composition than the front.

**Prerequisite:** Saved `paperback-spec` (so export aspect ratios are known) and approved `back-cover-brief`.

- Model/size/quality/n match front-cover generation defaults (`1024×1536`, `n=4`)
- Stored as `cover-image` with `surface: 'back'`

---

### Stage I - Back cover refinement (`back-cover-refine`)

Same pattern as Stage D; quick-actions include “More negative space for barcode zone” and “Darken bottom for barcode legibility.” Optional: show approved front thumbnail as style reference in UI.

**Approve:** Sets `approvedBackCoverImageId` on the project (only one approved back background at a time).

**Prompt accumulation and drift.** Each refinement appends the change request to the accumulated prompt and fires a fresh generation — the model does not receive the previous image as input. After several rounds, the accumulated prompt can contain contradictory instructions (e.g. "darker sky... warmer mood... remove fog... add mist") and outputs will drift from the original direction.

To address this:

- After 3 or more refinements on a single candidate, show a banner: "Your prompt has accumulated several change requests. If results feel inconsistent, try 'Restart from here' to reset instructions while keeping this version as the new base."
- A **"Restart from here"** button on any version clears all accumulated refinement instructions and sets that version's prompt as the new base prompt (i.e. the resolved original archetype prompt only, with no refinement history appended). The user can then make targeted change requests from a clean slate.
- The full prompt history remains visible in the version sidebar for reference.

---

### Stage J - Paperback full-wrap export (`paperback-export`)

**Purpose:** One **print-ready PNG** spanning back + spine + front at `paperback-spec` dimensions.

**Composition (server, `sharp`):**

1. Place approved front raster in `frontPanelRect` (scale/crop to fit).
2. Fill spine rectangle with a solid colour or subtle vertical gradient derived from `cover-brief.paletteDirection`. **No text is placed on the spine.**
3. Place approved back background image in `backPanelRect`.
4. **Barcode reserve:** draw a fixed white rectangle in the bottom-right of the back panel matching KDP's barcode size/margin guidance; label in export legend **"Place ISBN barcode here."**

**Output filename:** `[project-slug]-paperback-fullwrap-v[version].png`

---

## 4. Data model

### 4.1 New document types

The following values are added to the document `type` enum:


| Type               | Description                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| `cover-brief`      | Front cover visual direction (JSON)                                         |
| `cover-image`      | Generated raster + metadata; `surface` distinguishes `front` vs `back`      |
| `paperback-spec`   | KDP paperback canvas + panel rectangles in px (JSON)                        |
| `back-cover-brief` | Back panel **visual** brief for image-only generation (JSON)                |


### 4.2 `cover-brief` document schema

```typescript
{
  schemaVersion: 1,
  generatedAt: string, // ISO-8601
  derivedFrom: {
    storyBibleDocumentId: string,
    creativeBriefDocumentId: string | null,
    titleApprovedAt: string
  },
  recommendedArchetypes: Array<{
    archetypeId: string,
    rationale: string
  }>,
  paletteDirection: string,
  visualElements: string[],
  visualAvoid: string[],
  typographyDirection: string,
  moodKeywords: string[],
  coverComps: string[]
}
```

### 4.3 `cover-image` document schema

```typescript
{
  schemaVersion: 1,
  runId: string,
  archetypeId: string,
  highClickEnabled: boolean,
  promptUsed: string,
  variantIndex: number,        // 0-3 within a generation run
  parentImageId: string | null,
  refinementRequest: string | null,
  version: number,
  surface: 'front' | 'back',
  status: 'candidate' | 'discarded' | 'approved',
  imageData: string,           // base64 PNG
  generatedAt: string          // ISO-8601
}
```

### 4.4 `paperback-spec` document schema

```typescript
{
  schemaVersion: 1,
  mode: 'calculated' | 'from_kdp_template',
  trimWidthIn: number,
  trimHeightIn: number,
  paperType: string,           // KDP label, e.g. white 60lb
  pageCount: number,
  canvasWidthPx: number,
  canvasHeightPx: number,
  bleedPx: number,
  frontPanelRect: { x: number, y: number, width: number, height: number },
  spineRect: { x: number, y: number, width: number, height: number },
  backPanelRect: { x: number, y: number, width: number, height: number },
  spineWidthPxOverride?: number | null, // optional: from Cover Creator / advanced field
  updatedAt: string
}
```

### 4.5 `back-cover-brief` document schema

```typescript
{
  schemaVersion: 1,
  derivedFrom: {
    coverBriefDocumentId: string,
    approvedCoverImageId: string
  },
  backgroundStyle: string,
  moodContinuity: string,
  avoidElements: string[],
  compositionNotes: string,
  approvedAt: string | null
}
```

### 4.6 Project-level fields added

```typescript
approvedCoverImageId: string | null
approvedBackCoverImageId: string | null
coverGenerationStatus: 'not-started' | 'in-progress' | 'complete'
paperbackGenerationStatus: 'not-started' | 'in-progress' | 'complete'
```

### 4.7 New `WorkflowStage` values

```typescript
// Front / digital
'cover-brief'
'cover-archetype'
'cover-generate'
'cover-refine'
'cover-export'
// Paperback
'paperback-spec'
'back-cover-brief'
'back-cover-generate'
'back-cover-refine'
'paperback-export'
```

`cover-archetype`, `cover-export`, and `paperback-spec` are not routed through `POST /api/generate`. Text stages: `cover-brief`, `back-cover-brief`. Image stages: `cover-generate`, `cover-refine`, `back-cover-generate`, `back-cover-refine`. `paperback-export` is compositing only.

### 4.8 Issue 4 — Model text bleed-through (image-only back cover)

Image models sometimes render **legible text or symbols** despite prompt constraints. If that appears on a **back cover** candidate, the user should:

- Issue a **refinement** explicitly requesting removal of all text, letters, numbers, and glyphs, and/or  
- Use **Restart from here** (§3 Stages D and I) so the prompt does not accumulate contradictory instructions.

See also §5.5 for the hard constraint line appended to every back-cover image prompt.

---

## 5. Prompt template library

The prompt template library is a first-class versioned asset, defined in a new module `src/lib/prompts/covers.ts`. All 13 archetype base templates plus the high-click modifier and assembly logic live here.

### 5.1 System prompt (`COVER_GENERATION_SYSTEM`)

```
You are a professional book cover designer and commercial art director specialising 
in genre fiction. You understand that effective book covers must:

- Signal genre instantly at thumbnail size
- Communicate tone and emotional promise without text
- Use composition, lighting, and colour to guide the eye
- Integrate typography as a design element, not an afterthought
- Prioritise readability and contrast over fine detail

Generate covers that would be commercially competitive on Amazon KDP.
Output only the image. Do not add explanations or commentary.
```

### 5.2 Base archetype templates

Each template is a function `buildCoverPrompt(archetype, fields, highClick)` where `fields` is resolved from the cover brief at Stage B.

**Fantasy / Sci-Fi archetypes**

**A1 - Icon / Symbol**

```
A professional book cover for a [GENRE] novel.
Central focus: a single symbolic object — [SYMBOL] — centered on a clean or 
subtly textured background. The object should be large, iconic, and visually 
striking, with fine detail and dramatic lighting.
Background: minimal, with soft gradients or faint atmospheric texture, no clutter.
Mood: [TONE], conveyed through colour and lighting rather than environment.
Typography: large, clean, highly legible title "[TITLE]" and author name, 
integrated around the object.
Style: minimalist, premium, high contrast, designed for strong thumbnail visibility.
Negative: no characters, no busy scenes, no clutter.
```

**A2 - Character-Centric**

```
A cinematic book cover for a [GENRE] novel.
Central focus: a character — [DESCRIPTION] — shown [POSE], occupying the foreground.
Environment: [SETTING] behind them, slightly softened to keep focus on the character.
Mood: [TONE], expressed through lighting and posture.
Composition: character dominates the frame, clear silhouette, readable at thumbnail size.
Typography: bold title "[TITLE]" placed above or across the character, high contrast.
Style: cinematic realism, dramatic lighting.
Negative: no clutter, no multiple competing characters unless clearly grouped.
```

**A3 - Landscape / Worldbuilding**

```
A cinematic book cover for a [GENRE] novel.
Central focus: a sweeping environment — [LANDSCAPE] — vast and detailed, 
conveying scale and atmosphere.
Foreground: optional small figure or object for scale.
Mood: [TONE], expressed through weather, lighting, and colour.
Composition: strong depth (foreground, midground, background), wide cinematic framing.
Typography: large, readable title "[TITLE]" over sky or negative space.
Style: epic, immersive, high-detail digital painting.
Negative: avoid cluttered micro-detail that reduces readability.
```

**A4 - Object-in-World (Hybrid)**

```
A professional book cover for a [GENRE] novel.
Central focus: a prominent object — [OBJECT] — placed in a grounded 
environment [SETTING].
The object should dominate the foreground, with the world supporting it 
in the background.
Mood: [TONE], realistic and grounded.
Lighting: cinematic, guiding attention to the object.
Typography: bold, clean title "[TITLE]" integrated into negative space.
Style: detailed, realistic, balanced composition.
Negative: no clutter, no competing focal points.
```

**A5 - Action / Battle Scene**

```
A dynamic book cover for a [GENRE] novel.
Central focus: an action moment — [ACTION] — captured mid-motion.
Composition: strong directional movement, leading lines, clear focal action.
Environment: [SETTING], partially obscured by motion, smoke, or effects.
Mood: intense, high-stakes, kinetic.
Lighting: high contrast, dramatic highlights and shadows.
Typography: bold and highly legible title "[TITLE]" despite busy scene.
Negative: avoid chaotic clutter that obscures the main action.
```

**A6 - Emblem / Typography-Driven**

```
A clean, professional book cover for a [GENRE] novel.
Central focus: a stylised emblem or insignia — [SYMBOL] — centered.
Background: simple, textured or gradient.
Typography: dominant design element, large and bold title "[TITLE]", 
integrated with the emblem.
Mood: [TONE], conveyed through colour and type.
Style: graphic, modern, minimal.
Negative: no scenes, no characters, no clutter.
```

**A7 - Mystery / Atmospheric Teaser**

```
A cinematic book cover for a [GENRE] novel.
Central focus: a partially obscured or mysterious subject — [SUBJECT] — 
emerging from shadow, fog, or light.
Environment: minimal, atmospheric, suggestive rather than explicit.
Mood: mysterious, tense, intriguing.
Lighting: low-key, with strong contrast and selective highlights.
Typography: clean and subtle title "[TITLE]", allowing mystery to dominate.
Negative: no over-explanation, no clutter.
```

**Romance archetypes**

**R1 - The Clinch / Couple Embrace**

```
A professional romance novel cover.
Central focus: two characters — [DESCRIPTION A] and [DESCRIPTION B] — in close 
physical proximity, [POSE: embracing / about to kiss / in romantic tension].
Lighting: warm, intimate, soft.
Environment: [SETTING], softened in the background.
Mood: [TONE — passionate / tender / electric / playful].
Typography: elegant or bold title "[TITLE]", integrated above or below the couple.
Style: cinematic, warm-toned, emotionally immediate.
Negative: no cold lighting, no visual clutter separating the characters.
```

**R2 - Solo Character (Aspirational)**

```
A professional romance novel cover.
Central focus: a single character — [DESCRIPTION] — [POSE: facing away / 
looking over shoulder / standing in setting], conveying [EMOTIONAL STATE].
Environment: [SETTING], atmospheric and supporting.
Mood: [TONE — longing / confident / wistful].
Lighting: soft, directional, flattering.
Typography: elegant title "[TITLE]", placed to complement the character's 
negative space.
Style: warm, painterly or cinematic.
Negative: no cold tones, no action framing.
```

**R3 - Object / Symbol (Romantic)**

```
A professional romance novel cover.
Central focus: a single symbolic object — [OBJECT] — centered or slightly 
offset on a clean or softly textured background.
Mood: [TONE — tender / playful / bittersweet / luxurious].
Colour palette: [PALETTE — warm neutrals / blush / deep jewel tones].
Lighting: soft, intimate, with gentle highlights on the object.
Typography: elegant, readable title "[TITLE]", integrated around the object.
Style: clean, premium, emotionally evocative.
Negative: no clutter, no characters, no cold tones.
```

**R4 - Illustrated / Graphic (Contemporary / Cosy)**

```
A professional illustrated romance novel cover.
Style: [flat illustration / semi-illustrated / graphic art], warm and inviting.
Central focus: [CHARACTER / SCENE / OBJECT] rendered in a clean, 
stylised way.
Colour palette: [PALETTE — pastel / bright / warm tones].
Mood: [TONE — playful / cosy / optimistic / witty].
Typography: bold, friendly, highly legible title "[TITLE]" — integrated 
into the illustration.
Negative: no photorealism, no dark or gritty tones.
```

**R5 - Setting / Atmosphere (Place-Driven)**

```
A professional romance novel cover.
Central focus: a setting — [LOCATION] — rendered atmospherically with 
strong mood and lighting.
No characters, or a very small distant figure for scale only.
Mood: [TONE — warm and inviting / mysterious and longing / cosy and safe].
Lighting: [golden hour / candlelit / soft overcast / moonlit].
Colour palette: [PALETTE].
Typography: elegant, prominent title "[TITLE]", placed in sky or negative space.
Style: painterly or cinematic, emotionally warm.
Negative: no cold tones, no action, no clutter.
```

**R6 - Typography-Dominant (Contemporary / Crossover)**

```
A professional romance novel cover.
The title "[TITLE]" is the dominant visual element, extremely large and bold.
Supporting image: subtle, textural, or illustrative background that supports 
the title without competing.
Mood: [TONE — witty / warm / bold / aspirational].
Colour palette: [PALETTE — clean, high contrast].
Style: graphic, modern, confident.
Negative: no busy scenes, no characters that compete with the type.
```

### 5.3 High-Click modifier

When `highClickEnabled` is true, the following block is appended to any base archetype prompt before the Negative line:

```
High-click optimisation: The central subject should be extremely large, 
filling 50-70% of the frame, possibly cropped at the edges. Simplify 
the background to soft gradients or haze. Use extreme contrast between 
subject and background. The title must be very large and bold with a 
strong drop shadow or outline for legibility at small sizes. Strip all 
micro-detail that turns to visual noise at thumbnail size. Design for 
maximum click-through rate rather than fine detail.
```

### 5.4 Cover Brief system prompt (`COVER_BRIEF_SYSTEM`)

```
You are a publishing art director with deep knowledge of commercial genre 
fiction cover design across fantasy, sci-fi, and romance. You analyse 
story canon and produce structured visual direction documents that brief 
cover designers and image generation models.

Your briefs are specific, grounded in the source material, and commercially 
actionable. You understand genre visual conventions and know how to translate 
narrative tone into colour, composition, and typographic direction.

Return only valid JSON matching the requested schema.
```

### 5.5 Back cover background prompt (`BACK_COVER_IMAGE_PATTERN`)

Assemble an **image-only** prompt from: front archetype **environment/mood lines** (not title/character/clinch instructions), `cover-brief` palette and mood keywords, and `back-cover-brief.backgroundStyle`. Calmer than front; generous negative space in the lower third for the barcode reserve zone.

The assembled back cover image prompt must always end with the following hard constraint line:

> No text of any kind, no letters, no numbers, no title, no author name, no blurb, no words anywhere in the image.

See **§4.8** for guidance on handling model text bleed-through in refinement.

### 5.6 Back cover brief system prompt (`BACK_COVER_BRIEF_SYSTEM`)

```
You are a paperback cover art director. Given an approved front-cover brief and
front archetype, produce JSON for a back-cover layout brief describing how the
rear background image should continue the front cover's visual identity.

The back cover is an image only — no text, no blurb copy, no author name.
Describe: how the background environment or mood should carry across from the
front, what to avoid, and how to leave generous negative space in the lower
third for the KDP barcode reserve zone.

Return only valid JSON matching the requested schema.
```

---

## 6. UI component specifications

### 6.1 Cover Brief screen

Two-panel layout:

- **Left panel:** The assembled canon inputs shown as a read-only reference list (which fields were used)
- **Right panel:** The generated cover brief document, editable field by field

A "Regenerate" button re-fires the brief. An "Approve Brief" CTA advances to archetype selection.

Prompt transparency: an expandable "What the AI sees" drawer at the bottom shows the full assembled prompt used to generate the brief.

---

### 6.2 Archetype selector screen

**Layout:** Two-row structure.

**Row 1 - Recommended for your genre:** 4-5 archetype cards with "Recommended" badge, pre-filtered by genre/niche match from the cover brief.

**Row 2 - All archetypes:** All 13 cards in a scrollable grid, with genre tags for orientation.

**Card anatomy:**

- Reference thumbnail (120x180px, static asset, curated per archetype)
- Archetype name (bold)
- Genre tags (small pills)
- Thumbnail strength badge (High / Very High)
- Selected state: border highlight, checkmark overlay
- High-Click toggle: appears on card when selected, off by default

**Reference thumbnails:** Curated static assets shipped with the app. One per archetype showing the visual language clearly - not necessarily AI-generated. These are orientation aids, not artistic benchmarks. Licensing: purpose-made illustrations or public domain examples are both viable.

**Prompt preview panel:** Below the card grid. Shows a tab per selected archetype. Each tab contains the fully assembled, placeholder-resolved prompt for that archetype. Directly editable. A reset button restores the auto-assembled version from the cover brief.

**Generate CTA:** Shows the count - "Generate 12 images (3 archetypes x 4 variants)" - and an estimated cost indicator before confirming.

---

### 6.3 Generation screen

**Layout per archetype:** Section header with archetype name and high-click status, then a 2x2 grid of generated images.

Images are shown at approximately 200x300px in the grid. Clicking expands to a full-size modal view.

**Per-image actions (on hover):**

- Select as candidate (star icon)
- Discard (x icon)
- View prompt (info icon)

**Cross-archetype comparison:** A "Compare selected" button opens a side-by-side view of all currently starred candidates.

**Regenerate:** Re-fires the entire generation run for one archetype, producing 4 new variants. Previous variants are retained in history.

---

### 6.4 Refinement screen

**Layout:**

- Left: selected candidate image at full display size
- Right: refinement panel

**Refinement panel:**

- Version history sidebar (v1, v2... thumbnails with change request text)
- Change request text area
- Quick-action button row (8 preset actions, see Stage D)
- "Refine (2 variants)" button - default n=2; a toggle allows n=4

**Prompt preview:** Expandable panel below the change request field shows exactly what will be sent, including the composition of the original prompt and the refinement request.

**Approve button:** Approves the currently displayed version. Shows a confirmation: "Approve this cover as your project cover? This will be used in Marketing materials."

---

### 6.5 Export screen — digital (`cover-export`)

Summary of the approved **front** cover. Export buttons: **KDP ebook cover**, **Kindle thumbnail**, **square social** — each shows dimensions and estimated size.

Note: “**Kindle / ebook:** front cover only. **Paperback full wrap** is under Cover → Paperback → Full-wrap export.”

---

### 6.6 Paperback spec screen (`paperback-spec`)

UI implements **Stage F** in full: trim dropdown (default 6×9), paper-type dropdown, **page count** with formula pre-fill from word count and trim-based `wordsPerPage`, mode toggle for KDP template dimensions, calculated vs template comparison, validation warning when template dimensions differ from calculation by more than 5px on any edge, diagram of three panels.

---

### 6.7 Back cover brief screen

Two columns: left = reference panel showing the approved front thumbnail, palette keywords, and mood keywords from `cover-brief`; right = editable `backgroundStyle`, `moodContinuity`, `compositionNotes`, and `avoidElements` fields, each pre-populated by the AI brief. An **Approve Brief** CTA is required before back cover generation.

---

### 6.8 Back cover generation / refinement screens

Same patterns as §6.3–6.4; single archetype continuation; `surface: back` in storage. Optional side-by-side with approved front.

---

### 6.9 Paperback full-wrap export screen (`paperback-export`)

Live preview of composed wrap; toggle for **barcode placeholder** visibility. **Export PNG** at exact `paperback-spec` dimensions. Help text: place KDP-issued barcode in reserved rectangle after export. **Spine title and all back-panel text are out of scope for v1** (see §11).

---

## 7. Connection to Marketing

### 7.0 Sidebar order (Marketing before Cover)

Cover intentionally appears **below** Marketing in the sidebar. Primary flow: write and approve **Blurb** (and Amazon Description) first; then use Cover for art.

### 7.1 Cover tone in Amazon Description

When an approved cover image exists on the project, the `buildAmazonDescriptionPrompt` function includes an additional context block:

```
**Approved cover:**
Archetype: [archetype name]
Visual tone: [cover-brief.moodKeywords joined]
Palette direction: [cover-brief.paletteDirection]
High-click optimised: [yes/no]
```

This allows the Amazon Description model to write copy that is coherent with the visual marketing - e.g. a dark atmospheric silhouette cover should produce darker, more intense copy than a cosy illustrated cover would. With Cover after Marketing, expect authors to **re-run** Amazon Description after approving the cover if they want this block applied on the first pass after art exists.

### 7.2 Cover tone in Blurb (optional enrichment)

The same context block is optionally appended to `buildBlurbPrompt` when an approved cover exists. This is toggled by a checkbox on the Blurb stage: "Align blurb tone with approved cover."

### 7.3 Data flow

```
cover-brief.moodKeywords
cover-brief.paletteDirection
approvedCoverImage.archetypeId
approvedCoverImage.highClickEnabled
        │
        ▼
buildAmazonDescriptionPrompt  ←── enriched prompt
buildBlurbPrompt              ←── optional enrichment
```

No new API stages are required for marketing prompt enrichment — prompt assembly in existing handlers. `paperback-export` reads `paperback-spec` and approved front/back `cover-image` documents.

---

## 8. API integration details

### 8.1 Route changes

A new route `POST /api/cover/generate` handles cover generation calls separately from `POST /api/generate`. This is preferable to routing through the existing generate handler because:

- The response is binary image data, not text
- Parallel multi-archetype calls require different concurrency handling
- Image storage (base64 to SQLite) is a different persistence pattern

The cover-brief and back-cover-brief LLM calls (text/JSON) use `POST /api/generate` with stages `cover-brief` and `back-cover-brief`.

### 8.2 `POST /api/cover/generate`

**Front covers only** — stores `surface: 'front'` on each `cover-image`.

**Request body:**

```typescript
{
  projectId: string,
  runId: string,
  archetypes: Array<{
    archetypeId: string,
    prompt: string,        // assembled and user-edited
    highClickEnabled: boolean
  }>,
  n: number,              // 4 default
  quality: 'standard' | 'high'  // 'high' default
}
```

**Behaviour:**

- Fires parallel `openai.images.generate` calls, one per archetype entry
- Each call: `model: 'gpt-image-2'`, `size: '1024x1536'`, `n`, `quality`, `response_format: 'b64_json'`
- Results stored as `cover-image` documents per variant with `surface: 'front'`
- Returns array of stored document IDs and base64 data for immediate display

**Error handling:**

- Per-archetype failures are reported individually - a failure on one archetype does not cancel others
- Content policy rejections from the API are surfaced with the message: "The image model declined this prompt. Try adjusting the character description or scene elements."
- Timeout: 120s per call (image generation is slower than text)

### 8.3 `POST /api/cover/refine`

Accepts either front or back parent images.

**Request body:**

```typescript
{
  projectId: string,
  parentImageId: string,
  originalPrompt: string,
  refinementRequest: string,
  surface: 'front' | 'back',
  n: number              // 2 default
}
```

**Behaviour:**

- Composes `refinedPrompt` as today
- Fires `openai.images.generate` with composed prompt
- Stores new `cover-image` rows with `parentImageId` and matching `surface`

### 8.4 `POST /api/cover/back/generate`

**Request body:** `{ projectId, runId, prompt, n?, quality? }`

Validates saved `paperback-spec`, approved `back-cover-brief`, and approved front cover. Stores variants with `surface: 'back'`.

### 8.5 `POST /api/cover/paperback/export`

**Request:** `projectId`, `includeBarcodePlaceholder: boolean` (default true).

**Behaviour:** Loads `paperback-spec`, approved front and back `cover-image` documents; builds full-wrap PNG with **`sharp`** (raster placement, spine gradient fill, barcode reserve rectangle). Streams PNG download.

Expected output file size: a 300dpi full wrap for a 6×9 book (canvas approximately 3825×2775px) typically yields a PNG around **4–10MB** depending on image complexity. Set the route's `maxDuration` consistent with other long-running export routes and confirm Node memory limits accommodate the `sharp` pipeline for the largest supported trim (8.27×11.69 A4, canvas approximately 5031×3675px, up to ~**18MB** PNG).

### 8.6 Model config addition

```typescript
{
  id: 'gpt-image-2',
  displayName: 'GPT Image 2',
  provider: 'openai',
  type: 'image',
  maxContextTokens: null,
  usedFor: [
    'cover-generate',
    'cover-refine',
    'back-cover-generate',
    'back-cover-refine'
  ]
}
```

---

## 9. Archetype reference table


| ID   | Archetype                     | Primary genres                       | Thumbnail strength |
| ---- | ----------------------------- | ------------------------------------ | ------------------ |
| `a1` | Icon / Symbol                 | Fantasy, sci-fi                      | Very High          |
| `a2` | Character-Centric             | Epic fantasy, space opera, romantasy | High               |
| `a3` | Landscape / Worldbuilding     | Epic fantasy, hard sci-fi            | Medium             |
| `a4` | Object-in-World               | Modern fantasy, grounded sci-fi      | High               |
| `a5` | Action / Battle Scene         | Military fantasy, space opera        | High               |
| `a6` | Emblem / Typography-Driven    | Series branding, sci-fi              | High               |
| `a7` | Mystery / Atmospheric Teaser  | Sci-fi, dystopian, speculative       | High               |
| `r1` | The Clinch / Couple Embrace   | All romance subgenres                | Very High          |
| `r2` | Solo Character (Aspirational) | Historical, Regency, contemporary    | High               |
| `r3` | Object / Symbol (Romantic)    | Contemporary, women's fiction        | High               |
| `r4` | Illustrated / Graphic         | Contemporary, romcom, cosy           | Very High          |
| `r5` | Setting / Atmosphere          | Historical, small-town, destination  | Medium             |
| `r6` | Typography-Dominant           | Commercial romance, crossover        | High               |


Genre pre-filtering logic for the selector:


| Project genre/niche     | Recommended archetype IDs surfaced first |
| ----------------------- | ---------------------------------------- |
| Epic fantasy            | `a2`, `a3`, `a1`, `a5`                   |
| Modern / urban fantasy  | `a1`, `a4`, `a7`, `a2`                   |
| Sci-fi (hard)           | `a3`, `a6`, `a7`, `a1`                   |
| Space opera             | `a2`, `a5`, `a6`, `a3`                   |
| Romantasy               | `r1`, `a2`, `a7`, `r2`                   |
| Historical romance      | `r1`, `r2`, `r5`, `r3`                   |
| Contemporary romance    | `r1`, `r4`, `r3`, `r6`                   |
| Regency / period        | `r2`, `r5`, `r1`, `r3`                   |
| Romcom / cosy           | `r4`, `r6`, `r3`, `r5`                   |
| Dystopian / speculative | `a7`, `a1`, `a3`, `a6`                   |


---

## 10. Open questions

The following decisions should be resolved before implementation begins.


| #   | Question                              | Options                                                                              | Recommended                                                                                             |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 1   | Reference thumbnail source            | Static curated assets shipped with app vs generated once at cover-brief time         | Static curated - lower cost, no generation dependency                                                   |
| 2   | Image storage in SQLite               | Base64 in `documents` table vs separate `cover_images` table vs filesystem           | Separate `cover_images` table - base64 blobs in the main documents table will degrade query performance |
| 3   | Maximum archetypes per generation run | Hard cap at 4 or soft warning                                                        | Soft warning at 4, hard cap at 6                                                                        |
| 4   | Refinement default n                  | 2 or 4                                                                               | 2 - keeps cost manageable for iteration                                                                 |
| 5   | Export upscaling library              | `sharp` (already likely available), `jimp`, or external                              | `sharp` - fast, Node-native, already used in DOCX export pipeline                                       |
| 6   | Cover brief regeneration              | Allowed freely, or locked once archetype selection begins                            | Allowed freely - cheap text call, user may want to adjust direction                                     |
| 7   | Marketing enrichment opt-in           | Auto-inject cover tone into marketing prompts vs opt-in toggle per stage             | Opt-in toggle per stage - users may not want it to influence the blurb                                  |
| 8   | Multi-cover support                   | One approved cover per project vs allow multiple approved (e.g. for series variants) | One approved per project in v1; series support is v2                                                    |
| 9   | KDP dimension source                  | Calculated-only vs require template upload                                         | Primary: calculated from trim/paper/pages using KDP's exact formula (§3 Stage F). Override mode stores user-entered canvas px but still calculates panel rects from the formula — the canvas override only affects `canvasWidthPx` and `canvasHeightPx`, not the internal rect calculations, unless the user also provides spine width in px via the optional advanced field.      |
| 10  | Barcode block size                     | Fixed px from KDP docs vs user-adjustable margin                                   | Fixed default from KDP print guidance; document constant in code                                            |
| 11  | Back-cover gen before paperback spec   | Require `paperback-spec` saved before `back-cover-generate`                         | **Yes** — generation needs panel aspect hints; brief can be edited earlier                                 |


---

## 11. Out of scope for v1

- **Automated ISBN barcode generation** (reserved rectangle only; authors paste barcode from KDP/ISBN issuer)
- **Back-cover text overlays** (tagline, author name, blurb) — back cover is **image-only** in v1
- **In-image text overlays using bundled fonts** (spine title, back-cover tagline, author name) — deferred to v2 (bundled fonts may ship in the repo for future use but are not required for the initial paperback export build)
- Series-wide cover consistency (shared style across books in a series)
- Canva / Photoshop handoff with layered PSD export
- Free-form **drag-and-drop** text and image layers in the composer
- A/B testing integration with ad platforms
- Cover preview mockups (3D book render, Kindle device frame)
- Direct KDP metadata upload
- Parsing uploaded KDP template PNG to auto-derive panel rects without user confirmation (optional future; v1 relies on calculated rects + optional canvas size override)

---

## 12. Dependencies and prerequisites


| Dependency | Status |
| ---------- | ------ |
| OpenAI API key configured in settings | Existing |
| `gpt-image-2` available on the project's OpenAI account | Confirm |
| `sharp` for upscale, crop, spine gradient fill, barcode rectangle, and full-wrap composition | Add / confirm in dependencies |
| Bundled fonts (OFL licensed): **EB Garamond** (serif, `EBGaramond-Regular/Italic`), **Inter** (sans-serif, `Inter-Regular/Bold`), **Playfair Display** (display, `PlayfairDisplay-Regular/Bold/Italic`) — placed under `src/assets/fonts/cover/`; ship each font's `OFL.txt` LICENSE file alongside | Add (may be deferred until v2 text-overlay features; see §11) |
| `sharp` text compositing via **node-canvas**: compositing is handled using node-canvas for text rendering (blurb zone removed in v1; retained for potential future back-cover tagline feature); node-canvas output is composited onto the `sharp` pipeline as a PNG layer | Add / confirm (deferred if v1 exports image + barcode rectangle only) |
| KDP spine-width, canvas, and `wordsPerPage` constants in `src/lib/kdp/paperbackDimensions.ts` | Add module + tests against KDP calculator fixtures |
| Story bible or creative brief approved on project | Existing (front gate) |
| Title approved on project | Existing (front gate) |
| Word count stored on project (page-count estimate for paperback spec) | Existing |

---

*Last updated: May 2026. Update this document when `src/app/api/cover/` routes (including `paperback/export`, `back/generate`), `src/lib/prompts/covers.ts`, `src/lib/kdp/paperbackDimensions.ts`, `paperback-spec` / `back-cover-brief` schemas, or export dimensions change.*