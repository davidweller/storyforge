'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { WorkflowSidebar } from './WorkflowSidebar';
import { WorkflowRail, type SectionId } from './WorkflowRail';
import { SERIALISATION_FEATURE_ENABLED } from '@/lib/constants';
import type { WorkflowStage, Chapter, RevisionTask, ProjectDocument } from '@/types';

interface WorkflowNavProps {
  projectId: string;
  projectTitle?: string;
  genre?: string;
  niche?: string;
  currentStage: WorkflowStage;
  chapters?: Chapter[];
  approvedChapterIds?: Set<string>;
  revisionTasks?: RevisionTask[];
  documents?: ProjectDocument[];
  fourPassEditorial?: boolean;
  finalExportedAt?: Date;
  blurbFilled?: boolean;
  amazonDescriptionFilled?: boolean;
  approvedCoverImageId?: string | null;
  approvedBackCoverImageId?: string | null;
  approvedAPlusModuleId?: string | null;
}

/**
 * Map the current pathname to a workflow section. Falls back to 'planning' for any
 * unrecognized route (including the bare /projects/[id] dashboard).
 */
export function getActiveSection(pathname: string): SectionId {
  if (SERIALISATION_FEATURE_ENABLED && pathname.includes('/serial/')) return 'serialisation';
  if (pathname.includes('/marketing/')) return 'marketing';
  if (pathname.includes('/cover/')) return 'cover';
  if (pathname.includes('/aplus/')) return 'aplus';

  if (pathname.includes('/chapter/')) return 'writing';

  if (pathname.includes('/stage/chapter-outlines') || pathname.includes('/stage/chapters')) {
    return 'writing';
  }

  if (
    pathname.includes('/stage/compilation') ||
    pathname.includes('/stage/export-draft') ||
    pathname.includes('/stage/editorial') ||
    pathname.includes('/stage/revision') ||
    pathname.includes('/stage/export-final')
  ) {
    return 'editing';
  }

  return 'planning';
}

export function WorkflowNav(props: WorkflowNavProps) {
  const pathname = usePathname();

  const urlSection = useMemo(() => getActiveSection(pathname), [pathname]);
  const [override, setOverride] = useState<SectionId | null>(null);

  // Reset the click-override whenever the URL changes so the rail re-syncs to URL state.
  useEffect(() => {
    setOverride(null);
  }, [pathname]);

  const activeSection = override ?? urlSection;

  const documents = props.documents ?? [];
  const coverCanonUnlocked = documents.some(
    (d) => d.type === 'story-bible' || d.type === 'creative-brief'
  );
  const paperbackUnlocked = Boolean(props.approvedCoverImageId);
  const aPlusUnlocked =
    coverCanonUnlocked && Boolean(props.approvedCoverImageId) && Boolean(props.approvedBackCoverImageId);

  return (
    <div className="flex h-full shrink-0">
      <WorkflowRail
        activeSection={activeSection}
        onSelect={setOverride}
        coverCanonUnlocked={coverCanonUnlocked}
        paperbackUnlocked={paperbackUnlocked}
        aPlusUnlocked={aPlusUnlocked}
        serialisationUnlocked={Boolean(props.finalExportedAt)}
        serialisationEnabled={SERIALISATION_FEATURE_ENABLED}
      />
      <WorkflowSidebar {...props} activeSection={activeSection} />
    </div>
  );
}
