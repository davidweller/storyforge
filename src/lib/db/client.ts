// Client-side database abstraction — all operations are sent to /api/db
// which runs them server-side against the local SQLite database.
// This file has NO Node.js imports and is safe to use in browser bundles.

import type {
  Project,
  ProjectDocument,
  Chapter,
  ChapterVersion,
  EditorialIssue,
  RevisionTask,
  DocumentType,
  GenerationUsageTotals,
} from '@/types';

// Dates arrive from the API as ISO strings; restore them to Date objects.
function reviveDates<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(reviveDates) as unknown as T;
  const result = { ...obj } as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (
      typeof val === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)
    ) {
      result[key] = new Date(val);
    } else if (val && typeof val === 'object') {
      result[key] = reviveDates(val);
    }
  }
  return result as T;
}

async function dbCall<T>(action: string, args: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...args }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Database error' }));
    throw new Error(err.error || 'Database operation failed');
  }
  const data = await response.json();
  return reviveDates<T>(data);
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function createProject(
  userId: string,
  data: Omit<Project, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  return dbCall<string>('createProject', { userId, data });
}

export async function getProject(projectId: string): Promise<Project | null> {
  return dbCall<Project | null>('getProject', { projectId });
}

export async function getUserProjects(userId: string): Promise<Project[]> {
  return dbCall<Project[]>('getUserProjects', { userId });
}

export async function updateProject(
  projectId: string,
  data: Partial<Omit<Project, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
  await dbCall<{ ok: true }>('updateProject', { projectId, data });
}

export async function deleteProjectData(projectId: string): Promise<void> {
  await dbCall<{ ok: true }>('deleteProjectData', { projectId });
}

export async function enterSerialisation(
  projectId: string
): Promise<{ serialBibleId: string }> {
  return dbCall<{ serialBibleId: string }>('enterSerialisation', { projectId });
}

export async function discardSerialisation(projectId: string): Promise<void> {
  await dbCall<{ ok: true }>('discardSerialisation', { projectId });
}

export async function getProjectGenerationUsageTotals(
  projectId: string
): Promise<GenerationUsageTotals> {
  return dbCall<GenerationUsageTotals>('getProjectGenerationUsageTotals', { projectId });
}

// ── Project Documents ─────────────────────────────────────────────────────────

export async function createDocument(
  data: Omit<ProjectDocument, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  return dbCall<string>('createDocument', { data });
}

export async function getProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
  return dbCall<ProjectDocument[]>('getProjectDocuments', { projectId });
}

export async function getDocumentByType(
  projectId: string,
  type: DocumentType
): Promise<ProjectDocument | null> {
  return dbCall<ProjectDocument | null>('getDocumentByType', { projectId, type });
}

export async function updateDocument(
  documentId: string,
  data: Partial<Omit<ProjectDocument, 'id' | 'projectId' | 'createdAt'>>
): Promise<void> {
  await dbCall<{ ok: true }>('updateDocument', { documentId, data });
}

// ── Chapters ──────────────────────────────────────────────────────────────────

export async function createChapter(
  data: Omit<Chapter, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  return dbCall<string>('createChapter', { data });
}

export async function getProjectChapters(projectId: string): Promise<Chapter[]> {
  return dbCall<Chapter[]>('getProjectChapters', { projectId });
}

export async function updateChapter(
  chapterId: string,
  data: Partial<Omit<Chapter, 'id' | 'projectId' | 'createdAt'>>
): Promise<void> {
  await dbCall<{ ok: true }>('updateChapter', { chapterId, data });
}

// ── Chapter Versions ──────────────────────────────────────────────────────────

export async function createChapterVersion(
  data: Omit<ChapterVersion, 'id' | 'createdAt'>
): Promise<string> {
  return dbCall<string>('createChapterVersion', { data });
}

export async function getChapterVersions(chapterId: string): Promise<ChapterVersion[]> {
  return dbCall<ChapterVersion[]>('getChapterVersions', { chapterId });
}

export async function getApprovedChapterVersions(projectId: string): Promise<ChapterVersion[]> {
  return dbCall<ChapterVersion[]>('getApprovedChapterVersions', { projectId });
}

export async function updateChapterVersion(
  versionId: string,
  data: Partial<Omit<ChapterVersion, 'id' | 'chapterId' | 'createdAt'>>
): Promise<void> {
  await dbCall<{ ok: true }>('updateChapterVersion', { versionId, data });
}

// ── Editorial Issues ──────────────────────────────────────────────────────────

export async function createEditorialIssue(
  data: Omit<EditorialIssue, 'id' | 'createdAt'>
): Promise<string> {
  return dbCall<string>('createEditorialIssue', { data });
}

export async function getProjectEditorialIssues(projectId: string): Promise<EditorialIssue[]> {
  return dbCall<EditorialIssue[]>('getProjectEditorialIssues', { projectId });
}

export async function updateEditorialIssue(
  issueId: string,
  data: Partial<Omit<EditorialIssue, 'id' | 'projectId' | 'createdAt'>>
): Promise<void> {
  await dbCall<{ ok: true }>('updateEditorialIssue', { issueId, data });
}

export async function getEditorialIssuesByIds(ids: string[]): Promise<EditorialIssue[]> {
  return dbCall<EditorialIssue[]>('getEditorialIssuesByIds', { ids });
}

export async function updateEditorialIssueTaskId(
  issueId: string,
  revisionTaskId: string | null
): Promise<void> {
  await dbCall<{ ok: true }>('updateEditorialIssueTaskId', { issueId, revisionTaskId });
}

// ── Revision Tasks ────────────────────────────────────────────────────────────

export async function createRevisionTask(
  data: Omit<RevisionTask, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  return dbCall<string>('createRevisionTask', { data });
}

export async function getProjectRevisionTasks(projectId: string): Promise<RevisionTask[]> {
  return dbCall<RevisionTask[]>('getProjectRevisionTasks', { projectId });
}

export async function updateRevisionTask(
  taskId: string,
  data: Partial<Omit<RevisionTask, 'id' | 'projectId' | 'createdAt'>>
): Promise<void> {
  await dbCall<{ ok: true }>('updateRevisionTask', { taskId, data });
}

export async function deleteRevisionTasksForProjectAndPass(
  projectId: string,
  pass: import('@/types').EditorialPass
): Promise<void> {
  await dbCall<{ ok: true }>('deleteRevisionTasksForProjectAndPass', { projectId, pass });
}
