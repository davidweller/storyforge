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
  CoverGenerationJob,
  CoverGenerationJobInput,
  CoverGenerationJobResult,
  CoverJobStatus,
  SerialChapter,
  SerialChapterVersion,
} from '@/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

const KDP_LOCKED_DOCUMENT_TYPES = new Set<DocumentType>([
  'story-bible',
  'creative-brief',
  'chapter-outlines',
  'characters',
  'structure',
  'ending',
  'ending-choice',
]);

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
    serialisationEnabled: Boolean(row.serialisationEnabled),
    serialisationEnteredAt: row.serialisationEnteredAt ? toDate(row.serialisationEnteredAt as string) : undefined,
    serialisationStatus:
      typeof row.serialisationStatus === 'string'
        ? (row.serialisationStatus as import('@/types').SerialisationStatus)
        : 'not_started',
    serialSourceDocumentId: (row.serialSourceDocumentId as string | null) ?? undefined,
    serialBibleId: (row.serialBibleId as string | null) ?? undefined,
    royalRoadFictionId: (row.royalRoadFictionId as string | null) ?? undefined,
    fourPassEditorial: row.fourPassEditorial !== undefined && row.fourPassEditorial !== null
      ? Boolean(row.fourPassEditorial)
      : false,
    finalExportedAt: row.finalExportedAt ? toDate(row.finalExportedAt as string) : undefined,
    blurb: (row.blurb as string) ?? undefined,
    amazonDescription: (row.amazonDescription as string) ?? undefined,
    authorName: (row.authorName as string) ?? undefined,
    kdpTemplateImageData: (row.kdpTemplateImageData as string | null) ?? undefined,
    coverTrimSizeId: (row.coverTrimSizeId as string | null) ?? undefined,
    subtitle: (row.subtitle as string) ?? undefined,
    tagline: (row.tagline as string) ?? undefined,
    marketingAlignCoverToneBlurb: Boolean(row.marketingAlignCoverToneBlurb),
    marketingAlignCoverToneAmazon: Boolean(row.marketingAlignCoverToneAmazon),
    coverStyleReferencesJson: (row.coverStyleReferencesJson as string | null) ?? undefined,
    aPlusStyleReferencesJson: (row.aPlusStyleReferencesJson as string | null) ?? undefined,
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
    aPlusGenerationStatus:
      typeof row.aPlusGenerationStatus === 'string'
        ? (row.aPlusGenerationStatus as import('@/types').CoverTrackStatus)
        : 'not-started',
    approvedAPlusModuleId: (row.approvedAPlusModuleId as string | null) ?? undefined,
    createdAt: toDate(row.createdAt as string),
    updatedAt: toDate(row.updatedAt as string),
  };
}

async function assertKdpCanonWritable(projectId: string, reason: string): Promise<void> {
  const project = await getProject(projectId);
  if (!project) return;
  const status = project.serialisationStatus ?? 'not_started';
  if (status === 'in_progress' || status === 'completed') {
    throw new Error(`Serialisation is active. ${reason}`);
  }
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
    serialScope: Boolean(row.serialScope),
    serialChapterId: (row.serialChapterId as string | null) ?? undefined,
    triggeredByDeltaId: (row.triggeredByDeltaId as string | null) ?? undefined,
    triggeredByFeedbackId: (row.triggeredByFeedbackId as string | null) ?? undefined,
    editPass,
    issueIds: JSON.parse(row.issueIds as string) as string[],
    instructions: row.instructions as string,
    acceptanceCriteria: JSON.parse(row.acceptanceCriteria as string) as string[],
    status: row.status as RevisionTask['status'],
    createdAt: toDate(row.createdAt as string),
    updatedAt: toDate(row.updatedAt as string),
  };
}

function rowToSerialChapter(row: Record<string, unknown>): SerialChapter {
  return {
    id: row.id as string,
    projectId: row.projectId as string,
    ordinal: row.ordinal as number,
    title: row.title as string,
    hookScore: (row.hookScore as number | null) ?? undefined,
    hookCategoriesJson: (row.hookCategoriesJson as string | null) ?? undefined,
    mappingId: row.mappingId as string,
    createdAt: toDate(row.createdAt as string),
  };
}

