# Feature Spec: Cover Generation

**Product:** StoryForge  
**Feature:** Cover Generation  
**Status:** Draft  
**Depends on:** Approved canon (story-bible / creative-brief), title, genre, niche, word count  
**Pipeline position:** After Marketing, or in parallel with Marketing  
**Stage keys introduced:** `cover-archetype`, `cover-brief`, `cover-generate`, `cover-refine`, `cover-export`, `cover-back`, `cover-full-wrap`  
**Image model:** gpt-image-2 (OpenAI Images API)

---

## 1. Overview

Cover Generation is a structured, canon-driven pipeline for producing commercially viable book cover images within StoryForge. It follows the same approved-document philosophy as the rest of the product: AI generates options, the user reviews and approves, and approved outputs become canonical project assets.

The feature sits after Marketing in the sidebar and does not block Export Final - it is a parallel deliverable available any time after the title and story bible are approved.

The pipeline has seven stages:

1. **Archetype Selection** - user picks one or more cover archetypes from a visual card selector
2. **Cover Brief** - AI derives a visual direction document structured around the selected archetype's visual layers, which the user reviews and edits
3. **Front Cover Generation** - fire gpt-image-2 for 4 variants per selected archetype
4. **Front Cover Refinement** - natural language change requests, versioned iteration
5. **Front Cover Export** - KDP-spec PNG download
6. **Back Cover** - generate, refine, and export the back cover using the same layer-based approach
7. **Full Wrap** (optional) - user uploads the Amazon KDP cover template image; app composites front, spine, and back into a single print-ready PDF

A completed front cover feeds into the Marketing section, where it enriches the Amazon Description and optionally the Blurb prompts with the cover's visual tone.

---

## 2. Pipeline position and sidebar integration

### 2.1 Sidebar group

A new sidebar group **Cover** is added after **Marketing**. It contains a single top-level entry: **Cover Generation**, which expands to show per-stage status once the feature is entered.

```
Planning
Writing
Editing
  └── Editing passes (when multi-pass enabled)
Marketing
  ├── Blurb
  └── Amazon Description
Cover                          <- new group
  └── Cover Generation
        ├── Archetype Selection
        ├── Cover Brief
        ├── Front Cover
        │     ├── Generation
        │     ├── Refinement
        │     └── Export
        ├── Back Cover
        │     ├── Generation
        │     ├── Refinement
        │     └── Export
        └── Full Wrap (optional)
```

### 2.2 Stage ordering

Cover Generation stages are **not** inserted into `STAGE_ORDER`. Like Marketing, they sit outside the linear unlock sequence and never block Export Final. The feature becomes available once the story-bible or creative-brief document exists on the project (i.e. canon is locked).

If neither document exists, the Cover Generation sidebar entry is shown but locked, with a tooltip: "Complete your Story Bible first to unlock Cover Generation."

Back Cover and Full Wrap unlock once the Front Cover is approved.

### 2.3 Progress state

Each sub-stage tracks one of: `not-started`, `in-progress`, `complete`. The top-level Cover Generation entry shows the furthest reached sub-stage. An approved front cover sets the front cover sub-tree to `complete`. Full Wrap is always optional and does not affect overall completion state.

---

## 3. Stage definitions

### Stage A - Archetype Selection (`cover-archetype`)

**Purpose:** User selects which cover archetype(s) to generate. This happens first so the Cover Brief can be structured around the specific visual variables that the chosen archetype uses. This is a configuration step, not an LLM call.

**UI:** A card grid showing all 13 archetypes. Each card contains:
- A static reference thumbnail (curated, shipped with the app - see Section 6.1)
- Archetype name
- Primary genres (small tags)
- Thumbnail strength indicator (High / Very High)
- A "Recommended" badge for archetypes that match the project's genre and niche

Genre filtering is applied automatically: the 4-5 archetypes most relevant to the project's genre and niche appear first in a "Recommended for your genre" row, with all 13 available below in a scrollable grid.

**Selection:** User selects 1-4 archetypes. Selecting more than 4 shows a warning: "Generating more than 4 archetypes at once is expensive - consider narrowing your selection."

**High-Click toggle:** Each selected archetype card has a **High-Click optimised** toggle (off by default). When on, the universal high-click modifier is appended to that archetype's prompt (see Section 5.3). Tooltip: "Optimises for Amazon thumbnail performance - higher contrast, simplified background, oversized focal element. May reduce artistic subtlety."

**Proceed:** The "Build Cover Brief" CTA fires the cover-brief LLM call using the selected archetype(s) as the primary shaping input. If more than one archetype is selected, the brief is generated for each in parallel.

**No LLM call at this stage.** Proceed triggers the next stage.

---

### Stage B - Cover Brief (`cover-brief`)

**Purpose:** Produce a structured visual direction document derived from locked canon and shaped by the selected archetype. Rather than a generic brief, this document is divided into the specific visual layers and variables that make up the chosen archetype - what is in the background, what objects or symbols appear, whether a protagonist is present, and how text elements are handled. The user reviews, edits, and approves this before any image credits are spent.

**Inputs (assembled automatically):**

| Canon field | Source |
|-------------|--------|
| Genre | Project metadata |
| Niche / subgenre | Niche reference document |
| Title | Approved title |
| Author name | Project metadata |
| Tone and mood | Creative brief / story bible `voiceAndStyle` |
| Protagonist description | Story bible `characters[0]` |
| Key symbols and objects | Story bible `worldRules`, `unresolvedThreads` |
| Ending promise | Story bible `endingPromises` |
| Style rules and avoid list | Story bible `voiceAndStyle.styleRules`, `.avoid` |
| Selected archetype(s) | From Stage A |

**Output:** One `cover-brief` document per selected archetype. Each brief is divided into the visual layers that define that archetype. Layers vary by archetype:

