#!/usr/bin/env node
/**
 * One-time migration: Firestore → local SQLite
 *
 * Reads top-level Firestore collections (projects, documents, chapters, …)
 * and inserts into the local better-sqlite3 database used by StoryForge.
 *
 * Prerequisites:
 *   npm install   (firebase-admin is a devDependency)
 *
 * Credentials (any one):
 *   - FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS → path to JSON key file
 *   - FIREBASE_SERVICE_ACCOUNT_JSON → full JSON string of the service account
 *   - FIREBASE_ADMIN_PROJECT_ID + FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY
 *
 * Env files loaded if present (repo root): .env, .env.local, env.local, storyforge/env.local
 *
 * Usage:
 *   npm run migrate:firebase
 *   node scripts/migrate-from-firebase.js
 */

const path = require('path');
const fs = require('fs');

const repoRoot = path.join(__dirname, '..');

function loadDotenvFiles() {
  const files = [
    path.join(repoRoot, '.env'),
    path.join(repoRoot, '.env.local'),
    path.join(repoRoot, 'env.local'),
    path.join(repoRoot, 'storyforge', 'env.local'),
  ];
  for (const p of files) {
    if (fs.existsSync(p)) {
      require('dotenv').config({ path: p });
    }
  }
}

loadDotenvFiles();

// ── Firebase Admin ────────────────────────────────────────────────────────────
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

function resolveServiceAccountCredential() {
  let jsonPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (jsonPath) {
    // Dotenv may turn `\n` inside Windows paths like `\novel` into a real newline — repair.
    jsonPath = jsonPath.trim().replace(/\r?\n/g, '');
  }
  if (jsonPath && fs.existsSync(jsonPath)) {
    const raw = fs.readFileSync(jsonPath, 'utf8');
    return cert(JSON.parse(raw));
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  }
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';
  privateKey = privateKey.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  if (projectId && clientEmail && privateKey) {
    return cert({ projectId, clientEmail, privateKey });
  }
  console.error(`
No Firebase Admin credentials found. Set one of:

  FIREBASE_SERVICE_ACCOUNT_PATH=./path/to-service-account.json
  (or GOOGLE_APPLICATION_CREDENTIALS — same JSON file)

  FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'

  FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY

Put values in .env.local at the repo root (see .gitignore — file is not committed).
`);
  process.exit(1);
}

initializeApp({ credential: resolveServiceAccountCredential() });
const fsDb = getFirestore();

function getFirebaseProjectIdForLog() {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID) {
    return process.env.FIREBASE_ADMIN_PROJECT_ID;
  }
  const jsonPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (jsonPath && fs.existsSync(jsonPath)) {
    try {
      return JSON.parse(fs.readFileSync(jsonPath, 'utf8')).project_id || '(unknown)';
    } catch (_) {
      /* ignore */
    }
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON).project_id || '(unknown)';
    } catch (_) {
      /* ignore */
    }
  }
  return '(unknown)';
}

/** Firestore may store string[] or a pre-serialized JSON string; SQLite expects JSON text. */
function jsonArrayForDb(val) {
  if (val == null) return JSON.stringify([]);
  if (Array.isArray(val)) return JSON.stringify(val);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return val;
    } catch (_) {
      /* treat as single line */
    }
    return JSON.stringify([val]);
  }
  return JSON.stringify([]);
}

// ── SQLite ────────────────────────────────────────────────────────────────────
const Database = require('better-sqlite3');

const dataDir = process.env.STORYFORGE_DATA_DIR || path.join(__dirname, '..', '.data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'storyforge.db');
const db     = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema (mirrors src/lib/db/schema.ts) ─────────────────────────────────────
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
    updatedAt TEXT NOT NULL
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
    updatedAt TEXT NOT NULL
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
    createdAt TEXT NOT NULL
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
    createdAt TEXT NOT NULL
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
    updatedAt TEXT NOT NULL
  );
`);

// ── Helpers ───────────────────────────────────────────────────────────────────

function toIso(value) {
  if (!value) return new Date().toISOString();
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function bool(v) { return v ? 1 : 0; }

// ── Prepared statements ───────────────────────────────────────────────────────

const insertProject = db.prepare(`
  INSERT OR IGNORE INTO projects
    (id,title,genre,niche,microniche,premise,research,status,currentStage,
     fullAutoMode,finalExportedAt,blurb,amazonDescription,createdAt,updatedAt)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

const insertDocument = db.prepare(`
  INSERT OR IGNORE INTO documents
    (id,projectId,type,content,version,approved,createdAt,updatedAt)
  VALUES (?,?,?,?,?,?,?,?)
`);

const insertChapter = db.prepare(`
  INSERT OR IGNORE INTO chapters
    (id,projectId,chapterNumber,title,beatReference,sceneGoal,pov,createdAt,updatedAt)
  VALUES (?,?,?,?,?,?,?,?,?)
`);

const insertVersion = db.prepare(`
  INSERT OR IGNORE INTO chapter_versions
    (id,chapterId,projectId,chapterNumber,version,content,wordCount,approved,
     parentVersionId,notes,createdAt)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)
`);

const insertIssue = db.prepare(`
  INSERT OR IGNORE INTO editorial_issues
    (id,projectId,chapterNumber,locationHint,category,description,recommendedFix,status,createdAt)
  VALUES (?,?,?,?,?,?,?,?,?)
`);

const insertTask = db.prepare(`
  INSERT OR IGNORE INTO revision_tasks
    (id,projectId,chapterNumber,issueIds,instructions,acceptanceCriteria,status,createdAt,updatedAt)
  VALUES (?,?,?,?,?,?,?,?,?)
`);

