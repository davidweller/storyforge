/**
 * Manuscript length limits for editorial review (input estimate: manuscript + reference docs + prompt overhead).
 * Capped below 1M context models so a full manuscript + references still fits with counting variance.
 * Per-request limit is still min(this, selected model maxContextTokens) in the generate API.
 * Token estimate: ~4 chars/token. Word estimate: ~5 chars/word → words = tokens * 4/5.
 */
export const MAX_MANUSCRIPT_TOKENS = 900_000;
export const MAX_MANUSCRIPT_WORDS = 720_000; // 900_000 * 4/5

/** Standard novel length used for outline and chapter word budgeting (target ~80k words). */
export const TARGET_MANUSCRIPT_WORDS = 80_000;

/** Phase 4: when false, chapter-polish stage is hidden/disabled regardless of per-run toggles. */
export const CHAPTER_POLISH_FEATURE_ENABLED = true;

/** Phase 4: Full Auto scene pipeline ships off by default (see Phase 4 plan §8). */
export const FULL_AUTO_USE_SCENE_PIPELINE_DEFAULT = false;

/** Phase 4 model rubric: combined input budget (scene plan + chapter + canon text). */
export const CHAPTER_SCENE_EVAL_INPUT_TOKEN_BUDGET = 6_000;

/** Phase 4 model rubric: max output tokens for evaluation JSON. */
export const CHAPTER_SCENE_EVAL_OUTPUT_TOKEN_BUDGET = 800;