| Archetype type | Layers present |
|----------------|---------------|
| A1 Icon / Symbol | Background, Symbol/Object, Text |
| A2 Character-Centric | Background/Environment, Protagonist, Text |
| A3 Landscape / Worldbuilding | Background/Landscape, Foreground element, Text |
| A4 Object-in-World | Background/Environment, Object, Text |
| A5 Action / Battle | Background/Environment, Character(s)/Action, Text |
| A6 Emblem / Typography | Background, Emblem/Symbol, Text (dominant) |
| A7 Mystery / Atmospheric | Background/Atmosphere, Mysterious Subject, Text |
| R1 Clinch / Couple | Background/Setting, Character A, Character B, Text |
| R2 Solo Character | Background/Setting, Character, Text |
| R3 Object / Symbol (Romantic) | Background, Object/Symbol, Text |
| R4 Illustrated / Graphic | Background, Focal Element, Text |
| R5 Setting / Atmosphere | Background/Setting, Distant Figure (optional), Text |
| R6 Typography-Dominant | Background, Text (dominant) |

Each layer is a structured object with a written description the user can read and edit in the UI. The **Text layer** is always present and contains:
- `titleText` - the book title (pre-populated from project)
- `authorText` - the author name (pre-populated from project)
- `seriesText` - series name and number, if applicable (optional)
- `typographyDirection` - font style and weight guidance for this archetype and genre
- `textPlacement` - where in the composition text elements should sit

Additional fields across all briefs:
- `paletteDirection` - 2-3 sentences on colour, tone, and contrast
- `moodKeywords` - 4-6 adjectives distilled from tone analysis
- `visualAvoid` - elements to exclude (drawn from canon)
- `coverComps` - 2-3 comparable published covers (AI-suggested; user-editable)

**Dual editing:** The Cover Brief screen offers two modes of editing:

1. **Visual layer editor (default):** Each layer is shown as a labelled editable card (e.g. "Background", "Protagonist", "Text"). Each card displays the field values as readable prose or structured form fields that the user can edit directly. This is the primary editing surface.

2. **Raw prompt view:** An expandable "What the AI sees" panel at the bottom of the screen shows the fully resolved image generation prompt that will be assembled from the brief fields. The user can edit this directly as well. Changes made in the raw prompt view are independent of the layer cards - the raw prompt field is what gets sent to the image model. A "Sync from layers" button re-assembles the raw prompt from the current layer field values, discarding manual raw edits.

**User actions:** Review layer fields, edit any field, switch to raw prompt view and edit, regenerate (re-fires the brief LLM call), approve. Approval is required before proceeding to generation.

**JSON mode:** Yes. Schema validated per archetype layer schema; repair pass on failure.

---

### Stage C - Front Cover Generation (`cover-generate`)

**Purpose:** Fire gpt-image-2 for each approved archetype brief and present results.

**API behaviour:**

- Model: `gpt-image-2`
- Size: `1024x1536` (portrait, closest to KDP 2:3 ratio available)
- Quality: `high`
- n: `4` per archetype call
- Calls are fired in parallel for all selected archetypes
- Each call uses the resolved raw prompt from the approved cover brief (either auto-assembled from layers or user-edited in the raw view)

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

**Generation cost estimate:** A pre-generation summary shows the estimated number of API calls and approximate cost before the user confirms.

**Storage:** All generated images are stored as base64 in the project database as document type `cover-image`, linked to the `cover-generate` run. Each stores: `archetypeId`, `coverSide` (`front`), `promptUsed`, `highClickEnabled`, `runId`, `variantIndex`, `status` (`candidate` / `discarded` / `approved`).

---

### Stage D - Front Cover Refinement (`cover-refine`)

**Purpose:** Iterate on a selected front cover candidate using natural language change requests.

**Entry:** User selects one candidate image from the generation grid to enter refinement. The selected image is shown large on the left; the refinement interface is on the right.

**Refinement input:** A free-text field: "Describe your changes." Examples:
- "Make the rook larger and more central"
- "Darken the sky to deep navy"
- "The title font feels too thin - make it bolder"
- "Add more atmospheric fog at the base"
- "Shift the palette cooler - less amber"

The change request is composed with the original prompt to form the new prompt:

```
[original prompt]

Refinement: [user change request]. Keep all other elements consistent with the above.
```

**Quick-action buttons** for common refinements (append a preset modifier to the change request field):

| Button | Appended text |
|--------|--------------|
| Stronger contrast | "Increase contrast significantly between subject and background." |
| Simplify background | "Simplify and de-clutter the background, reduce detail." |
| Zoom in | "Zoom in on the focal element, crop closer." |
| Darker mood | "Shift the overall mood and lighting darker and more dramatic." |
| Lighter mood | "Shift the overall mood and lighting warmer and more inviting." |
| Bolder typography | "Make the title typography larger and heavier weight." |
| Warmer palette | "Shift the colour palette warmer." |
| Cooler palette | "Shift the colour palette cooler." |

**Output per refinement:** 2 variants (n=2) by default. User can request 4 if preferred.

**Version history:** Every refinement produces a new version. The version sidebar shows v1, v2, v3 etc. with a thumbnail and the change request that produced it - identical pattern to chapter versions. The original generation image is v1. Users can branch from any prior version.

**Approve:** Approval sets `status: approved` on that image document and records `approvedFrontCoverImageId` on the project. Only one front cover image can be approved at a time. Approval unlocks the Back Cover and Full Wrap stages.

---

### Stage E - Front Cover Export (`cover-export`)

**Purpose:** Download the approved front cover at production-ready specifications.

**Export options:**

| Format | Spec | Use |
|--------|------|-----|
| KDP Front Cover PNG | 2560x1600px, RGB, 300dpi equivalent | KDP upload (digital only) |
| Kindle Thumbnail PNG | 1000x625px | Store preview, ads |
| Square Social PNG | 1400x1400px, title-centred crop | Social media |

