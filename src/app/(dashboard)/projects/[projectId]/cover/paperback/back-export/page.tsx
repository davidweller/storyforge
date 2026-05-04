'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CoverLayout } from '@/components/layout/CoverLayout';
import { Button } from '@/components/ui';
import { useProject } from '@/hooks/useProject';

export default function BackCoverExportPage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const { project, documents, chapters, revisionTasks, loading, error } = useProject(projectId ?? null);

  if (!projectId) return null;
  if (loading || !project) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  const pid = encodeURIComponent(projectId);
  const dl = (f: string) => `/api/cover/back-digital-export?projectId=${pid}&format=${f}`;

  return (
    <CoverLayout
      projectId={projectId}
      section="paperback"
      title="Back cover export"
      project={project}
      documents={documents}
      chapters={chapters ?? []}
      revisionTasks={revisionTasks ?? []}
    >
      {!project.approvedBackCoverImageId ? (
        <p className="text-muted-foreground mb-6">Approve a back cover in refinement before exporting.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-6">
            Resized presets using <code className="text-xs">sharp</code> from your approved rear panel raster.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href={dl('kdp-back')}>
              <Button type="button">KDP back PNG (2560×1600)</Button>
            </a>
            <a href={dl('social-square')}>
              <Button type="button" variant="secondary">
                Social square (1400×1400)
              </Button>
            </a>
          </div>
        </>
      )}
      <Link
        href={`/projects/${projectId}/cover/paperback/back-refine`}
        className="mt-8 inline-block text-sm text-accent underline"
      >
        Back to back refinement
      </Link>
    </CoverLayout>
  );
}
