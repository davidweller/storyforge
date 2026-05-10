import { approvedCanonMarkdownBlock } from '@/lib/marketing/canonicalContext';
import { formatCoverCampaignPack } from '@/lib/aplus/coverStylePack';
import type { Project, ProjectDocument } from '@/types';

/**
 * Appends canon + campaign pack (+ optional reference summary) server-side so image routes
 * cannot be called with prompts that omit project truth.
 */
export function mergeTrustedAPlusImagePrompt(params: {
  clientPrompt: string;
  project: Project;
  documents: ProjectDocument[];
  /** Summarised A+ screenshot refs from describeStyleReferences. */
  referenceSummary?: string | null;
}): string {
  const { clientPrompt, project, documents } = params;
  const canon = approvedCanonMarkdownBlock(documents).trim();
  const pack = formatCoverCampaignPack(project, documents).trim();
  const ref = params.referenceSummary?.trim();

  const parts = [clientPrompt.trim()];
  if (canon) {
    parts.push('\n---\nApproved canon (Story Bible / Creative Brief — obey; server-injected):\n' + canon.slice(0, 12_000));
  }
  if (pack) {
    parts.push('\n---\nCover campaign alignment (server-injected):\n' + pack.slice(0, 6_000));
  }
  if (ref) {
    parts.push(
      '\n---\nA+ example references — synthesise language; originals are inspiration only:\n' + ref.slice(0, 4_000)
    );
  }
  return parts.join('');
}