The exported image is the approved version upscaled or cropped to the target spec via `sharp`. gpt-image-2 outputs at 1024x1536; upscaling is handled server-side.

**Filename convention:** `[project-slug]-front-[archetype-id]-v[version].png`

---

### Stage F - Back Cover (`cover-back`)

**Purpose:** Generate a back cover image using the same layer-based approach as the front cover, with back-cover-specific content.

**Relationship to front cover:** The back cover is generated independently but should be visually consistent with the front. The approved front cover's palette direction and mood keywords are carried into the back cover brief as a consistency constraint.

**Back cover brief layers:** The back cover has a fixed set of layers regardless of the front cover archetype, since back cover conventions are less archetype-dependent:

- **Background** - visual style and palette, drawn from front cover brief for consistency
- **Blurb text area** - the blurb text (pre-populated from the approved Blurb document if present; otherwise user-entered). Position and typographic treatment.
- **Author bio area** (optional) - short author bio text and optional author photo placeholder
- **Publisher / series logo area** (optional) - position and sizing for brand elements
- **Barcode area** - reserved bottom-right zone; shown as a placeholder in generation; replaced with a real barcode in Full Wrap or export post-processing

**Generation, refinement, and export:** Identical sub-flow to the front cover (generate 4 variants, select candidate, refine with natural language, approve, export as PNG). The approved back cover image is stored as a `cover-image` document with `coverSide: 'back'`.

**Back cover export formats:**

| Format | Spec | Use |
|--------|------|-----|
| KDP Back Cover PNG | 2560x1600px, RGB | KDP upload or Full Wrap input |
| Square Social PNG | 1400x1400px | Social media |

---

### Stage G - Full Wrap (optional) (`cover-full-wrap`)

**Purpose:** Compose the front cover, spine, and back cover into a single print-ready full-wrap PDF, sized to the exact dimensions specified in the user's downloaded Amazon KDP cover template.

**Overview of the approach:** Amazon KDP provides a downloadable cover template image (PNG or PDF) specific to a book's trim size, page count, and paper type. This template image shows the exact pixel dimensions and bleed areas for the full wrap - front cover zone, spine zone, and back cover zone, all labelled. The user uploads this template to StoryForge; the app reads the zone dimensions from the image and composites the approved cover assets into position.

**Sub-stages:**

#### G.1 - Template Upload

The user uploads their Amazon KDP cover template image. Supported formats: PNG, JPEG, PDF (first page).

The app analyses the uploaded template using `sharp` (and where needed, basic image parsing) to extract:
- Overall canvas dimensions (width x height in pixels)
- Front cover zone position and dimensions
- Back cover zone position and dimensions
- Spine zone position and dimensions (width is the critical variable)
- Bleed and safe-zone boundaries

Extracted dimensions are shown to the user as a summary for confirmation before compositing begins:

```
Template detected:
  Canvas:     3453 x 2175 px
  Front cover zone:  1218 x 1875 px  (right)
  Spine zone:        222 x 1875 px   (centre)
  Back cover zone:   1218 x 1875 px  (left)
  Bleed:             0.125 in on each edge
```

If the app cannot reliably extract dimensions automatically (e.g. the template uses an unusual format), the user is prompted to enter the zone dimensions manually using numeric fields.

#### G.2 - Spine Design

The spine is generated separately from the front and back cover images. It is a narrow vertical strip containing:

- **Title text** (pre-populated from project title; editable)
- **Author name** (pre-populated; editable)
- **Series info** (optional; editable)
- **Publisher logo / imprint logo** (optional image upload)

The spine layout is composited server-side using `sharp` with:
- Background colour pulled from `cover-brief.paletteDirection` (dominant colour extracted from the approved front cover image via colour analysis)
- Text rendered vertically (rotated 90 degrees, reading top to bottom)
- Font style consistent with `cover-brief.typographyDirection`
- Logo placed at the bottom of the spine if uploaded

A rendered preview of the spine strip is shown to the user before final compositing. The user can adjust text content, font weight, and background colour via simple controls.

#### G.3 - Full Wrap Composite

Once template dimensions are confirmed, the spine is approved, and both cover images are approved, the app composites the full wrap:

1. Create a canvas matching the template dimensions
2. Place the back cover image (resized to back cover zone dimensions) on the left
3. Place the spine strip (resized to spine zone width x spine zone height) in the centre
4. Place the front cover image (resized to front cover zone dimensions) on the right
5. Apply bleed extension (mirror-pad or extend edges) where template zones include bleed

A full-resolution composite preview is shown in the UI before export.

#### G.4 - Full Wrap Export

The final composite is exported as a **PDF** at print resolution.

**Export spec:**

| Field | Value |
|-------|-------|
| Format | PDF |
| Colour space | RGB (KDP accepts RGB for digital print) |
| Resolution | Matches template pixel dimensions at 300dpi equivalent |
| Bleed | Included as specified in detected template zones |

**Filename convention:** `[project-slug]-full-wrap-v[version].pdf`

The user can also download the composite as a flat PNG at the same resolution if preferred.

---

## 4. Data model

### 4.1 New document types

| Type | Description |
|------|-------------|
| `cover-brief` | Structured visual direction document with archetype-specific layers (JSON) |
| `cover-image` | Individual generated image with metadata (base64 + JSON); `coverSide` distinguishes front vs back |
| `cover-full-wrap` | Full wrap composite metadata and export record (JSON; actual image stored separately) |

### 4.2 `cover-brief` document schema

