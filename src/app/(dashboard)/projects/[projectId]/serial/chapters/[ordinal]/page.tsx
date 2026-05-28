'use client';

import { use } from 'react';
import { SerialPageShell } from '../../_components/SerialPageShell';

interface SerialChapterPageProps {
  params: Promise<{ projectId: string; ordinal: string }>;
}

export default function SerialChapterPage({ params }: SerialChapterPageProps) {
  const resolved = use(params);
  const ordinal = Number.parseInt(resolved.ordinal, 10);

  return (
    <SerialPageShell
      projectId={resolved.projectId}
      title={`Serial Chapter ${Number.isFinite(ordinal) ? ordinal : resolved.ordinal}`}
      description="Per-chapter serial editor scaffold for enhancement/revision/export actions."
    />
  );
}