function rowToSerialChapterVersion(row: Record<string, unknown>): SerialChapterVersion {
  return {
    id: row.id as string,
    serialChapterId: row.serialChapterId as string,
    version: row.version as number,
    parentVersionId: (row.parentVersionId as string | null) ?? undefined,
    content: row.content as string,
    preNote: (row.preNote as string | null) ?? undefined,
    postNote: (row.postNote as string | null) ?? undefined,
    triggeredByDeltaId: (row.triggeredByDeltaId as string | null) ?? undefined,
    triggeredByFeedbackId: (row.triggeredByFeedbackId as string | null) ?? undefined,
    createdAt: toDate(row.createdAt as string),
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
       fullAutoMode, fourPassEditorial, finalExportedAt, serialisationEnabled, serialisationEnteredAt,
       serialisationStatus, serialSourceDocumentId, serialBibleId, royalRoadFictionId,
       blurb, amazonDescription, coverTrimSizeId, createdAt, updatedAt)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    data.serialisationEnabled ? 1 : 0,
    optionalDateToIso(data.serialisationEnteredAt ?? null),
    data.serialisationStatus ?? 'not_started',
    data.serialSourceDocumentId ?? null,
    data.serialBibleId ?? null,
    data.royalRoadFictionId ?? null,
    data.blurb ?? null,
    data.amazonDescription ?? null,
    data.coverTrimSizeId ?? null,
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
  void _userId;
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
  if (data.subtitle !== undefined) { fields.push('subtitle = ?'); values.push(data.subtitle ?? null); }
  if (data.tagline !== undefined) { fields.push('tagline = ?'); values.push(data.tagline ?? null); }
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
  if (data.serialisationEnabled !== undefined) {
    fields.push('serialisationEnabled = ?');
    values.push(data.serialisationEnabled ? 1 : 0);
  }
  if (data.serialisationEnteredAt !== undefined) {
    fields.push('serialisationEnteredAt = ?');
    values.push(optionalDateToIso(data.serialisationEnteredAt ?? null));
  }
  if (data.serialisationStatus !== undefined) {
    fields.push('serialisationStatus = ?');
    values.push(data.serialisationStatus);
  }
  if (data.serialSourceDocumentId !== undefined) {
    fields.push('serialSourceDocumentId = ?');
    values.push(data.serialSourceDocumentId ?? null);
  }
  if (data.serialBibleId !== undefined) {
    fields.push('serialBibleId = ?');
    values.push(data.serialBibleId ?? null);
  }
  if (data.royalRoadFictionId !== undefined) {
    fields.push('royalRoadFictionId = ?');
    values.push(data.royalRoadFictionId ?? null);
  }
  if (data.blurb !== undefined) { fields.push('blurb = ?'); values.push(data.blurb ?? null); }
  if (data.amazonDescription !== undefined) { fields.push('amazonDescription = ?'); values.push(data.amazonDescription ?? null); }
  if (data.coverTrimSizeId !== undefined) { fields.push('coverTrimSizeId = ?'); values.push(data.coverTrimSizeId ?? null); }
  if (data.authorName !== undefined) { fields.push('authorName = ?'); values.push(data.authorName ?? null); }
  if (data.kdpTemplateImageData !== undefined) {
    fields.push('kdpTemplateImageData = ?');
    values.push(data.kdpTemplateImageData ?? null);
  }
  if (data.marketingAlignCoverToneBlurb !== undefined) {
    fields.push('marketingAlignCoverToneBlurb = ?');
    values.push(data.marketingAlignCoverToneBlurb ? 1 : 0);
  }
  if (data.marketingAlignCoverToneAmazon !== undefined) {
    fields.push('marketingAlignCoverToneAmazon = ?');
    values.push(data.marketingAlignCoverToneAmazon ? 1 : 0);
  }
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
  if (data.aPlusGenerationStatus !== undefined) {
    fields.push('aPlusGenerationStatus = ?');
    values.push(data.aPlusGenerationStatus);
  }
  if (data.approvedAPlusModuleId !== undefined) {
    fields.push('approvedAPlusModuleId = ?');
    values.push(data.approvedAPlusModuleId ?? null);
  }
  if (data.coverStyleReferencesJson !== undefined) {
    fields.push('coverStyleReferencesJson = ?');
    values.push(data.coverStyleReferencesJson ?? null);
  }
  if (data.aPlusStyleReferencesJson !== undefined) {
    fields.push('aPlusStyleReferencesJson = ?');
    values.push(data.aPlusStyleReferencesJson ?? null);
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

function withForkMetadata(content: string, forkedFromBibleId: string): string {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return JSON.stringify({ ...parsed, forkedFromBibleId }, null, 2);
    }
  } catch {
    // Keep original content when it's not valid JSON.
  }
  return content;
}

