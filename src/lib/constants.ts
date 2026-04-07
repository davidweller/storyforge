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
