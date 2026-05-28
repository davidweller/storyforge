import type Database from 'better-sqlite3';

function columnNames(db: Database.Database, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

/** Additive migrations after CREATE TABLE IF NOT EXISTS. */
export function runMigrations(db: Database.Database): void {
  const rt = columnNames(db, 'revision_tasks');
  if (!rt.has('editPass')) {
    db.exec(`ALTER TABLE revision_tasks ADD COLUMN editPass TEXT NOT NULL DEFAULT 'structural'`);
  }
  const pr = columnNames(db, 'projects');
  if (!pr.has('fourPassEditorial')) {
    db.exec(`ALTER TABLE projects ADD COLUMN fourPassEditorial INTEGER NOT NULL DEFAULT 0`);
  }
  const docs = columnNames(db, 'documents');
  if (!docs.has('chapterNumber')) {
    db.exec(`ALTER TABLE documents ADD COLUMN chapterNumber INTEGER`);
  }
  const cv = columnNames(db, 'chapter_versions');
  if (!cv.has('sceneSegments')) {
    db.exec(`ALTER TABLE chapter_versions ADD COLUMN sceneSegments TEXT`);
  }

  const ei = columnNames(db, 'editorial_issues');
  if (!ei.has('editPass')) {
    db.exec(
      `ALTER TABLE editorial_issues ADD COLUMN editPass TEXT NOT NULL DEFAULT 'structural'`
    );
  }
  if (!ei.has('revisionTaskId')) {
    db.exec(`ALTER TABLE editorial_issues ADD COLUMN revisionTaskId TEXT`);
  }
  if (!ei.has('manuscriptQuote')) {
    db.exec(`ALTER TABLE editorial_issues ADD COLUMN manuscriptQuote TEXT`);
  }
  if (!ei.has('sceneId')) {
    db.exec(`ALTER TABLE editorial_issues ADD COLUMN sceneId TEXT`);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_editorial_issues_project_pass_status_chapter
    ON editorial_issues (projectId, editPass, status, chapterNumber)
  `);

  const pr2 = columnNames(db, 'projects');
  if (!pr2.has('approvedCoverImageId')) {
    db.exec(`ALTER TABLE projects ADD COLUMN approvedCoverImageId TEXT`);
  }
  if (!pr2.has('approvedBackCoverImageId')) {
    db.exec(`ALTER TABLE projects ADD COLUMN approvedBackCoverImageId TEXT`);
  }
  if (!pr2.has('coverGenerationStatus')) {
    db.exec(
      `ALTER TABLE projects ADD COLUMN coverGenerationStatus TEXT NOT NULL DEFAULT 'not-started'`
    );
  }
  if (!pr2.has('paperbackGenerationStatus')) {
    db.exec(
      `ALTER TABLE projects ADD COLUMN paperbackGenerationStatus TEXT NOT NULL DEFAULT 'not-started'`
    );
  }
  const pr3 = columnNames(db, 'projects');
  if (!pr3.has('authorName')) {
    db.exec(`ALTER TABLE projects ADD COLUMN authorName TEXT`);
  }
  if (!pr3.has('kdpTemplateImageData')) {
    db.exec(`ALTER TABLE projects ADD COLUMN kdpTemplateImageData TEXT`);
  }
  if (!pr3.has('marketingAlignCoverToneBlurb')) {
    db.exec(`ALTER TABLE projects ADD COLUMN marketingAlignCoverToneBlurb INTEGER NOT NULL DEFAULT 0`);
  }
  if (!pr3.has('marketingAlignCoverToneAmazon')) {
    db.exec(`ALTER TABLE projects ADD COLUMN marketingAlignCoverToneAmazon INTEGER NOT NULL DEFAULT 0`);
  }
  if (!pr3.has('aPlusGenerationStatus')) {
    db.exec(`ALTER TABLE projects ADD COLUMN aPlusGenerationStatus TEXT NOT NULL DEFAULT 'not-started'`);
  }
  if (!pr3.has('approvedAPlusModuleId')) {
    db.exec(`ALTER TABLE projects ADD COLUMN approvedAPlusModuleId TEXT`);
  }
  if (!pr3.has('coverTrimSizeId')) {
    db.exec(`ALTER TABLE projects ADD COLUMN coverTrimSizeId TEXT`);
  }
  const pr4 = columnNames(db, 'projects');
  if (!pr4.has('subtitle')) {
    db.exec(`ALTER TABLE projects ADD COLUMN subtitle TEXT`);
  }
  if (!pr4.has('tagline')) {
    db.exec(`ALTER TABLE projects ADD COLUMN tagline TEXT`);
  }
  const pr5 = columnNames(db, 'projects');
  if (!pr5.has('coverStyleReferencesJson')) {
    db.exec(`ALTER TABLE projects ADD COLUMN coverStyleReferencesJson TEXT`);
  }
  const pr6 = columnNames(db, 'projects');
  if (!pr6.has('aPlusStyleReferencesJson')) {
    db.exec(`ALTER TABLE projects ADD COLUMN aPlusStyleReferencesJson TEXT`);
  }
  const pr7 = columnNames(db, 'projects');
  if (!pr7.has('serialisationEnabled')) {
    db.exec(`ALTER TABLE projects ADD COLUMN serialisationEnabled INTEGER NOT NULL DEFAULT 0`);
  }
  if (!pr7.has('serialisationEnteredAt')) {
    db.exec(`ALTER TABLE projects ADD COLUMN serialisationEnteredAt TEXT`);
  }
  if (!pr7.has('serialisationStatus')) {
    db.exec(`ALTER TABLE projects ADD COLUMN serialisationStatus TEXT NOT NULL DEFAULT 'not_started'`);
  }
  if (!pr7.has('serialSourceDocumentId')) {
    db.exec(`ALTER TABLE projects ADD COLUMN serialSourceDocumentId TEXT`);
  }
  if (!pr7.has('serialBibleId')) {
    db.exec(`ALTER TABLE projects ADD COLUMN serialBibleId TEXT`);
  }
  if (!pr7.has('royalRoadFictionId')) {
    db.exec(`ALTER TABLE projects ADD COLUMN royalRoadFictionId TEXT`);
  }

  const rt2 = columnNames(db, 'revision_tasks');
  if (!rt2.has('serialScope')) {
    db.exec(`ALTER TABLE revision_tasks ADD COLUMN serialScope INTEGER NOT NULL DEFAULT 0`);
  }
  if (!rt2.has('serialChapterId')) {
    db.exec(`ALTER TABLE revision_tasks ADD COLUMN serialChapterId TEXT`);
  }
  if (!rt2.has('triggeredByDeltaId')) {
    db.exec(`ALTER TABLE revision_tasks ADD COLUMN triggeredByDeltaId TEXT`);
  }
  if (!rt2.has('triggeredByFeedbackId')) {
    db.exec(`ALTER TABLE revision_tasks ADD COLUMN triggeredByFeedbackId TEXT`);
  }

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

  db.exec(`
    CREATE TABLE IF NOT EXISTS generation_usage (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      stage TEXT NOT NULL,
      model TEXT NOT NULL,
      provider TEXT NOT NULL,
      inputTokens INTEGER,
      outputTokens INTEGER,
      totalTokens INTEGER NOT NULL,
      runId TEXT,
      source TEXT NOT NULL,
      FOREIGN KEY (projectId) REFERENCES projects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_generation_usage_project_created
    ON generation_usage (projectId, createdAt)
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS serial_chapters (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL REFERENCES projects(id),
      ordinal INTEGER NOT NULL,
      title TEXT NOT NULL,
      hookScore REAL,
      hookCategoriesJson TEXT,
      mappingId TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (projectId, ordinal)
    );
    CREATE INDEX IF NOT EXISTS idx_serial_chapters_project_ordinal
    ON serial_chapters (projectId, ordinal)
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS serial_chapter_versions (
      id TEXT PRIMARY KEY,
      serialChapterId TEXT NOT NULL REFERENCES serial_chapters(id),
      version INTEGER NOT NULL,
      parentVersionId TEXT,
      content TEXT NOT NULL,
      preNote TEXT,
      postNote TEXT,
      triggeredByDeltaId TEXT,
      triggeredByFeedbackId TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (serialChapterId, version)
    );
    CREATE INDEX IF NOT EXISTS idx_serial_chapter_versions_chapter_version
    ON serial_chapter_versions (serialChapterId, version DESC)
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS serial_feedback (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL REFERENCES projects(id),
      scope TEXT NOT NULL,
      chapterIdsJson TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_impact',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_serial_feedback_project_created
    ON serial_feedback (projectId, createdAt)
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS bible_deltas (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL REFERENCES projects(id),
      bibleId TEXT NOT NULL,
      triggeredByFeedbackId TEXT NOT NULL REFERENCES serial_feedback(id),
      beforeJson TEXT NOT NULL,
      afterJson TEXT NOT NULL,
      biblePath TEXT NOT NULL,
      rationale TEXT,
      approvedAt TEXT,
      approvedBy TEXT,
      reversalOfId TEXT REFERENCES bible_deltas(id),
      affectedChapterIdsJson TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_bible_deltas_project_created
    ON bible_deltas (projectId, createdAt)
  `);
}

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT,
      genre TEXT NOT NULL,
      niche TEXT,
      microniche TEXT,
      premise TEXT,
      research TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      currentStage TEXT NOT NULL DEFAULT 'setup',
      fullAutoMode INTEGER NOT NULL DEFAULT 0,
      finalExportedAt TEXT,
      blurb TEXT,
      amazonDescription TEXT,
      coverTrimSizeId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      approved INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (projectId) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      chapterNumber INTEGER NOT NULL,
      title TEXT NOT NULL,
      beatReference TEXT NOT NULL,
      sceneGoal TEXT NOT NULL,
      pov TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (projectId) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS chapter_versions (
      id TEXT PRIMARY KEY,
      chapterId TEXT NOT NULL,
      projectId TEXT NOT NULL,
      chapterNumber INTEGER NOT NULL,
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      wordCount INTEGER NOT NULL DEFAULT 0,
      approved INTEGER NOT NULL DEFAULT 0,
      parentVersionId TEXT,
      notes TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (chapterId) REFERENCES chapters(id)
    );

    CREATE TABLE IF NOT EXISTS editorial_issues (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      chapterNumber INTEGER,
      locationHint TEXT,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      recommendedFix TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      createdAt TEXT NOT NULL,
      FOREIGN KEY (projectId) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS revision_tasks (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      chapterNumber INTEGER NOT NULL,
      issueIds TEXT NOT NULL,
      instructions TEXT NOT NULL,
      acceptanceCriteria TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (projectId) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS generation_usage (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      stage TEXT NOT NULL,
      model TEXT NOT NULL,
      provider TEXT NOT NULL,
      inputTokens INTEGER,
      outputTokens INTEGER,
      totalTokens INTEGER NOT NULL,
      runId TEXT,
      source TEXT NOT NULL,
      FOREIGN KEY (projectId) REFERENCES projects(id)
    );

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
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_generation_usage_project_created
    ON generation_usage (projectId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_cover_generation_jobs_project_created
    ON cover_generation_jobs (projectId, createdAt DESC)
  `);
  runMigrations(db);
}
