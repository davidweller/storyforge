'use client';

import { use } from 'react';
import { SerialPageShell } from '../_components/SerialPageShell';

export default function SerialSetupPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  return (
    <SerialPageShell
      projectId={projectId}
      title="Serial Setup"
      description="Enter serialisation, confirm RR bible fork status, and prepare source selection."
    />
  );
}