```typescript
{
  schemaVersion: 1,
  generatedAt: string,         // ISO-8601
  archetypeId: string,
  derivedFrom: {
    storyBibleDocumentId: string,
    creativeBriefDocumentId: string | null,
    titleApprovedAt: string
  },
  // Visual layers - populated per archetype
  layers: {
    background: {
      description: string,         // editable prose description
      paletteDirection: string,
      lightingNotes: string
    },
    symbol?: {                     // present on A1, A6, R3
      description: string,
      placement: string,
      detailNotes: string
    },
    object?: {                     // present on A4, R3
      description: string,
      placement: string
    },
    protagonist?: {                // present on A2, A5, R1, R2
      description: string,
      pose: string,
      emotionalState: string
    },
    protagonistB?: {               // present on R1 only
      description: string,
      pose: string
    },
    landscape?: {                  // present on A3, R5
      description: string,
      scaleNotes: string
    },
    foregroundElement?: {          // present on A3, A4 - optional in both
      description: string
    },
    mysteriousSubject?: {          // present on A7
      description: string,
      revealLevel: string          // e.g. "silhouette only", "partial"
    },
    focalElement?: {               // present on R4
      description: string,
      illustrationStyle: string
    },
    action?: {                     // present on A5
      description: string,
      motionDirection: string
    },
    text: {
      titleText: string,           // pre-populated from project title
      authorText: string,          // pre-populated from project
      seriesText: string | null,
      typographyDirection: string,
      textPlacement: string
    }
  },
  // Global brief fields
  moodKeywords: string[],
  visualAvoid: string[],
  coverComps: string[],
  // Raw prompt - auto-assembled from layers; user may override
  resolvedPrompt: string,
  promptOverridden: boolean        // true when user has manually edited resolvedPrompt
}
```

### 4.3 `cover-image` document schema

```typescript
{
  schemaVersion: 1,
  runId: string,
  archetypeId: string,
  coverSide: 'front' | 'back',
  highClickEnabled: boolean,
  promptUsed: string,
  variantIndex: number,
  parentImageId: string | null,
  refinementRequest: string | null,
  version: number,
  status: 'candidate' | 'discarded' | 'approved',
  imageData: string,              // base64 PNG
  generatedAt: string             // ISO-8601
}
```

### 4.4 `cover-full-wrap` document schema

```typescript
{
  schemaVersion: 1,
  generatedAt: string,
  frontCoverImageId: string,
  backCoverImageId: string,
  spineConfig: {
    titleText: string,
    authorText: string,
    seriesText: string | null,
    backgroundColour: string,     // hex, extracted or user-set
    textColour: string,
    logoImageData: string | null  // base64 PNG if uploaded
  },
  templateSource: {
    uploadedAt: string,
    detectedDimensions: {
      canvasWidth: number,
      canvasHeight: number,
      frontZone: { x: number, y: number, width: number, height: number },
      backZone: { x: number, y: number, width: number, height: number },
      spineZone: { x: number, y: number, width: number, height: number },
      bleedPx: number
    },
    dimensionsUserConfirmed: boolean
  },
  exportedAt: string | null,
  exportFilename: string | null
}
```

### 4.5 Project-level fields added

```typescript
approvedFrontCoverImageId: string | null
approvedBackCoverImageId: string | null
coverGenerationStatus: 'not-started' | 'in-progress' | 'complete'
kdpTemplateImageData: string | null   // base64 of uploaded template
```

### 4.6 New `WorkflowStage` values

```typescript
'cover-archetype'     // configuration only, no LLM call
'cover-brief'         // LLM call (JSON mode)
'cover-generate'      // image generation call
'cover-refine'        // image generation call
'cover-export'        // export only, no generation
'cover-back'          // covers the full back-cover sub-flow
'cover-full-wrap'     // compositing and PDF export
```

`cover-archetype`, `cover-export`, and `cover-full-wrap` are not routed through `POST /api/generate`. `cover-brief` routes through `POST /api/generate`. `cover-generate` and `cover-refine` route through dedicated image API routes.

---

## 5. Prompt template library

Defined in `src/lib/prompts/covers.ts`.

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

### 5.2 Cover Brief system prompt (`COVER_BRIEF_SYSTEM`)

```
You are a publishing art director with deep knowledge of commercial genre 
fiction cover design across fantasy, sci-fi, and romance. You analyse 
story canon and produce structured visual direction documents that brief 
cover designers and image generation models.

Your briefs are divided into the specific visual layers that define the 
selected archetype. Each layer must be concise, specific, and grounded 
in the source canon. Descriptions must be actionable for an image model.

Return only valid JSON matching the requested schema. Do not include 
markdown fences or commentary.
```

### 5.3 Base archetype prompt templates

Each template is assembled by `buildCoverPrompt(archetype, brief, highClick)` where `brief` is the approved `cover-brief` document. The resolved prompt is what is stored in `cover-brief.resolvedPrompt` and sent to the image model.

**Fantasy / Sci-Fi archetypes**

**A1 - Icon / Symbol**
```
A professional book cover for a [GENRE] novel.
Central focus: a single symbolic object — [layers.symbol.description] — centered on 
[layers.background.description].
[layers.symbol.placement]
Lighting: [layers.background.lightingNotes]
Mood: [moodKeywords joined], conveyed through colour and lighting rather than environment.
Palette: [layers.background.paletteDirection]
Typography: large, clean, highly legible title "[layers.text.titleText]" and author name 
"[layers.text.authorText]", [layers.text.textPlacement]. [layers.text.typographyDirection]
Style: minimalist, premium, high contrast, designed for strong thumbnail visibility.
Negative: no characters, no busy scenes, no clutter. [visualAvoid joined]
```

**A2 - Character-Centric**
```
A cinematic book cover for a [GENRE] novel.
Central focus: a character — [layers.protagonist.description] — [layers.protagonist.pose], 
occupying the foreground. Emotional state: [layers.protagonist.emotionalState]
Environment: [layers.background.description] behind them, slightly softened.
Lighting: [layers.background.lightingNotes]
Mood: [moodKeywords joined]
Palette: [layers.background.paletteDirection]
Composition: character dominates the frame, clear silhouette, readable at thumbnail size.
Typography: [layers.text.typographyDirection] title "[layers.text.titleText]" 
[layers.text.textPlacement]. Author: "[layers.text.authorText]"
Style: cinematic realism, dramatic lighting.
Negative: no clutter, no multiple competing characters unless clearly grouped. [visualAvoid joined]
```

