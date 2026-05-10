'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { APlusLayout } from '@/components/layout';
import { Button } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import { APLUS_MODULES } from '@/lib/aplus/moduleCatalog';
import type { APlusImagePayload } from '@/types';

function parsePayload(content: string): APlusImagePayload | null {
  try {
    return JSON.parse(content) as APlusImagePayload;
  } catch {
    return null;
  }
}

export default function APlusExportPage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const { project, documents, chapters, revisionTasks, loading, error, updateProject, refresh, updateDocument } = useProject(projectId ?? null);

  const variants = useMemo(() => {
    return documents
      .filter((d) => d.type === 'a-plus-module')
      .map((d) => {
        const payload = parsePayload(d.content);
        return payload ? { docId: d.id, payload } : null;
      })
      .filter(Boolean) as Array<{ docId: string; payload: APlusImagePayload }>;
  }, [documents]);

  if (!projectId) return null;
  if (loading || !project) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  const approvedOnly = variants.filter((v) => v.payload.status === 'approved' || v.docId === project.approvedAPlusModuleId);

  const approveForExport = async (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;
    const payload = parsePayload(doc.content);
    if (!payload) return;
    await updateDocument(docId, {
      content: JSON.stringify({ ...payload, status: 'approved' }),
      version: doc.version + 1,
      approved: true,
    });
    await updateProject({ approvedAPlusModuleId: docId, aPlusGenerationStatus: 'complete' });
    await refresh?.();
  };

  return (
    <APlusLayout
      projectId={projectId}
      title="Export"
      project={project}
      documents={documents}
      chapters={chapters ?? []}
      revisionTasks={revisionTasks ?? []}
    >
      <p className="text-sm text-muted-foreground mb-4">
        Download approved A+ images as PNG files. File naming follows the module type and version.
      </p>
      {!approvedOnly.length && (
        <p className="text-sm text-muted-foreground mb-4">
          No approved A+ module yet. You can still pick one below and mark it approved for export.
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(approvedOnly.length ? approvedOnly : variants).map(({ docId, payload }) => (
          <div key={docId} className="rounded-md border border-border overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" src={`data:image/png;base64,${payload.imageData}`} className="w-full h-auto" />
            <div className="p-3">
              <p className="text-sm font-medium">{APLUS_MODULES.find((m) => m.id === payload.moduleType)?.label ?? payload.moduleType}</p>
              <p className="text-xs text-muted-foreground mb-2">Version {payload.version}</p>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" className="h-8 text-xs" onClick={() => void approveForExport(docId)}>
                  Set as approved
                </Button>
                <a
                  href={`/api/aplus/export?projectId=${projectId}&moduleId=${docId}`}
                  className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-3 h-8 text-xs no-underline"
                >
                  Download PNG
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 flex gap-4 text-sm">
        <Link href={`/projects/${projectId}/aplus/refine`} className="underline text-muted-foreground">
          Refine
        </Link>
        <Link href={`/projects/${projectId}/aplus/setup`} className="underline text-accent">
          Back to setup
        </Link>
      </div>
    </APlusLayout>
  );
}
