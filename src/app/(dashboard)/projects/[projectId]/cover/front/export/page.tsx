'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CoverLayout } from '@/components/layout/CoverLayout';
import { Button } from '@/components/ui';
import { useProject } from '@/hooks/useProject';

export default function CoverDigitalExportPage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const { project, documents, chapters, revisionTasks, loading, error } = useProject(projectId ?? null);

  if (!projectId) return null;
  if (loading || !project) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  const pid = encodeURIComponent(projectId);
  const dl = (f: string) => `/api/cover/digital-export?projectId=${pid}&format=${f}`;

  return (
    <CoverLayout
      projectId={projectId}
      section="front"
      title="Export (Kindle / ebook)"
      project={project}
      documents={documents}
      chapters={chapters ?? []}
      revisionTasks={revisionTasks ?? []}
    >
      {!project.approvedCoverImageId ? (
        <p className="text-muted-foreground">Approve a front cover in Refinement before exporting.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-6">
            Raster upscaling / presets use <code className="text-xs">sharp</code> server-side from the approved cover image.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href={dl('kdp-ebook')}>
              <Button type="button">KDP ebook (1600×2560)</Button>
            </a>
            <a href={dl('kindle-thumb')}>
              <Button type="button" variant="secondary">
                Kindle thumbnail (1000×1563)
              </Button>
            </a>
            <a href={dl('social-square')}>
              <Button type="button" variant="secondary">
                Social square (1400×1400)
              </Button>
            </a>
          </div>
        </>
      )}
      <Link href={`/projects/${projectId}/cover/front/refine`} className="mt-8 inline-block text-sm text-accent underline">
        Back to refinement
      </Link>
    </CoverLayout>
  );
}
