import { randomUUID } from 'crypto';
import { getDb } from './index';
import type {
  Project,
  ProjectDocument,
  Chapter,
  ChapterVersion,
  EditorialIssue,
  RevisionTask,
  DocumentType,
} from '@/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function toDate(iso: string | null | undefined): Date {
  return iso ? new Date(iso) : new Date();
}

function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    userId: 'local',
    title: (row.title as string) ?? undefined,
    genre: row.genre as string,
    niche: (row.niche as string) ?? undefined,
    microniche: (row.microniche as string) ?? undefined,
    premise: (row.premise as string) ?? undefined,
    research: (row.research as string) ?? undefined,
    status: row.status as Project['status'],
    currentStage: row.currentStage as Project['currentStage'],
    fullAutoMode: Boolean(row.fullAutoMode),
    finalExportedAt: row.finalExportedAt ? toDate(row.finalExportedAt as string) : undefined,
    blurb: (row.blurb as string) ?? undefined,
    amazonDescription: (row.amazonDescription as string) ?? undefined,
    createdAt: toDate(row.createdAt as string),
    updatedAt: toDate(row.updatedAt as string),
  };
}

function rowToDocument(row: Record<string, unknown>): ProjectDocument {
  return {
    id: row.id as string,
    projectId: row.projectId as string,
    type: row.type as DocumentType,
    content: row.content as string,
    version: row.version as number,
    approved: Boolean(row.approved),
    createdAt: toDate(row.createdAt as string),
    updatedAt: toDate(row.updatedAt as string),
  };
}

function rowToChapter(row: Record<string, unknown>): Chapter {
  return {
    id: row.id as string,
    projectId: row.projectId as string,
    chapterNumber: row.chapterNumber as number,
    title: row.title as string,
    beatReference: row.beatReference as string,
    sceneGoal: row.sceneGoal as string,
    pov: (row.pov as string) ?? undefined,
    createdAt: toDate(row.createdAt as string),
    updatedAt: toDate(row.updatedAt as string),
  };
}

function rowToChapterVersion(row: Record<string, unknown>): ChapterVersion {
  return {
    id: row.id as string,
    chapterId: row.chapterId as string,
    projectId: row.projectId as string,
    chapterNumber: row.chapterNumber as number,
    version: row.version as number,
    content: row.content as string,
    wordCount: row.wordCount as number,
    approved: Boolean(row.approved),
    parentVersionId: (row.parentVersionId as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    createdAt: toDate(row.createdAt as string),
  };
}

function rowToEditorialIssue(row: Record<string, unknown>): EditorialIssue {
  return {
    id: row.id as string,
    projectId: row.projectId as string,
    chapterNumber: (row.chapterNumber as number) ?? undefined,
    locationHint: (row.locationHint as string) ?? undefined,
    category: row.category as EditorialIssue['category'],
    description: row.description as string,
    recommendedFix: row.recommendedFix as string,
    status: row.status as EditorialIssue['status'],
    createdAt: toDate(row.createdAt as string),
  };
}

function rowToRevisionTask(row: Record<string, unknown>): RevisionTask {
  return {
    id: row.id as string,
    projectId: row.projectId as string,
    chapterNumber: row.chapterNumber as number,
    issueIds: JSON.parse(row.issueIds as string) as string[],
    instructions: row.instructions as string,
    acceptanceCriteria: JSON.parse(row.acceptanceCriteria as string) as string[],
    status: row.status as RevisionTask['status'],
    createdAt: toDate(row.createdAt as string),
    updatedAt: toDate(row.updatedAt as string),
  };
}

// ── Projects ─────────────────────────────────────────────────────────────────

export async function createProject(
  _userId: string,
  data: Omit<Project, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const db = getDb();
  const id = randomUUID();
  const ts = now();
  db.prepare(`
    INSERT INTO projects
      (id, title, genre, niche, microniche, premise, research, status, currentStage,
       fullAutoMode, finalExportedAt, blurb, amazonDescription, createdAt, updatedAt)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.title ?? null,
    data.genre,
    data.niche ?? null,
    data.microniche ?? null,
    data.premise ?? null,
    data.research ?? null,
    data.status,
    data.currentStage,
    data.fullAutoMode ? 1 : 0,
    data.finalExportedAt ? data.finalExportedAt.toISOString() : null,
    data.blurb ?? null,
    data.amazonDescription ?? null,
    ts,
    ts,
  );
  return id;
}

export async function getProject(projectId: string): Promise<Project | null> {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Record<string, unknown> | undefined;
  return row ? rowToProject(row) : null;
}

export async function getUserProjects(_userId: string): Promise<Project[]> {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM projects ORDER BY updatedAt DESC').all() as Record<string, unknown>[];
  return rows.map(rowToProject);
}

export async function updateProject(
  projectId: string,
  data: Partial<Omit<Project, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title ?? null); }
  if (data.genre !== undefined) { fields.push('genre = ?'); values.push(data.genre); }
  if (data.niche !== undefined) { fields.push('niche = ?'); values.push(data.niche ?? null); }
  if (data.microniche !== undefined) { fields.push('microniche = ?'); values.push(data.microniche ?? null); }
  if (data.premise !== undefined) { fields.push('premise = ?'); values.push(data.premise ?? null); }
  if (data.research !== undefined) { fields.push('research = ?'); values.push(data.research ?? null); }
  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
  if (data.currentStage !== undefined) { fields.push('currentStage = ?'); values.push(data.currentStage); }
  if (data.fullAutoMode !== undefined) { fields.push('fullAutoMode = ?'); values.push(data.fullAutoMode ? 1 : 0); }
  if (data.finalExportedAt !== undefined) { fields.push('finalExportedAt = ?'); values.push(data.finalExportedAt ? data.finalExportedAt.toISOString() : null); }
  if (data.blurb !== undefined) { fields.push('blurb = ?'); values.push(data.blurb ?? null); }
  if (data.amazonDescription !== undefined) { fields.push('amazonDescription = ?'); values.push(data.amazonDescription ?? null); }

  if (fields.length === 0) return;
  fields.push('updatedAt = ?');
  values.push(now());
  values.push(projectId);

  db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export async function deleteProject(projectId: string): Promise<void> {
  const db = getDb();
  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
}

// ── Project Documents ─────────────────────────────────────────────────────────

export async function createDocument(
  data: Omit<ProjectDocument, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const db = getDb();
  const id = randomUUID();
  const ts = now();
  db.prepare(`
    INSERT INTO documents (id, projectId, type, content, version, approved, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.projectId, data.type, data.content, data.version, data.approved ? 1 : 0, ts, ts);
  return id;
}

export async function getDocument(documentId: string): Promise<ProjectDocument | null> {
  const db = getDb();
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId) as Record<string, unknown> | undefined;
  return row ? rowToDocument(row) : null;
}

export async function getProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM documents WHERE projectId = ? ORDER BY createdAt ASC').all(projectId) as Record<string, unknown>[];
  return rows.map(rowToDocument);
}

