'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { CoverLayout } from '@/components/layout/CoverLayout';
import { Button } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import type { CoverImagePayload } from '@/types';

const QUICK: { label: string; text: string }[] = [
  { label: 'Contrast', text: 'Increase contrast between imagery and blurb text zones.' },
  { label: 'Simplify', text: 'Simplify and de-clutter the background for legible blurb text.' },
  { label: 'Darker', text: 'Shift the overall mood darker and more subdued.' },
];

function parsePayload(doc: { content: string }): CoverImagePayload | null {
  try {
    return JSON.parse(doc.content) as CoverImagePayload;
  } catch {
    return null;
  }
}

export default function BackCoverRefinePage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const { project, documents, chapters, revisionTasks, loading, error, updateProject, refresh } = useProject(
    projectId ?? null
  );

  const backImages = useMemo(() => {
    return documents
      .filter((d) => d.type === 'cover-image')
      .map((d) => {
        const p = parsePayload(d);
        return p?.surface === 'back' ? { docId: d.id, payload: p, updatedAt: d.updatedAt } : null;
      })
      .filter(Boolean) as { docId: string; payload: CoverImagePayload; updatedAt: Date }[];
  }, [documents]);

  const versions = useMemo(() => {
    const list = [...backImages];
    list.sort((a, b) => {
      const va = (a.payload.version ?? 1) - (b.payload.version ?? 1);
      if (va !== 0) return va;
      return a.updatedAt.getTime() - b.updatedAt.getTime();
    });
    return list.map((row, idx) => ({ ...row, label: `v${row.payload.version ?? 1}.${idx}` }));
  }, [backImages]);

  const [pick, setPick] = useState<string>('');
  const [request, setRequest] = useState('');
  const [nVariants, setNVariants] = useState<2 | 4>(2);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selected = versions.find((v) => v.docId === pick);

  const refine = useCallback(async () => {
    if (!projectId || !pick || !request.trim() || !selected) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch('/api/cover/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          coverSide: 'back',
          parentImageId: pick,
          originalPrompt: selected.payload.promptUsed,
          refinementRequest: request.trim(),
          n: nVariants,
          quality: 'high',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Refinement failed');
      setRequest('');
      await refresh?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Refine failed');
    } finally {
      setBusy(false);
    }
  }, [projectId, pick, request, selected, nVariants, refresh]);

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
        Refine or approve a rear-panel candidate. Same prompt-composition pattern as the front cover.
      </p>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] gap-8">
        <div>
          {selected ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              className="w-full max-w-md rounded-xl border border-border shadow-sm"
              src={`data:image/png;base64,${selected.payload.imageData}`}
            />
          ) : (
            <p className="text-muted-foreground">Pick a variant from the right.</p>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Versions</h3>
            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
              {versions.map((v) => (
                <button
                  key={v.docId}
                  type="button"
                  className={`text-left rounded-md border px-2 py-2 flex gap-2 ${pick === v.docId ? 'border-accent ring-1 ring-accent/25' : 'border-border hover:bg-muted/50'}`}
                  onClick={() => setPick(v.docId)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt=""
                    className="w-14 h-[84px] object-cover rounded"
                    src={`data:image/png;base64,${v.payload.imageData}`}
                  />
                  <span className="text-xs">{v.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Changes</h3>
            <textarea
              className="w-full rounded-md border border-border bg-background p-3 text-sm min-h-[80px]"
              value={request}
              onChange={(e) => setRequest(e.target.value)}
            />
            <div className="flex flex-wrap gap-1 mt-2">
              {QUICK.map((q) => (
                <Button
                  key={q.label}
                  type="button"
                  variant="secondary"
                  className="h-7 px-2 text-[0.65rem]"
                  onClick={() => setRequest((r) => (r ? `${r} ${q.text}` : q.text))}
                >
                  {q.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={nVariants === 4}
                onChange={() => setNVariants((n) => (n === 2 ? 4 : 2))}
              />
              4 variants
            </label>
            <Button type="button" disabled={busy || !pick || request.trim().length < 3} onClick={() => void refine()}>
              {busy ? 'Refining…' : `Refine (${nVariants})`}
            </Button>
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}

          <Button type="button" variant="secondary" disabled={!pick} onClick={() => void approve()}>
            Approve selected back panel
          </Button>
          {project.approvedBackCoverImageId && (
            <p className="text-xs text-green-700 dark:text-green-400">Approved: {project.approvedBackCoverImageId}</p>
          )}
        </div>
      </div>

      <div className="mt-8 flex gap-4 text-sm">
        <Link href={`/projects/${projectId}/cover/paperback/back-generate`} className="text-muted-foreground underline">
          Generation
        </Link>
        <Link href={`/projects/${projectId}/cover/paperback/back-export`} className="text-accent underline">
          Export
        </Link>
      </div>
    </CoverLayout>
  );
}
