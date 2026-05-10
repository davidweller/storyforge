import { formatCoverToneForPrompt, resolveApprovedCoverTone } from '@/lib/cover/marketingCoverTone';
import type { Project, ProjectDocument } from '@/types';

/** Subtitle, tagline + approved cover tone — used in A+ prompting and server merges. */
export function formatCoverCampaignPack(project: Project, documents: ProjectDocument[]): string {
  const chunks: string[] = [];
  if (project.subtitle?.trim()) {
    chunks.push(`Book subtitle (packaging): ${project.subtitle.trim()}`);
  }
  if (project.tagline?.trim()) {
    chunks.push(`Tagline hook: ${project.tagline.trim()}`);
  }
  const tone = resolveApprovedCoverTone(documents, project.approvedCoverImageId);
  if (tone) {
    chunks.push(formatCoverToneForPrompt(tone));
  }
  return chunks.join('\n\n').trim();
}
