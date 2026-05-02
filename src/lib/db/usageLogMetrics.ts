/** In-process counters when persistent generation_usage INSERT fails (e.g. native SQLite bind error). */

let usageRecordFailureCount = 0;
let lastUsageRecordFailureMessage: string | null = null;
let usageFallbackAppendCount = 0;

export function recordUsageRecordFailure(err: unknown): void {
  usageRecordFailureCount += 1;
  lastUsageRecordFailureMessage = err instanceof Error ? err.message : String(err);
}

export function recordUsageFallbackAppend(): void {
  usageFallbackAppendCount += 1;
}

export function getUsageLogMetrics(): {
  failureCount: number;
  lastError: string | null;
  fallbackAppendCount: number;
} {
  return {
    failureCount: usageRecordFailureCount,
    lastError: lastUsageRecordFailureMessage,
    fallbackAppendCount: usageFallbackAppendCount,
  };
}

/** @internal */
export function resetUsageLogMetricsForTests(): void {
  usageRecordFailureCount = 0;
  lastUsageRecordFailureMessage = null;
  usageFallbackAppendCount = 0;
}
