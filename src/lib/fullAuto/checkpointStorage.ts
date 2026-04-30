/** Client-only localStorage keys for Full Auto checkpoint UX. */

export const fullAutoCheckpointsEnabledKey = (projectId: string) =>
  `novel-full-auto-checkpoints-${projectId}`;

export const fullAutoLastStepKey = (projectId: string) => `novel-fa-last-step-${projectId}`;

export const fullAutoCheckpointPendingKey = (projectId: string) =>
  `novel-fa-checkpoint-pending-${projectId}`;

export type FullAutoCheckpointPendingV1 = {
  v: 1;
  stepKey: string;
  title: string;
  bullets: string[];
};

export const FULL_AUTO_LAST_STEP_LABELS: Record<string, string> = {
  'after-ending': 'Ending checkpoint',
  'after-title': 'Title checkpoint',
  'after-outlines': 'Chapter outlines checkpoint',
  'after-first-chapter': 'First chapter checkpoint',
};

export function labelForFullAutoLastStep(stepKey: string): string {
  return FULL_AUTO_LAST_STEP_LABELS[stepKey] ?? stepKey;
}

export function readFullAutoCheckpointPending(projectId: string): FullAutoCheckpointPendingV1 | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(fullAutoCheckpointPendingKey(projectId));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<FullAutoCheckpointPendingV1>;
    if (p?.v !== 1 || typeof p.stepKey !== 'string' || typeof p.title !== 'string' || !Array.isArray(p.bullets)) {
      window.localStorage.removeItem(fullAutoCheckpointPendingKey(projectId));
      return null;
    }
    return p as FullAutoCheckpointPendingV1;
  } catch {
    try {
      window.localStorage.removeItem(fullAutoCheckpointPendingKey(projectId));
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function readFullAutoLastStep(projectId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(fullAutoLastStepKey(projectId));
    return v?.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export function fullAutoCheckpointsEnabled(projectId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(fullAutoCheckpointsEnabledKey(projectId)) === '1';
  } catch {
    return false;
  }
}

export function writeFullAutoCheckpointPending(
  projectId: string,
  payload: Omit<FullAutoCheckpointPendingV1, 'v'>
): void {
  if (typeof window === 'undefined') return;
  try {
    const body: FullAutoCheckpointPendingV1 = { v: 1, ...payload };
    window.localStorage.setItem(fullAutoCheckpointPendingKey(projectId), JSON.stringify(body));
  } catch {
    /* ignore */
  }
}

export function writeFullAutoLastStep(projectId: string, stepKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(fullAutoLastStepKey(projectId), stepKey);
  } catch {
    /* ignore */
  }
}

export function clearFullAutoCheckpointPending(projectId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(fullAutoCheckpointPendingKey(projectId));
  } catch {
    /* ignore */
  }
}

export function clearFullAutoRunMarkers(projectId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(fullAutoLastStepKey(projectId));
    window.localStorage.removeItem(fullAutoCheckpointPendingKey(projectId));
  } catch {
    /* ignore */
  }
}
