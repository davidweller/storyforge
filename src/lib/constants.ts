/**
 * Manuscript length limits for editorial review.
 * Kept under model context (e.g. 200k) so full-manuscript editorial analysis always fits.
 * Token estimate: ~4 chars/token. Word estimate: ~5 chars/word → words = tokens * 4/5.
 */
export const MAX_MANUSCRIPT_TOKENS = 190_000;
export const MAX_MANUSCRIPT_WORDS = 152_000; // 190_000 * 4/5
