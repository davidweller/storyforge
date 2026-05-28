'use client';

import { use } from 'react';
import { SerialPageShell } from '../_components/SerialPageShell';

export default function SerialChaptersPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  return (
    <SerialPageShell
      projectId={projectId}
      title="Serial Chapters"
      description="Browse serial chapter set and open per-chapter editor pages."
    />
  );
}
