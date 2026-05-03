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
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_generation_usage_project_created
    ON generation_usage (projectId, createdAt)
  `);
  runMigrations(db);
}