export async function getDocumentByType(
  projectId: string,
  type: DocumentType
): Promise<ProjectDocument | null> {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM documents WHERE projectId = ? AND type = ? ORDER BY version DESC LIMIT 1'
  ).get(projectId, type) as Record<string, unknown> | undefined;
  return row ? rowToDocument(row) : null;
}

export async function updateDocument(
  documentId: string,
  data: Partial<Omit<ProjectDocument, 'id' | 'projectId' | 'createdAt'>>
): Promise<void> {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.content !== undefined) { fields.push('content = ?'); values.push(data.content); }
  if (data.version !== undefined) { fields.push('version = ?'); values.push(data.version); }
  if (data.approved !== undefined) { fields.push('approved = ?'); values.push(data.approved ? 1 : 0); }
  if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type); }

  if (fields.length === 0) return;
  fields.push('updatedAt = ?');
  values.push(now());
  values.push(documentId);

  db.prepare(`UPDATE documents SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

// ── Chapters ──────────────────────────────────────────────────────────────────

export async function createChapter(
  data: Omit<Chapter, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const db = getDb();
  const id = randomUUID();
  const ts = now();
  db.prepare(`
    INSERT INTO chapters (id, projectId, chapterNumber, title, beatReference, sceneGoal, pov, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.projectId, data.chapterNumber, data.title, data.beatReference, data.sceneGoal, data.pov ?? null, ts, ts);
  return id;
}

export async function getChapter(chapterId: string): Promise<Chapter | null> {
  const db = getDb();
  const row = db.prepare('SELECT * FROM chapters WHERE id = ?').get(chapterId) as Record<string, unknown> | undefined;
  return row ? rowToChapter(row) : null;
}

export async function getProjectChapters(projectId: string): Promise<Chapter[]> {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM chapters WHERE projectId = ? ORDER BY chapterNumber ASC').all(projectId) as Record<string, unknown>[];
  return rows.map(rowToChapter);
}

export async function updateChapter(
  chapterId: string,
  data: Partial<Omit<Chapter, 'id' | 'projectId' | 'createdAt'>>
): Promise<void> {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.chapterNumber !== undefined) { fields.push('chapterNumber = ?'); values.push(data.chapterNumber); }
  if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
  if (data.beatReference !== undefined) { fields.push('beatReference = ?'); values.push(data.beatReference); }
  if (data.sceneGoal !== undefined) { fields.push('sceneGoal = ?'); values.push(data.sceneGoal); }
  if (data.pov !== undefined) { fields.push('pov = ?'); values.push(data.pov ?? null); }

  if (fields.length === 0) return;
  fields.push('updatedAt = ?');
  values.push(now());
  values.push(chapterId);

  db.prepare(`UPDATE chapters SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

// ── Chapter Versions ──────────────────────────────────────────────────────────

export async function createChapterVersion(
  data: Omit<ChapterVersion, 'id' | 'createdAt'>
): Promise<string> {
  const db = getDb();
  const id = randomUUID();
  const ts = now();
  db.prepare(`
    INSERT INTO chapter_versions
      (id, chapterId, projectId, chapterNumber, version, content, wordCount, approved, parentVersionId, notes, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.chapterId,
    data.projectId,
    data.chapterNumber,
    data.version,
    data.content,
    data.wordCount,
    data.approved ? 1 : 0,
    data.parentVersionId ?? null,
    data.notes ?? null,
    ts,
  );
  return id;
}