**A3 - Landscape / Worldbuilding**
```
A cinematic book cover for a [GENRE] novel.
Central focus: a sweeping environment — [layers.landscape.description] — vast and detailed.
[layers.landscape.scaleNotes]
[If layers.foregroundElement present: Foreground: [layers.foregroundElement.description]]
Lighting: [layers.background.lightingNotes]
Mood: [moodKeywords joined]
Palette: [layers.background.paletteDirection]
Composition: strong depth (foreground, midground, background), wide cinematic framing.
Typography: large, readable title "[layers.text.titleText]" [layers.text.textPlacement]. 
[layers.text.typographyDirection] Author: "[layers.text.authorText]"
Style: epic, immersive, high-detail digital painting.
Negative: avoid cluttered micro-detail that reduces readability. [visualAvoid joined]
```

**A4 - Object-in-World (Hybrid)**
```
A professional book cover for a [GENRE] novel.
Central focus: a prominent object — [layers.object.description] — placed in 
[layers.background.description].
[layers.object.placement]
[If layers.foregroundElement present: Additional foreground: [layers.foregroundElement.description]]
Lighting: [layers.background.lightingNotes] guiding attention to the object.
Mood: [moodKeywords joined]
Palette: [layers.background.paletteDirection]
Typography: [layers.text.typographyDirection] title "[layers.text.titleText]" 
[layers.text.textPlacement]. Author: "[layers.text.authorText]"
Style: detailed, realistic, balanced composition.
Negative: no clutter, no competing focal points. [visualAvoid joined]
```

**A5 - Action / Battle Scene**
```
A dynamic book cover for a [GENRE] novel.
Central focus: [layers.protagonist.description] — [layers.action.description] — 
captured mid-motion. [layers.action.motionDirection]
Protagonist: [layers.protagonist.pose]
Environment: [layers.background.description], partially obscured by motion or effects.
Lighting: [layers.background.lightingNotes]
Mood: intense, high-stakes, kinetic. [moodKeywords joined]
Palette: [layers.background.paletteDirection]
Typography: [layers.text.typographyDirection] title "[layers.text.titleText]" 
[layers.text.textPlacement]. Author: "[layers.text.authorText]"
Negative: avoid chaotic clutter that obscures the main action. [visualAvoid joined]
```

**A6 - Emblem / Typography-Driven**
```
A clean, professional book cover for a [GENRE] novel.
Central focus: a stylised emblem or insignia — [layers.symbol.description] — 
[layers.symbol.placement]
Background: [layers.background.description]
Lighting: [layers.background.lightingNotes]
Mood: [moodKeywords joined]
Palette: [layers.background.paletteDirection]
Typography: dominant design element. Title "[layers.text.titleText]" — 
[layers.text.typographyDirection] — [layers.text.textPlacement], integrated with the emblem. 
Author: "[layers.text.authorText]"
Style: graphic, modern, minimal.
Negative: no scenes, no characters, no clutter. [visualAvoid joined]
```

**A7 - Mystery / Atmospheric Teaser**
```
A cinematic book cover for a [GENRE] novel.
Central focus: [layers.mysteriousSubject.description] — [layers.mysteriousSubject.revealLevel] — 
emerging from [layers.background.description]
Lighting: [layers.background.lightingNotes] — low-key, with strong contrast and selective highlights.
Mood: mysterious, tense, intriguing. [moodKeywords joined]
Palette: [layers.background.paletteDirection]
Typography: [layers.text.typographyDirection] title "[layers.text.titleText]" 
[layers.text.textPlacement], allowing mystery to dominate. Author: "[layers.text.authorText]"
Negative: no over-explanation, no clutter. [visualAvoid joined]
```

**Romance archetypes**

**R1 - The Clinch / Couple Embrace**
```
A professional romance novel cover.
Central focus: [layers.protagonist.description] and [layers.protagonistB.description] — 
[layers.protagonist.pose]
Characters' emotional states: [layers.protagonist.emotionalState]
Environment: [layers.background.description], softened in the background.
Lighting: [layers.background.lightingNotes]
Mood: [moodKeywords joined]
Palette: [layers.background.paletteDirection]
Typography: [layers.text.typographyDirection] title "[layers.text.titleText]" 
[layers.text.textPlacement]. Author: "[layers.text.authorText]"
Style: cinematic, warm-toned, emotionally immediate.
Negative: no cold lighting, no visual clutter separating the characters. [visualAvoid joined]
```

**R2 - Solo Character (Aspirational)**
```
A professional romance novel cover.
Central focus: [layers.protagonist.description] — [layers.protagonist.pose]. 
Emotional state: [layers.protagonist.emotionalState]
Environment: [layers.background.description]
Lighting: [layers.background.lightingNotes]
Mood: [moodKeywords joined]
Palette: [layers.background.paletteDirection]
Typography: [layers.text.typographyDirection] title "[layers.text.titleText]" 
[layers.text.textPlacement]. Author: "[layers.text.authorText]"
Style: warm, painterly or cinematic.
Negative: no cold tones, no action framing. [visualAvoid joined]
```

**R3 - Object / Symbol (Romantic)**
```
A professional romance novel cover.
Central focus: [layers.object.description] — [layers.object.placement] on 
[layers.background.description]
Lighting: [layers.background.lightingNotes]
Mood: [moodKeywords joined]
Palette: [layers.background.paletteDirection]
Typography: [layers.text.typographyDirection] title "[layers.text.titleText]" 
[layers.text.textPlacement]. Author: "[layers.text.authorText]"
Style: clean, premium, emotionally evocative.
Negative: no clutter, no characters, no cold tones. [visualAvoid joined]
```

