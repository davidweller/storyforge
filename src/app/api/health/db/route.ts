import { NextResponse } from 'next/server';
import { probeSqliteHealth } from '@/lib/db/index';
import { getUsageLogMetrics } from '@/lib/db/usageLogMetrics';
import { fallbackUsageFileStats } from '@/lib/db/generationUsageFallback';

/** GET /api/health/db — SQLite readiness and in-process usage-log failure tally (dev/support). */
export async function GET() {
  const sqlite = probeSqliteHealth();
  const usageMetrics = getUsageLogMetrics();
  const fb = fallbackUsageFileStats();
  const status = sqlite.ok ? 200 : 503;

  return NextResponse.json(
    {
      sqlite: sqlite.ok ? { ok: true as const } : { ok: false as const, error: sqlite.error },
      usageLogFailures: usageMetrics.failureCount,
      usageLogFallbackAppends: usageMetrics.fallbackAppendCount,
      lastUsageLogError: usageMetrics.lastError,
      generationUsageFallbackFile: fb,
    },
    { status }
  );
}
