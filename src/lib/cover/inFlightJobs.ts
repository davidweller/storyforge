const COVER_IN_FLIGHT_KEY = '__storyforgeCoverInFlightJobs__';

type GlobalWithCoverJobs = typeof globalThis & {
  [COVER_IN_FLIGHT_KEY]?: Set<string>;
};

function getInFlightSet(): Set<string> {
  const g = globalThis as GlobalWithCoverJobs;
  if (!g[COVER_IN_FLIGHT_KEY]) {
    g[COVER_IN_FLIGHT_KEY] = new Set<string>();
  }
  return g[COVER_IN_FLIGHT_KEY];
}

export function isCoverJobInFlight(jobId: string): boolean {
  return getInFlightSet().has(jobId);
}

export function runCoverJobOnce(jobId: string, runner: () => Promise<void>): void {
  const inFlight = getInFlightSet();
  if (inFlight.has(jobId)) return;
  inFlight.add(jobId);
  void runner().finally(() => {
    inFlight.delete(jobId);
  });
}