**R4 - Illustrated / Graphic (Contemporary / Cosy)**
```
A professional illustrated romance novel cover.
Style: [layers.focalElement.illustrationStyle], warm and inviting.
Central focus: [layers.focalElement.description]
Background: [layers.background.description]
Palette: [layers.background.paletteDirection]
Mood: [moodKeywords joined]
Typography: [layers.text.typographyDirection] title "[layers.text.titleText]" 
[layers.text.textPlacement] — integrated into the illustration. Author: "[layers.text.authorText]"
Negative: no photorealism, no dark or gritty tones. [visualAvoid joined]
```

**R5 - Setting / Atmosphere (Place-Driven)**
```
A professional romance novel cover.
Central focus: [layers.landscape.description] — [layers.landscape.scaleNotes]
[If layers.foregroundElement present: Small figure: [layers.foregroundElement.description]]
Lighting: [layers.background.lightingNotes]
Mood: [moodKeywords joined]
Palette: [layers.background.paletteDirection]
Typography: [layers.text.typographyDirection] title "[layers.text.titleText]" 
[layers.text.textPlacement]. Author: "[layers.text.authorText]"
Style: painterly or cinematic, emotionally warm.
Negative: no cold tones, no action, no clutter. [visualAvoid joined]
```

**R6 - Typography-Dominant (Contemporary / Crossover)**
```
A professional romance novel cover.
The title "[layers.text.titleText]" is the dominant visual element. 
[layers.text.typographyDirection] [layers.text.textPlacement]
Supporting background: [layers.background.description]
Palette: [layers.background.paletteDirection]
Mood: [moodKeywords joined]
Author name "[layers.text.authorText]" positioned subordinate to title.
Style: graphic, modern, confident.
Negative: no busy scenes, no characters that compete with the type. [visualAvoid joined]
```

### 5.4 High-Click modifier

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

### 5.5 Back cover brief template

The back cover brief is assembled using a fixed schema (not archetype-specific), but imports palette and mood from the approved front cover brief for consistency:

```
Create a back cover visual brief for a [GENRE] novel, consistent with the 
approved front cover.

Front cover palette reference: [frontCoverBrief.layers.background.paletteDirection]
Front cover mood: [frontCoverBrief.moodKeywords joined]

Canon inputs:
- Blurb: [approvedBlurbContent or "(not yet generated - leave blurb area abstract)"]
- Author bio: [authorBio or "(none supplied)"]
- Genre: [genre]

Produce a structured brief with these back cover layers:
- background: visual style consistent with front cover
- blurbTextArea: text placement, typographic treatment, background contrast
- authorBioArea (optional): placement and style
- publisherLogoArea (optional): size and placement zone
- barcodeArea: reserved bottom-right zone, size and placement

Return only valid JSON matching the cover-brief schema with coverSide: "back".
```

---

## 6. UI component specifications

### 6.1 Archetype selector screen (Stage A - first step)

**Layout:** Two-row structure.

**Row 1 - Recommended for your genre:** 4-5 archetype cards with "Recommended" badge, pre-filtered by genre/niche match from project metadata.

**Row 2 - All archetypes:** All 13 cards in a scrollable grid, with genre tags for orientation.

**Card anatomy:**
- Reference thumbnail (120x180px, static asset curated per archetype)
- Archetype name (bold)
- Genre tags (small pills)
- Thumbnail strength badge (High / Very High)
- Selected state: border highlight, checkmark overlay
- High-Click toggle: appears on card when selected, off by default

**Reference thumbnails:** Curated static assets shipped with the app. One per archetype showing the visual language clearly. Licensing: purpose-made illustrations or public domain examples.

**Build Brief CTA:** Shows the selected count - "Build brief for 2 selected archetypes" - and advances to Stage B.

---

### 6.2 Cover Brief screen (Stage B)

**Layout:** Three-panel layout.

**Left panel - Canon inputs:** Read-only list of which canon fields were used (genre, title, protagonist, mood keywords etc.) with their values. Helps the user understand where the brief content came from.

**Centre panel - Visual layer editor:** The main editing surface. Each layer is shown as a labelled card with its fields as editable text areas or input fields. Layer cards are ordered: Background, then subject layers (Symbol / Protagonist / Object / etc. per archetype), then Text. The Text card always appears last and contains separate fields for title text, author text, series text, typography direction, and text placement.

Editing any field in the layer cards does not automatically re-assemble the raw prompt until the user explicitly clicks "Sync to prompt" or navigates to the raw view.

**Bottom drawer - What the AI sees:** Expandable panel showing the fully assembled image generation prompt (`resolvedPrompt`). When the prompt has not been overridden, a label reads "Auto-assembled from layers". When the user edits the raw prompt directly, the label changes to "Manually edited - out of sync with layers" and a "Reset to layers" button appears. The "Sync from layers" button re-assembles the raw prompt from the current layer values and clears the override flag.

**Actions:**
- Edit any layer field (centre panel)
- Edit raw prompt directly (bottom drawer)
- Sync from layers (bottom drawer)
- Regenerate (re-fires the cover-brief LLM call, replacing all layer fields)
- Approve Brief (locks the brief and advances to generation)

If multiple archetypes were selected, a tab row at the top of the centre panel switches between briefs. Each must be approved independently, or an "Approve all" option approves all at once.

---

### 6.3 Front Cover Generation screen (Stage C)

**Layout per archetype:** Section header with archetype name and high-click status, then a 2x2 grid of generated images.

Images are shown at approximately 200x300px in the grid. Clicking expands to a full-size modal view.

**Per-image actions (on hover):**
- Select as candidate (star icon)
- Discard (x icon)
- View prompt (info icon)

**Cross-archetype comparison:** A "Compare selected" button opens a side-by-side view of all currently starred candidates.

**Regenerate:** Re-fires the entire generation run for one archetype, producing 4 new variants. Previous variants are retained in history.

---

