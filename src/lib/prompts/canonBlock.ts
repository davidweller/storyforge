/**
 * Shared canon formatting for prompt caching. Callers assemble final user text with
 * `prependCanonToUserPrompt` when not using Anthropic cached system blocks.
 */

/** Between cached system sections (minimal, stable delimiter). */
export const ANTHROPIC_CANON_SYSTEM_DELIMITER = '\n\n---\n\n';

export type PromptParts = { userPrompt: string; canon: string };

/** Raw assembled context trimmed, or empty when absent. */
export function normalizeCanonRaw(value: string | undefined): string {
  return value?.trim() ? value.trim() : '';
}

/** Canon block as inlined in chapter draft prompts (matches historical buildChapterPrompt). */
export function formatChapterDraftCanonBlock(raw: string): string {
  return `## Canon Context

Use this bounded canon context as the primary source of truth. Treat hard constraints as binding, preserve unresolved threads unless the chapter goal advances them, and prefer the chapter-specific goal when generic guidance conflicts.

${raw}
`;
}

/** Scene pipeline / polish — matches historical "## Canon context\\n". */
export function formatSceneCanonBlock(raw: string): string {
  return `## Canon context
${raw}
`;
}

/** Scene eval compact canon line — matches historical section body (heading stays in user). */
export function formatEvalCanonBody(raw: string): string {
  return raw.trim() ? raw.trim() : '(none)';
}

/** Revision primary canon — matches historical "**Bounded Canon Context (primary):**". */
export function formatRevisionPrimaryCanonBlock(raw: string): string {
  return `**Bounded Canon Context (primary):**
${raw}

`;
}

/**
 * For OpenRouter/OpenAI/non-cached Anthropic: prepend formatted canon before user prompt.
 * When `canon` is empty, returns `userPrompt` unchanged.
 */
export function prependCanonToUserPrompt(
  formattedCanonBlock: string,
  userPrompt: string,
): string {
  const block = formattedCanonBlock.trimEnd();
  if (!block) return userPrompt;
  return `${block}\n\n${userPrompt}`;
}

/** Insert chapter-draft canon immediately after `## Story Context` (matches legacy layout). */
export function mergeChapterDraftCanonIntoUserPrompt(userPrompt: string, formattedCanon: string): string {
  const block = formattedCanon.trimEnd();
  if (!block) return userPrompt;
  const needle = '## Story Context\n\n';
  const idx = userPrompt.indexOf(needle);
  if (idx === -1) {
    return prependCanonToUserPrompt(formattedCanon, userPrompt);
  }
  const insertAt = idx + needle.length;
  return userPrompt.slice(0, insertAt) + `${block}\n\n` + userPrompt.slice(insertAt);
}

/** Insert revision primary canon after "...Ensure your revisions align with these:" */
export function mergeRevisionPrimaryCanonIntoUserPrompt(userPrompt: string, formattedCanon: string): string {
  const block = formattedCanon.trimEnd();
  if (!block) return userPrompt;
  const needle = 'Ensure your revisions align with these:\n\n';
  const idx = userPrompt.indexOf(needle);
  if (idx === -1) return userPrompt;
  const insertAt = idx + needle.length;
  return userPrompt.slice(0, insertAt) + `${block}\n` + userPrompt.slice(insertAt);
}

/**
 * Build editorial reference appendix (report + issues-queue) for cache or inline use.
 * Order matches historical buildEditorialPrompt / buildEditorialIssuesQueuePrompt.
 */
export function formatEditorialReferenceAppendix(params: {
  assembledContext?: string;
  nicheReference?: string;
  charactersReference?: string;
  endingReference?: string;
  structureReference?: string;
  /** When true, use editorial-issues headings (### Assembled canon context, etc.). */
  variant: 'report' | 'issues';
}): string {
  const {
    assembledContext,
    nicheReference,
    charactersReference,
    endingReference,
    structureReference,
    variant,
  } = params;

  if (variant === 'issues') {
    let body = `## Canon / references

`;
    if (assembledContext?.trim()) {
      body += `### Assembled canon context\n${assembledContext}\n\n`;
    }
    if (nicheReference?.trim()) {
      body += `### Niche / audience${assembledContext ? ' (fallback)' : ''}\n${nicheReference}\n\n`;
    }
    if (charactersReference?.trim()) {
      body += `### Characters${assembledContext ? ' (fallback)' : ''}\n${charactersReference}\n\n`;
    }
    if (endingReference?.trim()) {
      body += `### Ending direction${assembledContext ? ' (fallback)' : ''}\n${endingReference.slice(0, 3200)}\n\n`;
    }
    if (structureReference?.trim()) {
      body += `### Structure${assembledContext ? ' (fallback)' : ''}\n${structureReference.slice(0, 2000)}\n\n`;
    }
    return body;
  }

  let prompt = `## Reference documents (canon)

Use these for consistency checks alongside the manuscript:
`;

  if (assembledContext?.trim()) {
    prompt += `
## Canon Context

Use this bounded canon context as the primary source of truth for continuity, style, character promises, hard constraints, and intended payoffs. Treat hard constraints as binding when evaluating the manuscript.

${assembledContext}
`;
  }

  if (nicheReference?.trim()) {
    prompt += `
**Target audience & positioning${assembledContext ? ' (fallback only)' : ''}:**
${nicheReference}
`;
  }

  if (charactersReference?.trim()) {
    prompt += `
**Character profiles${assembledContext ? ' (fallback only)' : ''}:**
${charactersReference}
`;
  }

  if (endingReference?.trim()) {
    prompt += `
**Intended ending${assembledContext ? ' (fallback only)' : ''}:**
${endingReference}
`;
  }

  if (structureReference?.trim()) {
    prompt += `
**Story structure${assembledContext ? ' (fallback only)' : ''}:**
${structureReference}
`;
  }

  return prompt;
}
