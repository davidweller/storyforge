import { randomUUID } from 'crypto';
import { getDb } from './index';
import { appendGenerationUsageFallback, sumFallbackUsageForProject } from './generationUsageFallback';
import { recordUsageRecordFailure, recordUsageFallbackAppend } from '@/lib/db/usageLogMetrics';
import type {
  Project,
  ProjectDocument,
  Chapter,
  ChapterVersion,
  EditorialIssue,
  RevisionTask,
  DocumentType,
  EditorialPass,
  GenerationUsageSource,
  WorkflowStage,
  GenerationUsageTotals,
} from '@/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function toDate(iso: string | null | undefined): Date {
  return iso ? new Date(iso) : new Date();
}

/** Persist optional timestamps: callers may pass Date, ISO string, or epoch from JSON. */
function optionalDateToIso(value: Date | string | number | undefined | null): string | null {
  if (value == null) return null;
  const d =
    value instanceof Date
      ? value
      : typeof value === 'number'
        ? new Date(value)
        : typeof value === 'string' && value.trim() !== ''
          ? new Date(value)
          : null;
  if (d == null || Number.isNaN(d.getTime())) return null;
  return d.toISOString();
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
    fourPassEditorial: row.fourPassEditorial !== undefined && row.fourPassEditorial !== null
      ? Boolean(row.fourPassEditorial)
      : false,
    finalExportedAt: row.finalExportedAt ? toDate(row.finalExportedAt as string) : undefined,
    blurb: (row.blurb as string) ?? undefined,
    amazonDescription: (row.amazonDescription as string) ?? undefined,
    approvedCoverImageId: (row.approvedCoverImageId as string | null) ?? undefined,
    approvedBackCoverImageId: (row.approvedBackCoverImageId as string | null) ?? undefined,
    coverGenerationStatus:
      typeof row.coverGenerationStatus === 'string'
        ? (row.coverGenerationStatus as import('@/types').CoverTrackStatus)
        : 'not-started',
    paperbackGenerationStatus:
      typeof row.paperbackGenerationStatus === 'string'
        ? (row.paperbackGenerationStatus as import('@/types').CoverTrackStatus)
        : 'not-started',
    createdAt: toDate(row.createdAt as string),
    updatedAt: toDate(row.updatedAt as string),
  };
}

function rowToDocument(row: Record<string, unknown>): ProjectDocument {
  const chapterNumber = row.chapterNumber;
  return {
    id: row.id as string,
    projectId: row.projectId as string,
    type: row.type as DocumentType,
    ...(typeof chapterNumber === 'number' ? { chapterNumber } : {}),
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
  let sceneSegments: ChapterVersion['sceneSegments'];
  const rawSeg = row.sceneSegments as string | null | undefined;
  if (rawSeg?.trim()) {
    try {
      sceneSegments = JSON.parse(rawSeg) as ChapterVersion['sceneSegments'];
    } catch {
      sceneSegments = undefined;
    }
  }
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
    ...(sceneSegments?.length ? { sceneSegments } : {}),
    createdAt: toDate(row.createdAt as string),
  };
}

function rowToEditorialIssue(row: Record<string, unknown>): EditorialIssue {
  const ep = row.editPass as string | undefined;
  const editPass: EditorialPass =
    ep === 'line' || ep === 'copy' || ep === 'proofread' || ep === 'structural' || ep === 'final_report'
      ? ep
      : 'structural';
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
    editPass,
    revisionTaskId: (row.revisionTaskId as string) ?? undefined,
    manuscriptQuote: (row.manuscriptQuote as string) ?? undefined,
    sceneId: (row.sceneId as string) ?? undefined,
  };
}

