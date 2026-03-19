import { estimateTokens } from '@/lib/utils';

/**
 * Wrap a reference document in a labelled block for prompt injection.
 *
 * - Returns an empty string when content is absent, so callers can safely
 *   concatenate without emitting empty sections.
 * - Truncates content that would bust the budget (default 60 000 tokens ≈ ~240 000 chars),
 *   appending a note so the model knows the text was cut.
 * - Trims leading/trailing whitespace before inserting.
 */
export function contextBlock(
  label: string,
  content: string | null | undefined,
  maxTokens = 60_000
): string {
  if (!content?.trim()) return '';

  const trimmed = content.trim();
  const maxChars = maxTokens * 4; // rough inverse of estimateTokens heuristic

  if (estimateTokens(trimmed) > maxTokens) {
    const truncated = trimmed.slice(0, maxChars);
    return `<${label}>\n${truncated}\n[...content truncated to fit context limit...]\n</${label}>\n\n`;
  }

  return `<${label}>\n${trimmed}\n</${label}>\n\n`;
}