export async function getChapterVersions(chapterId: string): Promise<ChapterVersion[]> {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM chapter_versions WHERE chapterId = ? ORDER BY version DESC'
  ).all(chapterId) as Record<string, unknown>[];
  return rows.map(rowToChapterVersion);
}

export async function getLatestChapterVersion(chapterId: string): Promise<ChapterVersion | null> {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM chapter_versions WHERE chapterId = ? ORDER BY version DESC LIMIT 1'
  ).get(chapterId) as Record<string, unknown> | undefined;
  return row ? rowToChapterVersion(row) : null;
}

export async function getApprovedChapterVersions(projectId: string): Promise<ChapterVersion[]> {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM chapter_versions WHERE projectId = ? AND approved = 1 ORDER BY chapterNumber ASC'
  ).all(projectId) as Record<string, unknown>[];
  return rows.map(rowToChapterVersion);
}

export async function updateChapterVersion(
  versionId: string,
  data: Partial<Omit<ChapterVersion, 'id' | 'chapterId' | 'createdAt'>>
): Promise<void> {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.content !== undefined) { fields.push('content = ?'); values.push(data.content); }
  if (data.wordCount !== undefined) { fields.push('wordCount = ?'); values.push(data.wordCount); }
  if (data.approved !== undefined) { fields.push('approved = ?'); values.push(data.approved ? 1 : 0); }
  if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes ?? null); }

  if (fields.length === 0) return;
  values.push(versionId);

  db.prepare(`UPDATE chapter_versions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

// ── Editorial Issues ──────────────────────────────────────────────────────────

export async function createEditorialIssue(
  data: Omit<EditorialIssue, 'id' | 'createdAt'>
): Promise<string> {
  const db = getDb();
  const id = randomUUID();
  const ts = now();
  db.prepare(`
    INSERT INTO editorial_issues
      (id, projectId, chapterNumber, locationHint, category, description, recommendedFix, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.chapterNumber ?? null,
    data.locationHint ?? null,
    data.category,
    data.description,
    data.recommendedFix,
    data.status,
    ts,
  );
  return id;
}

export async function getProjectEditorialIssues(projectId: string): Promise<EditorialIssue[]> {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM editorial_issues WHERE projectId = ? ORDER BY chapterNumber ASC'
  ).all(projectId) as Record<string, unknown>[];
  return rows.map(rowToEditorialIssue);
}

export async function updateEditorialIssue(
  issueId: string,
  data: Partial<Omit<EditorialIssue, 'id' | 'projectId' | 'createdAt'>>
): Promise<void> {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  if (data.recommendedFix !== undefined) { fields.push('recommendedFix = ?'); values.push(data.recommendedFix); }

  if (fields.length === 0) return;
  values.push(issueId);

  db.prepare(`UPDATE editorial_issues SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

// ── Revision Tasks ────────────────────────────────────────────────────────────

export async function createRevisionTask(
  data: Omit<RevisionTask, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const db = getDb();
  const id = randomUUID();
  const ts = now();
  db.prepare(`
    INSERT INTO revision_tasks
      (id, projectId, chapterNumber, issueIds, instructions, acceptanceCriteria, status, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.chapterNumber,
    JSON.stringify(data.issueIds),
    data.instructions,
    JSON.stringify(data.acceptanceCriteria),
    data.status,
    ts,
    ts,
  );
  return id;
}

export async function getProjectRevisionTasks(projectId: string): Promise<RevisionTask[]> {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM revision_tasks WHERE projectId = ? ORDER BY chapterNumber ASC'
  ).all(projectId) as Record<string, unknown>[];
  return rows.map(rowToRevisionTask);
}

export async function updateRevisionTask(
  taskId: string,
  data: Partial<Omit<RevisionTask, 'id' | 'projectId' | 'createdAt'>>
): Promise<void> {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
  if (data.instructions !== undefined) { fields.push('instructions = ?'); values.push(data.instructions); }
  if (data.acceptanceCriteria !== undefined) { fields.push('acceptanceCriteria = ?'); values.push(JSON.stringify(data.acceptanceCriteria)); }
  if (data.issueIds !== undefined) { fields.push('issueIds = ?'); values.push(JSON.stringify(data.issueIds)); }

  if (fields.length === 0) return;
  fields.push('updatedAt = ?');
  values.push(now());
  values.push(taskId);

  db.prepare(`UPDATE revision_tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

// ── Batch delete ──────────────────────────────────────────────────────────────

export async function deleteProjectData(projectId: string): Promise<void> {
  const db = getDb();
  const deleteAll = db.transaction(() => {
    db.prepare('DELETE FROM revision_tasks WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM editorial_issues WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM chapter_versions WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM chapters WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM documents WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
  });
  deleteAll();
}
