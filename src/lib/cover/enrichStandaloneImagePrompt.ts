import type { Project, ProjectDocument } from '@/types';
import { summarizeStyleReferencesForPrompt } from '@/lib/cover/describeStyleReferences';
import { formatCanonSummaryForCoverPrompt } from '@/lib/marketing/canonicalContext';
import { parseProjectStyleReferences } from '@/lib/cover/styleReferences';

/**
 * Build a shared suffix for standalone cover image routes (one vision call per batch when refs exist).
 */
export async function buildCoverStandalonePromptAnchor(documents: ProjectDocument[], project: Project): Promise<string> {
  const canon = formatCanonSummaryForCoverPrompt(documents).trim();

  let refBlock = '';
  const refs = parseProjectStyleReferences(project.coverStyleReferencesJson);
  if (refs.length) {
    try {
      refBlock = await summarizeStyleReferencesForPrompt(refs, 'cover');
    } catch {
      refBlock = '';
    }
  }

  const parts: string[] = [];
  if (canon) {
    parts.push(
      `Canon anchor (approved Story Bible / Creative Brief — obey; server-injected):\n${canon}`
    );
  }
  if (refBlock.trim()) {
    parts.push(
      `Reference-cover style cues (synthesise; do not plagiarise):\n${refBlock.trim().slice(0, 3800)}`
    );
  }
  if (!parts.length) return '';
  return `\n\n---\n${parts.join('\n\n---\n')}`;
}
