**Product:** StoryForge  
**Feature:** Cover Generation  
**Status:** Draft  
**Depends on:** Approved canon (story-bible / creative-brief), title, genre, niche, word count  
**Pipeline position:** After Editing, before Marketing  
**Stage keys introduced:** `cover-brief`, `cover-archetype`, `cover-generate`, `cover-refine`, `cover-export`  
**Image model:** gpt-image-2 (OpenAI Images API)

---

## 1. Overview

Cover Generation is a structured, canon-driven pipeline for producing commercially viable book cover images within StoryForge. It follows the same approved-document philosophy as the rest of the product: AI generates options, the user reviews and approves, and approved outputs become canonical project assets.

The feature sits between Editing and Marketing in the sidebar. Like Marketing, it does not block Export Final - it is a parallel deliverable that can be completed any time after the title and story bible are approved.

The pipeline has five stages:

1. **Cover Brief** - derive a visual direction document from locked canon
2. **Archetype Selection** - user picks one or more cover archetypes from a visual card selector
3. **Generation** - fire gpt-image-2 for 4 variants per selected archetype
4. **Refinement** - natural language change requests, versioned iteration
5. **Export** - KDP-spec PNG download

A completed cover feeds into the Marketing section, where it enriches the Amazon Description prompt with the cover's visual tone.

---

## 2. Pipeline position and sidebar integration

### 2.1 Sidebar group

A new sidebar group **Cover** is added between **Editing** and **Marketing**. It contains a single top-level entry: **Cover Generation**, which expands to show per-stage status once the feature is entered.

```
Planning
Writing
Editing
  └── Multi-pass: Review under Editorial Analysis; Revisions under Apply Revisions
Cover                          ← new group
  └── Cover Generation
        ├── Cover Brief
        ├── Archetype Selection
        ├── Generation
        ├── Refinement
        └── Export
Marketing
  ├── Blurb
  └── Amazon Description
```

### 2.2 Stage ordering

Cover Generation stages are **not** inserted into `STAGE_ORDER`. Like Marketing, they sit outside the linear unlock sequence and never block Export Final. The feature becomes available once the story-bible or creative-brief document exists on the project (i.e. canon is locked).

If neither document exists, the Cover Generation sidebar entry is shown but locked, with a tooltip: "Complete your Story Bible first to unlock Cover Generation."

### 2.3 Progress state

Each sub-stage tracks one of: `not-started`, `in-progress`, `complete`. The top-level Cover Generation entry shows the highest reached sub-stage. An approved cover image sets the feature status to `complete`.

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

**Storage:** All generated images are stored as base64 in the project database as document type `cover-image`, linked to the `cover-generate` run. Each stores: `archetypeId`, `promptUsed`, `highClickEnabled`, `runId`, `variantIndex`, `status` (`candidate` / `discarded` / `approved`).

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

---

### Stage E - Export (`cover-export`)

**Purpose:** Download the approved cover at production-ready specifications.

**Export options:**


| Format               | Spec                                | Use                |
| -------------------- | ----------------------------------- | ------------------ |
| KDP Front Cover PNG  | 2560x1600px, RGB, 300dpi equivalent | KDP upload         |
| Kindle Thumbnail PNG | 1000x625px                          | Store preview, ads |
| Square Social PNG    | 1400x1400px, title centred crop     | Social media       |


The exported image is the approved version upscaled or cropped to the target spec. gpt-image-2 outputs at 1024x1536; upscaling to KDP spec is handled server-side using sharp or equivalent (already available in the Node environment).

**Filename convention:** `[project-slug]-cover-[archetype-id]-v[version].png`

**Full-wrap template (v2):** Requires spine width calculated from final word count and chosen paper type (60lb cream, 60lb white, etc.). Spine width = (word count / average words per page) * paper thickness per page. Deferred to v2 as it requires a paper-type selector and layout compositing step not needed for digital-first KDP publishing.

---

## 4. Data model

### 4.1 New document types

The following values are added to the document `type` enum:


