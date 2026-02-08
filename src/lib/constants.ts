/**
 * Manuscript length limits for editorial review.
 * Kept under model context (e.g. 200k) so full-manuscript editorial analysis always fits.
 * Token estimate: ~4 chars/token. Word estimate: ~5 chars/word → words = tokens * 4/5.
 */
export const MAX_MANUSCRIPT_TOKENS = 190_000;
export const MAX_MANUSCRIPT_WORDS = 152_000; // 190_000 * 4/5

/** Standard novel length used for outline and chapter word budgeting (target ~80k words). */
export const TARGET_MANUSCRIPT_WORDS = 80_000;
