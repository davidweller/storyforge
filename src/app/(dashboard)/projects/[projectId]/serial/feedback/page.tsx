'use client';

import { use } from 'react';
import { SerialPageShell } from '../_components/SerialPageShell';

export default function SerialFeedbackPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  return (
    <SerialPageShell
      projectId={projectId}
      title="Feedback & Canon"
      description="Phase 1 placeholder. Canon impact, deltas, and rollback UI ship in the feedback-loop phase."
    />
  );
}
