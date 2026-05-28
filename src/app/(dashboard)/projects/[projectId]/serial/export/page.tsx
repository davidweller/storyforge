'use client';

import { use } from 'react';
import { SerialPageShell } from '../_components/SerialPageShell';

export default function SerialExportPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  return (
    <SerialPageShell
      projectId={projectId}
      title="Serial Export"
      description="Export serial chapter markdown for manual posting to Royal Road."
    />
  );
}
