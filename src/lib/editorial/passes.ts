import type { DocumentType, EditorialPass, Project, RevisionTask } from '@/types';

export const EDITORIAL_PASSES: readonly EditorialPass[] = [
  'structural',
  'line',
  'copy',
  'proofread',
] as const;

export const EDITORIAL_PASS_LABELS: Record<EditorialPass, string> = {
  structural: 'Structural',
  line: 'Line edit',
  copy: 'Copy edit',
  proofread: 'Proofread',
};

export const DOCUMENT_TYPE_BY_PASS: Record<EditorialPass, DocumentType> = {
  structural: 'editorial-structural',
  line: 'editorial-line',
  copy: 'editorial-copy',
  proofread: 'editorial-proofread',
};

export function documentTypeForEditorialPass(pass: EditorialPass): DocumentType {
  return DOCUMENT_TYPE_BY_PASS[pass];
}

export function parseEditorialPass(s: string | null | undefined): EditorialPass | null {
  if (!s) return null;
  return EDITORIAL_PASSES.includes(s as EditorialPass) ? (s as EditorialPass) : null;
}

export function passIndex(pass: EditorialPass): number {
  return EDITORIAL_PASSES.indexOf(pass);
}

export function previousEditorialPass(pass: EditorialPass): EditorialPass | null {
  const i = passIndex(pass);
  return i > 0 ? EDITORIAL_PASSES[i - 1] : null;
}

/** Legacy single editorial document maps to structural pass. */
export function latestEditorialDocContentForPass(
  documents: { type: DocumentType; content: string; version: number }[],
  pass: EditorialPass
): { content: string; sortVersion: number } | null {
  const primaryType = documentTypeForEditorialPass(pass);
  const primary = documents.filter((d) => d.type === primaryType);
  if (primary.length > 0) {
    const best = primary.sort((a, b) => b.version - a.version)[0];
    return { content: best.content, sortVersion: best.version };
  }
  if (pass === 'structural') {
    const legacy = documents.filter((d) => d.type === 'editorial');
    if (legacy.length > 0) {
      const best = legacy.sort((a, b) => b.version - a.version)[0];
      return { content: best.content, sortVersion: best.version };
    }
  }
  return null;
}

export function approvedEditorialDocForPass(
  documents: { type: DocumentType; approved: boolean }[],
  pass: EditorialPass
): boolean {
  const t = documentTypeForEditorialPass(pass);
  if (documents.some((d) => d.type === t && d.approved)) return true;
  if (pass === 'structural') {
    return documents.some((d) => d.type === 'editorial' && d.approved);
  }
  return false;
}

export function tasksForPass(tasks: RevisionTask[], pass: EditorialPass): RevisionTask[] {
  return tasks.filter((t) => t.editPass === pass);
}

export function passRevisionTasksAllDone(tasks: RevisionTask[], pass: EditorialPass): boolean {
  const subset = tasksForPass(tasks, pass);
  return subset.length > 0 && subset.every((t) => t.status === 'done');
}

export function hasMultiPassRevisionTasks(tasks: RevisionTask[]): boolean {
  return tasks.some((t) => t.editPass !== 'structural');
}

/**
 * User may export after revision when: legacy project and all tasks done, or four-pass pipeline complete (proofread pass existed and all tasks done).
 */
export function canProceedToExportFinal(
  project: Pick<Project, 'fourPassEditorial'> | null | undefined,
  revisionTasks: RevisionTask[]
): boolean {
  if (!revisionTasks.length) return false;
  const allDone = revisionTasks.every((t) => t.status === 'done');
  if (!allDone) return false;
  if (!project?.fourPassEditorial) return true;
  if (!hasMultiPassRevisionTasks(revisionTasks)) return false;
  return revisionTasks.some((t) => t.editPass === 'proofread');
}

export function canStartEditorialPass(
  pass: EditorialPass,
  chapters: { id: string }[],
  getApprovedChapterVersion: (chapterId: string) => { content: string } | undefined,
  revisionTasks: RevisionTask[]
): boolean {
  for (const ch of chapters) {
    if (!getApprovedChapterVersion(ch.id)) return false;
  }
  if (pass === 'structural') return true;
  const prev = previousEditorialPass(pass);
  if (!prev) return false;
  return passRevisionTasksAllDone(revisionTasks, prev);
}
