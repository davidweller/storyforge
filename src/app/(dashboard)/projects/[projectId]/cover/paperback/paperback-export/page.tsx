'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { CoverLayout } from '@/components/layout/CoverLayout';
import { Button } from '@/components/ui';
import { useProject } from '@/hooks/useProject';

export default function PaperbackExportPage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const { project, documents, chapters, revisionTasks, loading, error } = useProject(projectId ?? null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const hasSpec = useMemo(() => documents.some((d) => d.type === 'paperback-spec'), [documents]);

  const downloadWrap = async () => {
    if (!projectId) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch('/api/cover/paperback-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition');
      const filenameMatch = cd?.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? 'paperback-fullwrap.png';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setBusy(false);
    }
  };

  if (!projectId) return null;
  if (loading || !project) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  const canExport = !!(project.approvedCoverImageId && project.approvedBackCoverImageId && hasSpec);

  return (
    <CoverLayout
      projectId={projectId}
      section="paperback"
      title="Full-wrap export"
      project={project}
      documents={documents}
      chapters={chapters ?? []}
      revisionTasks={revisionTasks ?? []}
    >
      <p className="text-sm text-muted-foreground mb-6">
        Builds a PNG with spine and bleed based on your saved paperback spec plus the approved front and back panel
        rasters (server composite via sharp).
      </p>
      {err && <div className="mb-4 rounded-md bg-red-950/40 p-3 text-sm text-red-200">{err}</div>}
      {!canExport ? (
        <ul className="list-disc pl-6 text-muted-foreground text-sm space-y-2 mb-6">
          {!hasSpec && (
            <li>
              Save a paperback spec{' '}
              <Link href={`/projects/${projectId}/cover/paperback/spec`} className="text-accent underline">
                here
              </Link>
              .
            </li>
          )}
          {!project.approvedCoverImageId && <li>Approve a front cover image.</li>}
          {!project.approvedBackCoverImageId && <li>Approve a back panel image in Back cover refinement.</li>}
        </ul>
      ) : (
        <Button type="button" disabled={busy} onClick={() => void downloadWrap()}>
          {busy ? 'Rendering…' : 'Download paperback full-wrap PNG'}
        </Button>
      )}
      <div className="mt-8 flex gap-4 text-sm">
        <Link href={`/projects/${projectId}/cover/paperback/spec`} className="text-muted-foreground underline">
          Paperback spec
        </Link>
        <Link href={`/projects/${projectId}/cover/paperback/back-refine`} className="text-accent underline">
          Back refinement
        </Link>
      </div>
    </CoverLayout>
  );
}
