'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { CoverLayout } from '@/components/layout/CoverLayout';
import { Button } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import type { CoverImagePayload } from '@/types';

export default function CoverRefinePage() {
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
          return p.surface === 'front' && p.status === 'candidate' ? { docId: d.id, payload: p } : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as { docId: string; payload: CoverImagePayload }[];
  }, [documents]);

  const [pick, setPick] = useState<string>('');

  const approve = async () => {
    if (!projectId || !pick || !updateProject) return;
    await updateProject({ approvedCoverImageId: pick, coverGenerationStatus: 'complete' });
    await refresh?.();
  };

  if (!projectId) return null;
  if (loading || !project) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <CoverLayout
      projectId={projectId}
      section="front"
      title="Refinement"
      project={project}
      documents={documents}
      chapters={chapters ?? []}
      revisionTasks={revisionTasks ?? []}
    >
      <p className="text-sm text-muted-foreground mb-6">
        Iterative gpt-image refines are not wired in this build — pick your favourite candidate here to mark it approved for exports.
      </p>
      {candidates.length === 0 ? (
        <p className="text-muted-foreground">No candidate front cover images yet — run Generation first.</p>
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
                {payload.archetypeId} variant {payload.variantIndex + 1} — {payload.runId.slice(0, 8)}…
              </option>
            ))}
          </select>
          {pick ? (
            <img
              alt="Preview"
              className="max-h-[420px] rounded-lg border border-border"
              src={`data:image/png;base64,${candidates.find((c) => c.docId === pick)?.payload.imageData ?? ''}`}
            />
          ) : null}
          <Button type="button" disabled={!pick} onClick={() => void approve()}>
            Approve selected cover (project canonical)
          </Button>
          {project.approvedCoverImageId && (
            <p className="text-xs text-green-700 dark:text-green-400">Approved front: {project.approvedCoverImageId}</p>
          )}
        </div>
      )}
      <div className="mt-8 flex gap-4 text-sm">
        <Link href={`/projects/${projectId}/cover/front/generate`} className="text-muted-foreground underline">
          Generation
        </Link>
        <Link href={`/projects/${projectId}/cover/front/export`} className="text-accent underline">
          Digital export
        </Link>
      </div>
    </CoverLayout>
  );
}
