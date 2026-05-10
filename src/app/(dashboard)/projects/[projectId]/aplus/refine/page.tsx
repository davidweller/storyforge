'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { APlusLayout } from '@/components/layout';
import { Button } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import { APLUS_MODULES } from '@/lib/aplus/moduleCatalog';
import type { APlusImagePayload } from '@/types';

const QUICK = [
  'Increase contrast and subject clarity.',
  'Simplify the background and reduce clutter.',
  'Push mood darker and more cinematic.',
  'Make text more legible and cleaner.',
  'Use warmer palette while preserving style DNA.',
];

function parsePayload(content: string): APlusImagePayload | null {
  try {
    return JSON.parse(content) as APlusImagePayload;
  } catch {
    return null;
  }
}

export default function APlusRefinePage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const { project, documents, chapters, revisionTasks, loading, error, refresh, updateProject, updateDocument } = useProject(projectId ?? null);
  const [pick, setPick] = useState<string>('');
  const [request, setRequest] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const variants = useMemo(() => {
    return documents
      .filter((d) => d.type === 'a-plus-module')
      .map((d) => {
        const p = parsePayload(d.content);
        return p ? { docId: d.id, payload: p, updatedAt: d.updatedAt } : null;
      })
      .filter(Boolean) as Array<{ docId: string; payload: APlusImagePayload; updatedAt: Date }>;
  }, [documents]);

  const selected = variants.find((v) => v.docId === pick);

  if (!projectId) return null;
  if (loading || !project) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  const refine = async () => {
    if (!selected || !request.trim()) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch('/api/aplus/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          parentImageId: selected.docId,
          originalPrompt: selected.payload.promptUsed,
          refinementRequest: request.trim(),
          n: 2,
          quality: 'high',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Refinement failed');
      setRequest('');
      await refresh?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Refinement failed');
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!pick || !selected) return;
    const doc = documents.find((d) => d.id === pick);
    if (!doc) return;
    const payload = parsePayload(doc.content);
    if (!payload) return;
    await updateDocument(pick, {
      content: JSON.stringify({ ...payload, status: 'approved' }),
      version: doc.version + 1,
      approved: true,
    });
    await updateProject({ approvedAPlusModuleId: pick, aPlusGenerationStatus: 'complete' });
    await refresh?.();
  };

  return (
    <APlusLayout
      projectId={projectId}
      title="Refine"
      project={project}
      documents={documents}
      chapters={chapters ?? []}
      revisionTasks={revisionTasks ?? []}
    >
      <p className="text-sm text-muted-foreground mb-6">
        Select an A+ variant, apply a refinement instruction, and generate improved versions.
      </p>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-8">
        <div>
          {selected ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" className="w-full max-w-md rounded-lg border border-border" src={`data:image/png;base64,${selected.payload.imageData}`} />
              <p className="mt-2 text-xs text-muted-foreground">
                Module: {APLUS_MODULES.find((m) => m.id === selected.payload.moduleType)?.label ?? selected.payload.moduleType}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">Select an image variant from the right.</p>
          )}
        </div>
        <div className="space-y-4">
          <div className="max-h-[320px] overflow-y-auto space-y-2">
            {variants.map((v) => (
              <button
                key={v.docId}
                type="button"
                onClick={() => setPick(v.docId)}
                className={`w-full text-left rounded-md border p-2 flex gap-2 ${pick === v.docId ? 'border-accent ring-1 ring-accent/25' : 'border-border hover:bg-muted/50'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" className="w-14 h-20 rounded object-cover" src={`data:image/png;base64,${v.payload.imageData}`} />
                <div className="text-xs">
                  <p className="font-medium">{APLUS_MODULES.find((m) => m.id === v.payload.moduleType)?.label ?? v.payload.moduleType}</p>
                  <p className="text-muted-foreground">v{v.payload.version}</p>
                </div>
              </button>
            ))}
          </div>
          <textarea
            className="w-full rounded-md border border-border bg-background p-3 text-sm min-h-[100px]"
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder="Describe refinements"
          />
          <div className="flex flex-wrap gap-1">
            {QUICK.map((q) => (
              <Button key={q} type="button" variant="secondary" className="h-7 px-2 text-[0.65rem]" onClick={() => setRequest((r) => (r ? `${r} ${q}` : q))}>
                {q}
              </Button>
            ))}
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <Button type="button" disabled={!pick || request.trim().length < 3 || busy} onClick={() => void refine()}>
              {busy ? 'Refining…' : 'Refine selected'}
            </Button>
            <Button type="button" variant="secondary" disabled={!pick} onClick={() => void approve()}>
              Approve selected
            </Button>
          </div>
          {project.approvedAPlusModuleId && (
            <p className="text-xs text-green-700 dark:text-green-400">Approved module doc: {project.approvedAPlusModuleId}</p>
          )}
        </div>
      </div>
      <div className="mt-8 flex gap-4 text-sm">
        <Link href={`/projects/${projectId}/aplus/generate`} className="underline text-muted-foreground">
          Generate
        </Link>
        <Link href={`/projects/${projectId}/aplus/export`} className="underline text-accent">
          Export
        </Link>
      </div>
    </APlusLayout>
  );
}
