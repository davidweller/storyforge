# Tropes Workflow

## Is There A Dedicated Tropes Page?

No. Tropes do not currently have their own sidebar page, review screen, picker, autocomplete, or form.

Tropes are handled through the existing planning and canon flow:

1. Planning -> Reader Targeting
2. Writing -> Story Bible & Canon
3. Downstream chapter, scene, and marketing prompts

## Where Tropes Are First Created

Tropes are generated in the `Reader Targeting` stage, which maps to the `niche` document type.

New `Reader Targeting` runs now return structured JSON with:

- `mustInclude`
- `considerIncluding`
- `avoid`

Each trope has a reader-facing name and either a `rationale` or `reason`.

## Where Tropes Are Visible

Structured tropes are visible on the `Reader Targeting` page.

When the niche document parses as structured JSON, the page renders:

- Emotional promise
- Must include tropes
- Consider including tropes
- Avoid tropes
- Full niche summary

The implementation is in:

- `src/components/niche/NicheReadableView.tsx`
- `src/app/(dashboard)/projects/[projectId]/stage/[stageId]/page.tsx`

## Can The User Input Or Edit Tropes?

There is no dedicated trope input form.

For an unapproved structured `Reader Targeting` draft, the existing stage edit flow can still edit the raw JSON. That is currently the only way to manually change trope names, rationales, or categories.

Once approved, the document is locked like the other planning artifacts.

## Legacy Niche Documents

If a project has an older prose-only niche document, the `Reader Targeting` page shows:

`Re-extract structured tropes`

That action sends the existing niche prose back through the `niche` generation stage using `existingNicheReference`, then saves a new unapproved niche version. The user can review and approve it before it affects canon.

## How Tropes Become Canon

Tropes become durable canon when the Story Bible is regenerated.

Story Bible v2 includes:

- `tropes`
- `tropesSource`

If structured niche tropes exist, the Story Bible prompt tells the model to preserve them exactly.

If only legacy prose exists, the model extracts best-effort tropes from the prose and marks them as extracted from prose.

## Resolution Order

Downstream prompts resolve tropes in this order:

1. Approved Story Bible v2 `tropes`
2. Approved structured niche `tropes`
3. No tropes section

This logic lives in:

- `src/lib/niche/tropes.ts`
- `src/lib/context/assembler.ts`

## Where Tropes Are Used

Structured tropes are injected into:

- Chapter outlines
- Chapter drafting
- Chapter revision
- Scene planning
- Scene prose
- Scene evaluation via compact canon
- Blurb generation
- Amazon description generation

Marketing prompts use trope handles more compactly, especially for Amazon's "Perfect for readers who love" bullets.

## What Does Not Exist Yet

The current implementation does not include:

- A dedicated sidebar item for tropes
- A trope picker
- Trope autocomplete
- A curated trope taxonomy
- Per-chapter trope coverage tracking
- A visual trope editing form
