import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initSchema } from './schema';

declare global {
  // eslint-disable-next-line no-var
  var __storyforgeDb: Database.Database | undefined;
}

export function getDb(): Database.Database {
  if (global.__storyforgeDb) return global.__storyforgeDb;

  const dataDir =
    process.env.STORYFORGE_DATA_DIR ||
    path.join(process.cwd(), '.data');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'storyforge.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);

  global.__storyforgeDb = db;
  return db;
}