| Type          | Description                                              |
| ------------- | -------------------------------------------------------- |
| `cover-brief` | Structured visual direction document (JSON)              |
| `cover-image` | Individual generated image with metadata (base64 + JSON) |


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
  parentImageId: string | null, // set when this is a refinement of another image
  refinementRequest: string | null,
  version: number,
  status: 'candidate' | 'discarded' | 'approved',
  imageData: string,           // base64 PNG
  generatedAt: string          // ISO-8601
}
```

### 4.4 Project-level fields added

```typescript
approvedCoverImageId: string | null
coverGenerationStatus: 'not-started' | 'in-progress' | 'complete'
```

### 4.5 New `WorkflowStage` values

```typescript
'cover-brief'
'cover-archetype'    // configuration only, no LLM call
'cover-generate'
'cover-refine'
'cover-export'
```

`cover-archetype` and `cover-export` are not routed through `POST /api/generate`. `cover-brief`, `cover-generate`, and `cover-refine` are.

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

### 6.5 Export screen

Clean summary screen showing the approved cover image, its archetype label, and version number.

Export buttons for each format (KDP Front Cover, Kindle Thumbnail, Square Social). Each shows the target dimensions and estimated file size.

A note at the bottom of the screen: "Full-wrap template (including spine) - coming in a future update."

---

## 7. Connection to Marketing

### 7.1 Cover tone in Amazon Description

When an approved cover image exists on the project, the `buildAmazonDescriptionPrompt` function includes an additional context block:

```
**Approved cover:**
Archetype: [archetype name]
Visual tone: [cover-brief.moodKeywords joined]
Palette direction: [cover-brief.paletteDirection]
High-click optimised: [yes/no]
```

This allows the Amazon Description model to write copy that is coherent with the visual marketing - e.g. a dark atmospheric silhouette cover should produce darker, more intense copy than a cosy illustrated cover would.

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

No new API stages are required - this is a prompt assembly enrichment within the existing `amazon-description` and `blurb` stage handlers.

---

## 8. API integration details

### 8.1 Route changes

A new route `POST /api/cover/generate` handles cover generation calls separately from `POST /api/generate`. This is preferable to routing through the existing generate handler because:

- The response is binary image data, not text
- Parallel multi-archetype calls require different concurrency handling
- Image storage (base64 to SQLite) is a different persistence pattern

The cover-brief LLM call (text/JSON) continues to use `POST /api/generate` with stage `cover-brief`.

### 8.2 `POST /api/cover/generate`

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
- Results stored as `cover-image` documents per variant
- Returns array of stored document IDs and base64 data for immediate display

**Error handling:**

- Per-archetype failures are reported individually - a failure on one archetype does not cancel others
- Content policy rejections from the API are surfaced with the message: "The image model declined this prompt. Try adjusting the character description or scene elements."
- Timeout: 120s per call (image generation is slower than text)

### 8.3 `POST /api/cover/refine`

**Request body:**

```typescript
{
  projectId: string,
  parentImageId: string,
  originalPrompt: string,
  refinementRequest: string,
  n: number              // 2 default
}
```

**Behaviour:**

- Composes `refinedPrompt` = `${originalPrompt}\n\nRefinement: ${refinementRequest}. Keep all other elements consistent with the above.`
- Fires `openai.images.generate` with composed prompt
- Stores results as new `cover-image` documents with `parentImageId` set
- Returns new document IDs and base64 for immediate display

### 8.4 Model config addition

A new entry in `ALL_MODELS`:

```typescript
{
  id: 'gpt-image-2',
  displayName: 'GPT Image 2',
  provider: 'openai',
  type: 'image',
  maxContextTokens: null,  // not applicable
  usedFor: ['cover-generate', 'cover-refine']
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


---

## 11. Out of scope for v1

- Full-wrap template with calculated spine width
- Series cover consistency (shared style across books in a series)
- Canva / Photoshop handoff with layered file export
- Typography overlay compositor (in-app title positioning over image)
- A/B testing integration with ad platforms
- Cover preview mockups (3D book render, Kindle device frame)
- Direct KDP metadata upload

---

## 12. Dependencies and prerequisites


| Dependency                                              | Status                    |
| ------------------------------------------------------- | ------------------------- |
| OpenAI API key configured in settings                   | Existing                  |
| `gpt-image-2` available on the project's OpenAI account | Confirm                   |
| `sharp` for image processing / upscaling                | Add to dependencies       |
| Story bible or creative brief approved on project       | Existing (gate condition) |
| Title approved on project                               | Existing (gate condition) |
| Word count stored on project (for future full-wrap)     | Existing                  |


---

*Last updated: May 2026. Update this document when `src/app/api/cover/` routes, `src/lib/prompts/covers.ts`, or the cover document schema change.*