### 6.4 Front Cover Refinement screen (Stage D)

**Layout:**
- Left: selected candidate image at full display size
- Right: refinement panel

**Refinement panel:**
- Version history sidebar (v1, v2... thumbnails with change request text)
- Change request text area
- Quick-action button row (8 preset actions, see Stage D)
- "Refine (2 variants)" button - default n=2; a toggle allows n=4

**Prompt preview:** Expandable panel below the change request field shows exactly what will be sent, including the composition of the original prompt and the refinement request.

**Approve button:** Shows a confirmation: "Approve this as your front cover? This will unlock Back Cover and Full Wrap."

---

### 6.5 Front Cover Export screen (Stage E)

Clean summary screen showing the approved front cover image, its archetype label, and version number.

Export buttons for each format. Each shows the target dimensions and estimated file size.

---

### 6.6 Back Cover screen (Stage F)

Mirrors the front cover flow: a brief (back-cover-specific layer editor) followed by generation, refinement, and export sub-screens. The back cover brief screen is simpler than the front - it has fewer layers and the palette / mood are inherited from the front cover brief.

A "Palette lock" indicator at the top of the brief screen shows which front cover palette values are being carried over. The user can unlock this to diverge if desired (e.g. for a deliberate design decision).

---

### 6.7 Full Wrap screen (Stage G)

**Sub-screen 1 - Template Upload**

A large upload zone with the prompt: "Upload your Amazon KDP cover template (PNG, JPEG, or PDF)." Below it, a link: "Download your KDP template from Amazon." Once uploaded, a detected dimensions summary is shown with a confirm button. A "Enter dimensions manually" fallback option is available.

**Sub-screen 2 - Spine Design**

A spine preview (narrow vertical strip, realistically proportioned relative to the front and back) is shown in the centre. To the right: editable fields for title text, author name, series text, background colour picker, text colour picker, and a logo upload zone. Changes update the spine preview in real time.

**Sub-screen 3 - Composite Preview**

A full-width preview of the assembled wrap - back cover on the left, spine in the centre, front cover on the right - shown at reduced scale to fit the screen. Bleed zones are indicated with a dashed overlay. A "Confirm and export" CTA appears once the user is satisfied.

**Sub-screen 4 - Export**

Download buttons for PDF and PNG formats. Filename shown before download. A brief note: "This file is production-ready for upload to Amazon KDP's cover uploader."

---

## 7. Connection to Marketing

### 7.1 Cover tone in Amazon Description

When an approved front cover exists, the `buildAmazonDescriptionPrompt` function optionally includes:

```
**Approved cover:**
Archetype: [archetype name]
Visual tone: [cover-brief.moodKeywords joined]
Palette direction: [cover-brief.layers.background.paletteDirection]
High-click optimised: [yes/no]
```

This is controlled by an opt-in toggle on the Amazon Description stage: "Align description tone with approved cover."

### 7.2 Cover tone in Blurb (optional enrichment)

The same context block is optionally appended to `buildBlurbPrompt`. Controlled by a checkbox: "Align blurb tone with approved cover."

### 7.3 Data flow

```
cover-brief.moodKeywords
cover-brief.layers.background.paletteDirection
approvedFrontCoverImage.archetypeId
approvedFrontCoverImage.highClickEnabled
        |
        v
buildAmazonDescriptionPrompt  <-- opt-in enrichment
buildBlurbPrompt              <-- opt-in enrichment
```

---

## 8. API integration details

### 8.1 Route overview

| Route | Purpose |
|-------|---------|
| `POST /api/generate` (stage `cover-brief`) | Cover brief LLM call (JSON mode) |
| `POST /api/cover/generate` | Image generation for front and back covers |
| `POST /api/cover/refine` | Image refinement (front and back) |
| `POST /api/cover/full-wrap` | Full wrap compositing and PDF export |

### 8.2 `POST /api/cover/generate`

**Request body:**

```typescript
{
  projectId: string,
  runId: string,
  coverSide: 'front' | 'back',
  archetypes: Array<{
    archetypeId: string,
    prompt: string,           // resolved from cover brief
    highClickEnabled: boolean
  }>,
  n: number,                 // 4 default
  quality: 'standard' | 'high'
}
```

**Behaviour:**
- Fires parallel `openai.images.generate` calls, one per archetype entry
- Each call: `model: 'gpt-image-2'`, `size: '1024x1536'`, `n`, `quality`, `response_format: 'b64_json'`
- Results stored as `cover-image` documents with the specified `coverSide`
- Returns array of stored document IDs and base64 data for immediate display

**Error handling:**
- Per-archetype failures reported individually
- Content policy rejections: "The image model declined this prompt. Try adjusting the character description or scene elements."
- Timeout: 120s per call

### 8.3 `POST /api/cover/refine`

**Request body:**

```typescript
{
  projectId: string,
  coverSide: 'front' | 'back',
  parentImageId: string,
  originalPrompt: string,
  refinementRequest: string,
  n: number                  // 2 default
}
```

**Behaviour:**
- Composes `refinedPrompt` = `${originalPrompt}\n\nRefinement: ${refinementRequest}. Keep all other elements consistent with the above.`
- Fires `openai.images.generate` with composed prompt
- Stores results as new `cover-image` documents with `parentImageId` and `coverSide` set

### 8.4 `POST /api/cover/full-wrap`

**Request body:**

```typescript
{
  projectId: string,
  frontCoverImageId: string,
  backCoverImageId: string,
  spineConfig: {
    titleText: string,
    authorText: string,
    seriesText: string | null,
    backgroundColour: string,
    textColour: string,
    logoImageData: string | null
  },
  templateDimensions: {
    canvasWidth: number,
    canvasHeight: number,
    frontZone: { x: number, y: number, width: number, height: number },
    backZone: { x: number, y: number, width: number, height: number },
    spineZone: { x: number, y: number, width: number, height: number },
    bleedPx: number
  },
  outputFormat: 'pdf' | 'png'
}
```

