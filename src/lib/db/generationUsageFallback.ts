import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const FILENAME = 'generation_usage.fallback.ndjson';

function dataDir(): string {
  return process.env.STORYFORGE_DATA_DIR || path.join(process.cwd(), '.data');
}

function filePath(): string {
  return path.join(dataDir(), FILENAME);
}

export type GenerationUsageFallbackRecord = {
  id: string;
  projectId: string;
  createdAt: string;
  stage: string;
  model: string;
  provider: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number;
  runId: string | null;
  source: string;
};

function ensureDir(): void {
  const dir = dataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * When better-sqlite3 INSERT fails (ABI error, readonly DB, bind issues), append the same
 * payload to an NDJSON ledger so token history is not silently lost.
 */
export function appendGenerationUsageFallback(input: Omit<GenerationUsageFallbackRecord, 'id' | 'createdAt'>): void {
  ensureDir();
  const rec: GenerationUsageFallbackRecord = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  fs.appendFileSync(filePath(), `${JSON.stringify(rec)}\n`, 'utf8');
}

export function sumFallbackUsageForProject(projectId: string): { totalTokens: number; callCount: number } {
  const p = filePath();
  if (!fs.existsSync(p)) return { totalTokens: 0, callCount: 0 };
  let totalTokens = 0;
  let callCount = 0;
  const text = fs.readFileSync(p, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed) as Partial<GenerationUsageFallbackRecord>;
      if (row.projectId !== projectId) continue;
      totalTokens += Number(row.totalTokens ?? 0);
      callCount += 1;
    } catch {
      /* skip corrupt line */
    }
  }
  return { totalTokens, callCount };
}

export function fallbackUsageFileStats(): { exists: boolean; path: string; lineCount: number } {
  const p = filePath();
  if (!fs.existsSync(p)) return { exists: false, path: p, lineCount: 0 };
  const text = fs.readFileSync(p, 'utf8');
  const lineCount = text.split('\n').filter((l) => l.trim()).length;
  return { exists: true, path: p, lineCount };
}