// ── Migration ─────────────────────────────────────────────────────────────────

async function migrate() {
  console.log('\n🔗 Connecting to Firestore project:', getFirebaseProjectIdForLog());
  console.log('💾 Writing to SQLite:', dbPath, '\n');

  // Projects
  const projectsSnap = await fsDb.collection('projects').get();
  const projectIds   = projectsSnap.docs.map(d => d.id);
  console.log(`📁 Found ${projectIds.length} project(s)`);

  const migrate = db.transaction((projects) => {
    let counts = { projects: 0, documents: 0, chapters: 0, versions: 0, issues: 0, tasks: 0 };

    for (const pDoc of projects) {
      const p = pDoc.data();
      insertProject.run(
        pDoc.id,
        p.title   ?? null,
        p.genre   ?? 'Unknown',
        p.niche   ?? null,
        p.microniche ?? null,
        p.premise ?? null,
        p.research ?? null,
        p.status  ?? 'active',
        p.currentStage ?? 'setup',
        bool(p.fullAutoMode),
        p.finalExportedAt ? toIso(p.finalExportedAt) : null,
        p.blurb   ?? null,
        p.amazonDescription ?? null,
        toIso(p.createdAt),
        toIso(p.updatedAt),
      );
      counts.projects++;
    }
    return counts;
  });

  const c = migrate(projectsSnap.docs);
  console.log(`  ✓ Imported ${c.projects} project(s)`);

  // Sub-collections — done per project so we can report progress
  let totals = { documents: 0, chapters: 0, versions: 0, issues: 0, tasks: 0 };

  for (const projectId of projectIds) {
    // Documents
    const docsSnap = await fsDb.collection('documents').where('projectId', '==', projectId).get();
    const docsInsert = db.transaction((docs) => {
      for (const d of docs) {
        const r = d.data();
        insertDocument.run(
          d.id, r.projectId, r.type, r.content ?? '', r.version ?? 1,
          bool(r.approved), toIso(r.createdAt), toIso(r.updatedAt)
        );
      }
    });
    docsInsert(docsSnap.docs);
    totals.documents += docsSnap.docs.length;

    // Chapters
    const chapSnap = await fsDb.collection('chapters').where('projectId', '==', projectId).get();
    const chapInsert = db.transaction((chaps) => {
      for (const c of chaps) {
        const r = c.data();
        insertChapter.run(
          c.id, r.projectId, r.chapterNumber, r.title ?? '', r.beatReference ?? '',
          r.sceneGoal ?? '', r.pov ?? null, toIso(r.createdAt), toIso(r.updatedAt)
        );
      }
    });
    chapInsert(chapSnap.docs);
    totals.chapters += chapSnap.docs.length;

    // Chapter versions
    const verSnap = await fsDb.collection('chapter_versions').where('projectId', '==', projectId).get();
    const verInsert = db.transaction((vers) => {
      for (const v of vers) {
        const r = v.data();
        insertVersion.run(
          v.id, r.chapterId, r.projectId, r.chapterNumber, r.version,
          r.content ?? '', r.wordCount ?? 0, bool(r.approved),
          r.parentVersionId ?? null, r.notes ?? null, toIso(r.createdAt)
        );
      }
    });
    verInsert(verSnap.docs);
    totals.versions += verSnap.docs.length;

    // Editorial issues
    const issSnap = await fsDb.collection('editorial_issues').where('projectId', '==', projectId).get();
    const issInsert = db.transaction((iss) => {
      for (const i of iss) {
        const r = i.data();
        insertIssue.run(
          i.id,
          r.projectId,
          r.chapterNumber ?? null,
          r.locationHint ?? null,
          r.category ?? 'general',
          r.description ?? '',
          r.recommendedFix ?? '',
          r.status ?? 'open',
          toIso(r.createdAt),
        );
      }
    });
    issInsert(issSnap.docs);
    totals.issues += issSnap.docs.length;

    // Revision tasks
    const taskSnap = await fsDb.collection('revision_tasks').where('projectId', '==', projectId).get();
    const taskInsert = db.transaction((tasks) => {
      for (const t of tasks) {
        const r = t.data();
        insertTask.run(
          t.id,
          r.projectId,
          r.chapterNumber,
          jsonArrayForDb(r.issueIds),
          r.instructions ?? '',
          jsonArrayForDb(r.acceptanceCriteria),
          r.status ?? 'queued',
          toIso(r.createdAt),
          toIso(r.updatedAt),
        );
      }
    });
    taskInsert(taskSnap.docs);
    totals.tasks += taskSnap.docs.length;

    const projData = projectsSnap.docs.find(d => d.id === projectId)?.data();
    const label = projData?.title || projData?.genre || projectId;
    console.log(`  ✓ "${label}" — ${docsSnap.docs.length} docs, ${chapSnap.docs.length} chapters, ${verSnap.docs.length} versions`);
  }

  console.log('\n✅ Migration complete!');
  console.log(`   Projects:        ${c.projects}`);
  console.log(`   Documents:       ${totals.documents}`);
  console.log(`   Chapters:        ${totals.chapters}`);
  console.log(`   Chapter versions:${totals.versions}`);
  console.log(`   Editorial issues:${totals.issues}`);
  console.log(`   Revision tasks:  ${totals.tasks}`);
  console.log(`\n   SQLite file: ${dbPath}\n`);
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message || err);
  process.exit(1);
});