export async function enterSerialisation(projectId: string): Promise<{ serialBibleId: string }> {
  const db = getDb();
  const tx = db.transaction(() => {
    const project = db
      .prepare('SELECT id, finalExportedAt FROM projects WHERE id = ?')
      .get(projectId) as { id: string; finalExportedAt: string | null } | undefined;
    if (!project) throw new Error('Project not found');
    if (!project.finalExportedAt) throw new Error('Serialisation requires final export first');

    const sourceBible = db
      .prepare(
        `SELECT * FROM documents
         WHERE projectId = ? AND type = 'story-bible' AND approved = 1
         ORDER BY version DESC LIMIT 1`
      )
      .get(projectId) as Record<string, unknown> | undefined;
    if (!sourceBible) throw new Error('No approved story-bible found to fork');

    const serialBibleId = randomUUID();
    const ts = now();
    db.prepare(`
      INSERT INTO documents (id, projectId, type, chapterNumber, content, version, approved, createdAt, updatedAt)
      VALUES (?, ?, 'story-bible-rr', NULL, ?, 1, 1, ?, ?)
    `).run(
      serialBibleId,
      projectId,
      withForkMetadata(sourceBible.content as string, sourceBible.id as string),
      ts,
      ts
    );

    db.prepare(`
      UPDATE projects
      SET serialisationEnabled = 1,
          serialisationEnteredAt = ?,
          serialisationStatus = 'in_progress',
          serialBibleId = ?,
          updatedAt = ?
      WHERE id = ?
    `).run(ts, serialBibleId, ts, projectId);

    return { serialBibleId };
  });
  return tx();
}

export async function discardSerialisation(projectId: string): Promise<void> {
  const db = getDb();
  const tx = db.transaction(() => {
    const project = db
      .prepare('SELECT serialisationEnteredAt FROM projects WHERE id = ?')
      .get(projectId) as { serialisationEnteredAt: string | null } | undefined;
    if (!project) throw new Error('Project not found');

    db.prepare('DELETE FROM serial_chapter_versions WHERE serialChapterId IN (SELECT id FROM serial_chapters WHERE projectId = ?)').run(projectId);
    db.prepare('DELETE FROM serial_chapters WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM serial_feedback WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM bible_deltas WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM revision_tasks WHERE projectId = ? AND serialScope = 1').run(projectId);
    db.prepare(`DELETE FROM documents WHERE projectId = ? AND type IN ('story-bible-rr', 'serial-chapter-mapping')`).run(projectId);
    if (project.serialisationEnteredAt) {
      db.prepare(`DELETE FROM documents WHERE projectId = ? AND type = 'source-manuscript' AND createdAt > ?`).run(
        projectId,
        project.serialisationEnteredAt
      );
    }

    db.prepare(`
      UPDATE projects
      SET serialisationEnabled = 0,
          serialisationStatus = 'not_started',
          serialisationEnteredAt = NULL,
          serialSourceDocumentId = NULL,
          serialBibleId = NULL,
          updatedAt = ?
      WHERE id = ?
    `).run(now(), projectId);
  });
  tx();
}

// ── Project Documents ─────────────────────────────────────────────────────────