function rowToRevisionTask(row: Record<string, unknown>): RevisionTask {
  const ep = row.editPass as string | undefined;
  const editPass: EditorialPass =
    ep === 'line' || ep === 'copy' || ep === 'proofread' || ep === 'structural' || ep === 'final_report'
      ? ep
      : 'structural';
  return {
    id: row.id as string,
    projectId: row.projectId as string,
    chapterNumber: row.chapterNumber as number,
    editPass,
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
       fullAutoMode, fourPassEditorial, finalExportedAt, blurb, amazonDescription, createdAt, updatedAt)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    data.fourPassEditorial !== false ? 1 : 0,
    optionalDateToIso(data.finalExportedAt ?? null),
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
  if (data.fourPassEditorial !== undefined) { fields.push('fourPassEditorial = ?'); values.push(data.fourPassEditorial ? 1 : 0); }
  if (data.finalExportedAt !== undefined) {
    fields.push('finalExportedAt = ?');
    values.push(optionalDateToIso(data.finalExportedAt ?? null));
  }
  if (data.blurb !== undefined) { fields.push('blurb = ?'); values.push(data.blurb ?? null); }
  if (data.amazonDescription !== undefined) { fields.push('amazonDescription = ?'); values.push(data.amazonDescription ?? null); }
  if (data.approvedCoverImageId !== undefined) {
    fields.push('approvedCoverImageId = ?');
    values.push(data.approvedCoverImageId ?? null);
  }
  if (data.approvedBackCoverImageId !== undefined) {
    fields.push('approvedBackCoverImageId = ?');
    values.push(data.approvedBackCoverImageId ?? null);
  }
  if (data.coverGenerationStatus !== undefined) {
    fields.push('coverGenerationStatus = ?');
    values.push(data.coverGenerationStatus);
  }
  if (data.paperbackGenerationStatus !== undefined) {
    fields.push('paperbackGenerationStatus = ?');
    values.push(data.paperbackGenerationStatus);
  }

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
    INSERT INTO documents (id, projectId, type, chapterNumber, content, version, approved, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.type,
    data.chapterNumber ?? null,
    data.content,
    data.version,
    data.approved ? 1 : 0,
    ts,
    ts
  );
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
    'SELECT * FROM documents WHERE projectId = ? AND type = ? AND chapterNumber IS NULL ORDER BY version DESC LIMIT 1'
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
  if (data.chapterNumber !== undefined) { fields.push('chapterNumber = ?'); values.push(data.chapterNumber ?? null); }

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
      (id, chapterId, projectId, chapterNumber, version, content, wordCount, approved, parentVersionId, notes, sceneSegments, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    data.sceneSegments?.length ? JSON.stringify(data.sceneSegments) : null,
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
  if (data.sceneSegments !== undefined) {
    fields.push('sceneSegments = ?');
    values.push(data.sceneSegments?.length ? JSON.stringify(data.sceneSegments) : null);
  }

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
      (id, projectId, chapterNumber, locationHint, category, description, recommendedFix, status, createdAt,
       editPass, revisionTaskId, manuscriptQuote, sceneId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    data.editPass,
    data.revisionTaskId ?? null,
    data.manuscriptQuote ?? null,
    data.sceneId ?? null,
  );
  return id;
}

export async function deleteEditorialIssuesByProjectAndPass(
  projectId: string,
  pass: EditorialPass
): Promise<void> {
  const db = getDb();
  db.prepare('DELETE FROM editorial_issues WHERE projectId = ? AND editPass = ?').run(projectId, pass);
}

export async function getEditorialIssuesByIds(ids: string[]): Promise<EditorialIssue[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  const placeholders = ids.map(() => '?').join(', ');
  const rows = db
    .prepare(`SELECT * FROM editorial_issues WHERE id IN (${placeholders})`)
    .all(...ids) as Record<string, unknown>[];
  const byId = new Map(rows.map((r) => [r.id as string, rowToEditorialIssue(r)]));
  return ids.map((id) => byId.get(id)).filter((x): x is EditorialIssue => x !== undefined);
}

export async function updateEditorialIssueTaskId(issueId: string, revisionTaskId: string | null): Promise<void> {
  const db = getDb();
  db.prepare('UPDATE editorial_issues SET revisionTaskId = ? WHERE id = ?').run(revisionTaskId, issueId);
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

  if (data.status !== undefined) {
    fields.push('status = ?');
    values.push(data.status);
  }
  if (data.description !== undefined) {
    fields.push('description = ?');
    values.push(data.description);
  }
  if (data.recommendedFix !== undefined) {
    fields.push('recommendedFix = ?');
    values.push(data.recommendedFix);
  }
  if (data.revisionTaskId !== undefined) {
    fields.push('revisionTaskId = ?');
    values.push(data.revisionTaskId ?? null);
  }
  if (data.editPass !== undefined) {
    fields.push('editPass = ?');
    values.push(data.editPass);
  }
  if (data.manuscriptQuote !== undefined) {
    fields.push('manuscriptQuote = ?');
    values.push(data.manuscriptQuote ?? null);
  }
  if (data.sceneId !== undefined) {
    fields.push('sceneId = ?');
    values.push(data.sceneId ?? null);
  }
  if (data.locationHint !== undefined) {
    fields.push('locationHint = ?');
    values.push(data.locationHint ?? null);
  }
  if (data.chapterNumber !== undefined) {
    fields.push('chapterNumber = ?');
    values.push(data.chapterNumber ?? null);
  }

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
      (id, projectId, chapterNumber, editPass, issueIds, instructions, acceptanceCriteria, status, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.chapterNumber,
    data.editPass,
    JSON.stringify(data.issueIds),
    data.instructions,
    JSON.stringify(data.acceptanceCriteria),
    data.status,
    ts,
    ts,
  );
  return id;
}

export async function deleteRevisionTasksForProjectAndPass(
  projectId: string,
  pass: EditorialPass
): Promise<void> {
  const db = getDb();
  await deleteEditorialIssuesByProjectAndPass(projectId, pass);
  db.prepare('DELETE FROM revision_tasks WHERE projectId = ? AND editPass = ?').run(projectId, pass);
}

export async function getProjectRevisionTasks(projectId: string): Promise<RevisionTask[]> {
  const db = getDb();
  const rows = db.prepare(
    `SELECT * FROM revision_tasks WHERE projectId = ?
     ORDER BY CASE editPass
       WHEN 'structural' THEN 0 WHEN 'line' THEN 1 WHEN 'copy' THEN 2 WHEN 'proofread' THEN 3 WHEN 'final_report' THEN 4 ELSE 0 END,
       chapterNumber ASC`
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
  if (data.editPass !== undefined) { fields.push('editPass = ?'); values.push(data.editPass); }

  if (fields.length === 0) return;
  fields.push('updatedAt = ?');
  values.push(now());
  values.push(taskId);

  db.prepare(`UPDATE revision_tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

// ── Generation usage (token logging) ───────────────────────────────────────────

export async function recordGenerationUsage(input: {
  projectId: string;
  stage: WorkflowStage;
  model: string;
  provider: string;
  totalTokens: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  runId?: string | null;
  source: GenerationUsageSource;
}): Promise<boolean> {
  try {
    const db = getDb();
    const id = randomUUID();
    db.prepare(
      `INSERT INTO generation_usage (
      id, projectId, createdAt, stage, model, provider, inputTokens, outputTokens, totalTokens, runId, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.projectId,
      now(),
      input.stage,
      input.model,
      input.provider,
      input.inputTokens ?? null,
      input.outputTokens ?? null,
      input.totalTokens,
      input.runId ?? null,
      input.source
    );
    return true;
  } catch (err) {
    recordUsageRecordFailure(err);
    console.error('[DB] recordGenerationUsage failed:', err);
    try {
      appendGenerationUsageFallback({
        projectId: input.projectId,
        stage: input.stage,
        model: input.model,
        provider: input.provider,
        inputTokens: input.inputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
        totalTokens: input.totalTokens,
        runId: input.runId ?? null,
        source: input.source,
      });
      recordUsageFallbackAppend();
      console.warn('[DB] generation_usage row appended to fallback NDJSON ledger (.data/generation_usage.fallback.ndjson).');
      return true;
    } catch (fallbackErr) {
      console.error('[DB] generation_usage fallback append also failed:', fallbackErr);
    }
    return false;
  }
}

export async function getProjectGenerationUsageTotals(projectId: string): Promise<GenerationUsageTotals> {
  const fb = sumFallbackUsageForProject(projectId);
  try {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(totalTokens), 0) AS totalTokens, COUNT(*) AS callCount
       FROM generation_usage WHERE projectId = ?`
      )
      .get(projectId) as { totalTokens: number; callCount: number } | undefined;
    return {
      totalTokens: Number(row?.totalTokens ?? 0) + fb.totalTokens,
      callCount: Number(row?.callCount ?? 0) + fb.callCount,
    };
  } catch (err) {
    console.error('[DB] getProjectGenerationUsageTotals SQLite read failed; using fallback file only:', err);
    return fb;
  }
}

// ── Batch delete ──────────────────────────────────────────────────────────────

export async function deleteProjectData(projectId: string): Promise<void> {
  const db = getDb();
  const deleteAll = db.transaction(() => {
    db.prepare('DELETE FROM generation_usage WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM revision_tasks WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM editorial_issues WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM chapter_versions WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM chapters WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM documents WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
  });
  deleteAll();
}
