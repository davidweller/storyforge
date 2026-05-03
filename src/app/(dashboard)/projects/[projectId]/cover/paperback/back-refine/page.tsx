'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { CoverLayout } from '@/components/layout/CoverLayout';
import { Button } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import type { CoverImagePayload } from '@/types';

export default function BackCoverRefinePage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const { project, documents, chapters, revisionTasks, loading, error, updateProject, refresh } = useProject(
    projectId ?? null
  );

  const candidates = useMemo(() => {
    return documents
      .filter((d) => d.type === 'cover-image')
      .map((d) => {
        try {
          const p = JSON.parse(d.content) as CoverImagePayload;
          return p.surface === 'back' && p.status === 'candidate' ? { docId: d.id, payload: p } : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as { docId: string; payload: CoverImagePayload }[];
  }, [documents]);

  const [pick, setPick] = useState<string>('');

  const approve = async () => {
    if (!projectId || !pick || !updateProject) return;
    await updateProject({ approvedBackCoverImageId: pick, paperbackGenerationStatus: 'complete' });
    await refresh?.();
  };

  if (!projectId) return null;
  if (loading || !project) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <CoverLayout
      projectId={projectId}
      section="paperback"
      title="Back cover refinement"
      project={project}
      documents={documents}
      chapters={chapters ?? []}
      revisionTasks={revisionTasks ?? []}
    >
      <p className="text-sm text-muted-foreground mb-6">
        Iterative edits are not wired here yet — approve the variant that reads best as your rear-panel background before
        full-wrap export.
      </p>
      {candidates.length === 0 ? (
        <p className="text-muted-foreground">No candidate back-panel images yet — run Back cover generation first.</p>
      ) : (
        <div className="space-y-4 max-w-xl">
          <select
            className="w-full rounded-md border border-border bg-background p-2 text-sm"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
          >
            <option value="">Select a variant…</option>
            {candidates.map(({ docId, payload }) => (
              <option key={docId} value={docId}>
                variant {payload.variantIndex + 1} — run {payload.runId.slice(0, 8)}…
              </option>
            ))}
          </select>
          {pick ? (
            <img
              alt="Back panel preview"
              className="max-h-[420px] rounded-lg border border-border"
              src={`data:image/png;base64,${candidates.find((c) => c.docId === pick)?.payload.imageData ?? ''}`}
            />
          ) : null}
          <Button type="button" disabled={!pick} onClick={() => void approve()}>
            Approve selected back panel
          </Button>
          {project.approvedBackCoverImageId && (
            <p className="text-xs text-green-700 dark:text-green-400">
              Approved back panel: {project.approvedBackCoverImageId}
            </p>
          )}
        </div>
      )}
      <div className="mt-8 flex gap-4 text-sm">
        <Link href={`/projects/${projectId}/cover/paperback/back-generate`} className="text-muted-foreground underline">
          Generation
        </Link>
        <Link href={`/projects/${projectId}/cover/paperback/paperback-export`} className="text-accent underline">
          Full-wrap export
        </Link>
      </div>
    </CoverLayout>
  );
}