**Behaviour:**
- Retrieves front and back cover base64 images from stored documents
- Resizes each to match the corresponding zone dimensions using `sharp`
- Renders the spine strip (text and optional logo) as a PNG using `sharp` with text compositing
- Composites all three onto a canvas matching `canvasWidth x canvasHeight`
- Exports as PDF (via `pdfkit`) or PNG
- Stores composite metadata as a `cover-full-wrap` document
- Returns the file as a download stream

### 8.5 Model config addition

```typescript
{
  id: 'gpt-image-2',
  displayName: 'GPT Image 2',
  provider: 'openai',
  type: 'image',
  maxContextTokens: null,
  usedFor: ['cover-generate', 'cover-refine']
}
```

---

## 9. Archetype reference table

| ID | Archetype | Primary genres | Thumbnail strength |
|----|-----------|---------------|-------------------|
| `a1` | Icon / Symbol | Fantasy, sci-fi | Very High |
| `a2` | Character-Centric | Epic fantasy, space opera, romantasy | High |
| `a3` | Landscape / Worldbuilding | Epic fantasy, hard sci-fi | Medium |
| `a4` | Object-in-World | Modern fantasy, grounded sci-fi | High |
| `a5` | Action / Battle Scene | Military fantasy, space opera | High |
| `a6` | Emblem / Typography-Driven | Series branding, sci-fi | High |
| `a7` | Mystery / Atmospheric Teaser | Sci-fi, dystopian, speculative | High |
| `r1` | The Clinch / Couple Embrace | All romance subgenres | Very High |
| `r2` | Solo Character (Aspirational) | Historical, Regency, contemporary | High |
| `r3` | Object / Symbol (Romantic) | Contemporary, women's fiction | High |
| `r4` | Illustrated / Graphic | Contemporary, romcom, cosy | Very High |
| `r5` | Setting / Atmosphere | Historical, small-town, destination | Medium |
| `r6` | Typography-Dominant | Commercial romance, crossover | High |

Genre pre-filtering logic for the selector:

| Project genre/niche | Recommended archetype IDs surfaced first |
|---------------------|------------------------------------------|
| Epic fantasy | `a2`, `a3`, `a1`, `a5` |
| Modern / urban fantasy | `a1`, `a4`, `a7`, `a2` |
| Sci-fi (hard) | `a3`, `a6`, `a7`, `a1` |
| Space opera | `a2`, `a5`, `a6`, `a3` |
| Romantasy | `r1`, `a2`, `a7`, `r2` |
| Historical romance | `r1`, `r2`, `r5`, `r3` |
| Contemporary romance | `r1`, `r4`, `r3`, `r6` |
| Regency / period | `r2`, `r5`, `r1`, `r3` |
| Romcom / cosy | `r4`, `r6`, `r3`, `r5` |
| Dystopian / speculative | `a7`, `a1`, `a3`, `a6` |

---

## 10. Open questions

| # | Question | Options | Recommended |
|---|----------|---------|-------------|
| 1 | Reference thumbnail source | Static curated assets shipped with app vs generated once at first run | Static curated - lower cost, no generation dependency |
| 2 | Image storage in SQLite | Base64 in `documents` table vs separate `cover_images` table vs filesystem | Separate `cover_images` table - base64 blobs in the main documents table will degrade query performance |
| 3 | Maximum archetypes per generation run | Hard cap at 4 or soft warning | Soft warning at 4, hard cap at 6 |
| 4 | Refinement default n | 2 or 4 | 2 - keeps cost manageable for iteration |
| 5 | Export upscaling library | `sharp`, `jimp`, or external | `sharp` - fast, Node-native, likely already in use |
| 6 | Cover brief regeneration | Allowed freely, or locked once generation has run | Allowed freely - brief regeneration voids any existing approved generation and prompts the user to re-generate |
| 7 | Marketing enrichment opt-in | Auto-inject cover tone vs opt-in toggle per stage | Opt-in toggle per stage |
| 8 | Multi-cover support | One approved front cover per project vs multiple | One per project in v1 |
| 9 | KDP template dimension extraction | Automated image parsing vs manual user input | Best-effort automated with manual fallback - Amazon templates are relatively standardised |
| 10 | Spine font rendering | `sharp` with a bundled font (e.g. Inter, Playfair Display) vs system fonts | Bundle 2-3 genre-appropriate fonts - system fonts are unpredictable across OS versions |
| 11 | PDF generation library | `pdfkit` vs `puppeteer` (headless render) vs `@pdf-lib/core` | `pdfkit` - lightweight, no browser dependency, sufficient for image compositing |
| 12 | Back cover blurb text source | Auto-pulled from approved Blurb document vs user pastes manually | Auto-pull with user-editable override |

---

## 11. Out of scope for v1

- Series cover consistency (shared style across books in a series)
- Canva / Photoshop handoff with layered file export
- In-app typography overlay compositor (positioning title text over image with font selector)
- A/B testing integration with ad platforms
- Cover preview mockups (3D book render, Kindle device frame)
- Direct KDP metadata upload
- Hardback / special edition format variants

---

## 12. Dependencies and prerequisites

| Dependency | Status |
|------------|--------|
| OpenAI API key configured in settings | Existing |
| `gpt-image-2` available on the project's OpenAI account | Confirm |
| `sharp` for image processing, upscaling, and compositing | Add to dependencies |
| `pdfkit` for PDF export | Add to dependencies |
| Bundled fonts for spine rendering (e.g. Inter, Playfair Display) | Add as static assets |
| Story bible or creative brief approved on project | Existing (gate condition) |
| Title approved on project | Existing (gate condition) |
| Word count stored on project | Existing |

---

*Last updated: May 2026. Update this document when `src/app/api/cover/` routes, `src/lib/prompts/covers.ts`, or the cover document schema change.*