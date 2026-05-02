import type Anthropic from '@anthropic-ai/sdk';
import { estimateTokens } from '@/lib/utils';
import { ANTHROPIC_CANON_SYSTEM_DELIMITER } from '@/lib/prompts/canonBlock';

/** Re-verify against https://docs.anthropic.com when upgrading models; floors have changed before. */
export function anthropicCacheMinInputTokens(): number {
  const raw = process.env.ANTHROPIC_CACHE_MIN_INPUT_TOKENS;
  if (raw !== undefined && raw !== '') {
    const n = Number(raw);
    if (!Number.isNaN(n) && n >= 256) return Math.floor(n);
  }
  return 1024;
}

export type CachedSystemMergeInput = {
  staticSystem: string;
  /** Pre-formatted canon block; empty uses staticSystem only. */
  formattedCanon: string;
};

/**
 * Single-breakpoint merge: static + delimiter + optional canon, one ephemeral cache_control.
 * Returns `undefined` when estimated tokens fall below the configured minimum (caller uses string system).
 */
export function buildAnthropicCachedSystemBlocks(
  input: CachedSystemMergeInput,
): Anthropic.Messages.MessageCreateParams['system'] | undefined {
  const staticPart = input.staticSystem.trimEnd();
  const canonPart = input.formattedCanon.trim();
  const merged = canonPart
    ? `${staticPart}${ANTHROPIC_CANON_SYSTEM_DELIMITER}${canonPart}`
    : staticPart;

  if (estimateTokens(merged) < anthropicCacheMinInputTokens()) {
    return undefined;
  }

  return [
    {
      type: 'text' as const,
      text: merged,
      cache_control: { type: 'ephemeral' as const },
    },
  ];
}

export function logAnthropicPromptCacheUsage(
  label: string,
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  },
): void {
  const created = usage.cache_creation_input_tokens ?? 0;
  const read = usage.cache_read_input_tokens ?? 0;
  if (created > 0 || read > 0) {
    console.log('[Anthropic] prompt_cache', {
      label,
      cache_creation_input_tokens: created,
      cache_read_input_tokens: read,
      input_tokens: usage.input_tokens,
    });
  }
}
