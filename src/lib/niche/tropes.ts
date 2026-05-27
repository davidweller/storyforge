import type { NicheTropes, ProjectDocument } from '@/types';
import { parseStoryBible, tryParseNicheOutput } from '@/lib/generation/schemas';

function updatedAtMs(document: ProjectDocument): number {
  return document.updatedAt instanceof Date ? document.updatedAt.getTime() : new Date(document.updatedAt).getTime();
}

function latestApprovedDocument(documents: ProjectDocument[], type: ProjectDocument['type']): ProjectDocument | undefined {
  return documents
    .filter((document) => document.type === type && document.approved)
    .sort((a, b) => b.version - a.version || updatedAtMs(b) - updatedAtMs(a))[0];
}

export function resolveCanonicalTropes(documents: ProjectDocument[]): NicheTropes | undefined {
  const storyBibleDoc = latestApprovedDocument(documents, 'story-bible');
  if (storyBibleDoc?.content.trim()) {
    try {
      const storyBible = parseStoryBible(storyBibleDoc.content).storyBible;
      if (storyBible.schemaVersion >= 2 && 'tropes' in storyBible) return storyBible.tropes;
    } catch {
      // Fall through to structured niche fallback.
    }
  }

  const nicheDoc = latestApprovedDocument(documents, 'niche');
  const niche = tryParseNicheOutput(nicheDoc?.content)?.niche;
  return niche?.tropes;
}

export function hasStructuredTropes(value: unknown): value is NicheTropes {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<NicheTropes>;
  return (
    Array.isArray(candidate.mustInclude) &&
    Array.isArray(candidate.considerIncluding) &&
    Array.isArray(candidate.avoid)
  );
}

export function formatRequiredReaderTropes(tropes: NicheTropes | undefined): string {
  if (!tropes) return '';
  const must = tropes.mustInclude.map((trope) => `- ${trope.name} - ${trope.rationale}`).join('\n');
  const consider = tropes.considerIncluding.map((trope) => `- ${trope.name} - ${trope.rationale}`).join('\n');
  const avoid = tropes.avoid.map((trope) => `- ${trope.name} - ${trope.reason}`).join('\n');

  return `## Required Reader Tropes

These tropes are commercial reader expectations for this niche. The chapter does not need to advance every trope, but the manuscript as a whole must deliver them, and nothing in this chapter should contradict them.

**Must include (deliver these):**
${must}

**Consider including (differentiators):**
${consider}

**Avoid (turn-offs for this reader):**
${avoid}`;
}

export function formatCompactTropeSummary(tropes: NicheTropes | undefined): string {
  if (!tropes?.mustInclude.length) return '';
  return `Trope must-includes: ${tropes.mustInclude.map((trope) => trope.name).join(', ')}`;
}

export function formatTropesForCanon(tropes: NicheTropes | undefined): string {
  if (!tropes) return '';
  return [
    'Reader tropes:',
    `Must include: ${tropes.mustInclude.map((trope) => trope.name).join(', ')}`,
    tropes.considerIncluding.length
      ? `Consider including: ${tropes.considerIncluding.map((trope) => trope.name).join(', ')}`
      : '',
    tropes.avoid.length ? `Avoid: ${tropes.avoid.map((trope) => trope.name).join(', ')}` : '',
  ].filter(Boolean).join('\n');
}
