'use client';

import { use } from 'react';
import { SerialPageShell } from '../_components/SerialPageShell';

export default function SerialMappingPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  return (
    <SerialPageShell
      projectId={projectId}
      title="Serial Mapping"
      description="Approve scene-to-serial chapter mapping with target word count validation."
    />
  );
}