export async function createDocument(
  data: Omit<ProjectDocument, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  if (KDP_LOCKED_DOCUMENT_TYPES.has(data.type)) {
    await assertKdpCanonWritable(
      data.projectId,
      'Discard RR canon to edit KDP-side canon documents.'
    );
  }
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
  const existing = db
    .prepare('SELECT projectId, type FROM documents WHERE id = ?')
    .get(documentId) as { projectId: string; type: DocumentType } | undefined;
  if (existing) {
    const effectiveType = (data.type ?? existing.type) as DocumentType;
    if (KDP_LOCKED_DOCUMENT_TYPES.has(effectiveType)) {
      await assertKdpCanonWritable(
        existing.projectId,
        'Discard RR canon to edit KDP-side canon documents.'
      );
    }
  }
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
  await assertKdpCanonWritable(
    data.projectId,
    'Discard RR canon to edit KDP chapter versions.'
  );
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
  const row = db
    .prepare('SELECT projectId FROM chapter_versions WHERE id = ?')
    .get(versionId) as { projectId: string } | undefined;
  if (row?.projectId) {
    await assertKdpCanonWritable(
      row.projectId,
      'Discard RR canon to edit KDP chapter versions.'
    );
  }
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
  if (data.serialScope && data.serialChapterId) {
    const existingOpen = db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM revision_tasks
         WHERE serialChapterId = ?
           AND serialScope = 1
           AND status IN ('queued', 'in_progress')`
      )
      .get(data.serialChapterId) as { count: number } | undefined;
    if ((existingOpen?.count ?? 0) > 0) {
      throw new Error('Serial chapter already has an open revision task.');
    }
  }
  const id = randomUUID();
  const ts = now();
  db.prepare(`
    INSERT INTO revision_tasks
      (id, projectId, chapterNumber, serialScope, serialChapterId, triggeredByDeltaId, triggeredByFeedbackId,
       editPass, issueIds, instructions, acceptanceCriteria, status, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.chapterNumber,
    data.serialScope ? 1 : 0,
    data.serialChapterId ?? null,
    data.triggeredByDeltaId ?? null,
    data.triggeredByFeedbackId ?? null,
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
  if (data.serialScope !== undefined) { fields.push('serialScope = ?'); values.push(data.serialScope ? 1 : 0); }
  if (data.serialChapterId !== undefined) { fields.push('serialChapterId = ?'); values.push(data.serialChapterId ?? null); }
  if (data.triggeredByDeltaId !== undefined) { fields.push('triggeredByDeltaId = ?'); values.push(data.triggeredByDeltaId ?? null); }
  if (data.triggeredByFeedbackId !== undefined) { fields.push('triggeredByFeedbackId = ?'); values.push(data.triggeredByFeedbackId ?? null); }

  if (fields.length === 0) return;
  fields.push('updatedAt = ?');
  values.push(now());
  values.push(taskId);

  db.prepare(`UPDATE revision_tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

// ── Serial chapters ───────────────────────────────────────────────────────────

export async function createSerialChapter(data: {
  projectId: string;
  ordinal: number;
  title: string;
  mappingId: string;
  hookScore?: number | null;
  hookCategoriesJson?: string | null;
}): Promise<string> {
  const db = getDb();
  const id = randomUUID();
  db.prepare(`
    INSERT INTO serial_chapters (id, projectId, ordinal, title, hookScore, hookCategoriesJson, mappingId, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.ordinal,
    data.title,
    data.hookScore ?? null,
    data.hookCategoriesJson ?? null,
    data.mappingId,
    now()
  );
  return id;
}

export async function getProjectSerialChapters(projectId: string): Promise<SerialChapter[]> {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM serial_chapters WHERE projectId = ? ORDER BY ordinal ASC')
    .all(projectId) as Record<string, unknown>[];
  return rows.map(rowToSerialChapter);
}

export async function getSerialChapter(serialChapterId: string): Promise<SerialChapter | null> {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM serial_chapters WHERE id = ?')
    .get(serialChapterId) as Record<string, unknown> | undefined;
  return row ? rowToSerialChapter(row) : null;
}

export async function createSerialChapterVersion(data: {
  serialChapterId: string;
  version: number;
  content: string;
  parentVersionId?: string | null;
  preNote?: string | null;
  postNote?: string | null;
  triggeredByDeltaId?: string | null;
  triggeredByFeedbackId?: string | null;
}): Promise<string> {
  const db = getDb();
  const id = randomUUID();
  db.prepare(`
    INSERT INTO serial_chapter_versions
      (id, serialChapterId, version, parentVersionId, content, preNote, postNote, triggeredByDeltaId, triggeredByFeedbackId, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.serialChapterId,
    data.version,
    data.parentVersionId ?? null,
    data.content,
    data.preNote ?? null,
    data.postNote ?? null,
    data.triggeredByDeltaId ?? null,
    data.triggeredByFeedbackId ?? null,
    now()
  );
  return id;
}

export async function getLatestSerialChapterVersion(
  serialChapterId: string
): Promise<SerialChapterVersion | null> {
  const db = getDb();
  const row = db
    .prepare(
      'SELECT * FROM serial_chapter_versions WHERE serialChapterId = ? ORDER BY version DESC LIMIT 1'
    )
    .get(serialChapterId) as Record<string, unknown> | undefined;
  return row ? rowToSerialChapterVersion(row) : null;
}

export async function resetProjectSerialChapters(projectId: string): Promise<void> {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(
      'DELETE FROM serial_chapter_versions WHERE serialChapterId IN (SELECT id FROM serial_chapters WHERE projectId = ?)'
    ).run(projectId);
    db.prepare('DELETE FROM serial_chapters WHERE projectId = ?').run(projectId);
  });
  tx();
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

// ── Cover generation jobs ─────────────────────────────────────────────────────

function rowToCoverGenerationJob(row: Record<string, unknown>): CoverGenerationJob {
  let input: CoverGenerationJobInput = {
    archetypeId: '',
    authorName: '',
    trimSizeId: '6x9',
    trimWidthIn: 6,
    trimHeightIn: 9,
  };
  let result: CoverGenerationJobResult | undefined;
  try {
    input = JSON.parse((row.inputJson as string) ?? '{}') as CoverGenerationJobInput;
  } catch {
    // noop
  }
  try {
    const raw = row.resultJson as string | null | undefined;
    result = raw ? (JSON.parse(raw) as CoverGenerationJobResult) : undefined;
  } catch {
    result = undefined;
  }
  return {
    id: row.id as string,
    projectId: row.projectId as string,
    status: row.status as CoverJobStatus,
    progressStage: (row.progressStage as string) ?? 'queued',
    error: (row.error as string | null) ?? null,
    input,
    result,
    createdAt: toDate(row.createdAt as string),
    updatedAt: toDate(row.updatedAt as string),
  };
}

function ensureCoverGenerationJobsTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS cover_generation_jobs (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      status TEXT NOT NULL,
      progressStage TEXT NOT NULL,
      error TEXT,
      inputJson TEXT NOT NULL,
      resultJson TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (projectId) REFERENCES projects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_cover_generation_jobs_project_created
    ON cover_generation_jobs (projectId, createdAt DESC)
  `);
}

export async function createCoverGenerationJob(data: {
  projectId: string;
  status: CoverJobStatus;
  progressStage: string;
  input: CoverGenerationJobInput;
  error?: string | null;
  result?: CoverGenerationJobResult;
}): Promise<string> {
  ensureCoverGenerationJobsTable();
  const db = getDb();
  const id = randomUUID();
  const ts = now();
  db.prepare(
    `INSERT INTO cover_generation_jobs (id, projectId, status, progressStage, error, inputJson, resultJson, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.projectId,
    data.status,
    data.progressStage,
    data.error ?? null,
    JSON.stringify(data.input),
    data.result ? JSON.stringify(data.result) : null,
    ts,
    ts
  );
  return id;
}

export async function getCoverGenerationJob(jobId: string): Promise<CoverGenerationJob | null> {
  ensureCoverGenerationJobsTable();
  const db = getDb();
  const row = db.prepare('SELECT * FROM cover_generation_jobs WHERE id = ?').get(jobId) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToCoverGenerationJob(row) : null;
}

export async function getLatestCoverGenerationJobForProject(projectId: string): Promise<CoverGenerationJob | null> {
  ensureCoverGenerationJobsTable();
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM cover_generation_jobs WHERE projectId = ? ORDER BY createdAt DESC LIMIT 1')
    .get(projectId) as Record<string, unknown> | undefined;
  return row ? rowToCoverGenerationJob(row) : null;
}

export async function updateCoverGenerationJob(
  jobId: string,
  data: {
    status?: CoverJobStatus;
    progressStage?: string;
    error?: string | null;
    result?: CoverGenerationJobResult;
  }
): Promise<void> {
  ensureCoverGenerationJobsTable();
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
  if (data.progressStage !== undefined) { fields.push('progressStage = ?'); values.push(data.progressStage); }
  if (data.error !== undefined) { fields.push('error = ?'); values.push(data.error ?? null); }
  if (data.result !== undefined) { fields.push('resultJson = ?'); values.push(JSON.stringify(data.result)); }
  if (fields.length === 0) return;
  fields.push('updatedAt = ?');
  values.push(now());
  values.push(jobId);
  db.prepare(`UPDATE cover_generation_jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

// ── Batch delete ──────────────────────────────────────────────────────────────

export async function deleteProjectData(projectId: string): Promise<void> {
  const db = getDb();
  const deleteAll = db.transaction(() => {
    db.prepare('DELETE FROM cover_generation_jobs WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM generation_usage WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM serial_chapter_versions WHERE serialChapterId IN (SELECT id FROM serial_chapters WHERE projectId = ?)').run(projectId);
    db.prepare('DELETE FROM serial_chapters WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM bible_deltas WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM serial_feedback WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM revision_tasks WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM editorial_issues WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM chapter_versions WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM chapters WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM documents WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
  });
  deleteAll();
}
