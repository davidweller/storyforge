'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { CoverLayout } from '@/components/layout/CoverLayout';
import { Button } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import type { CoverImagePayload } from '@/types';

const QUICK: { label: string; text: string }[] = [
  { label: 'Stronger contrast', text: 'Increase contrast significantly between subject and background.' },
  { label: 'Simplify background', text: 'Simplify and de-clutter the background, reduce detail.' },
  { label: 'Zoom in', text: 'Zoom in on the focal element, crop closer.' },
  { label: 'Darker mood', text: 'Shift the overall mood and lighting darker and more dramatic.' },
  { label: 'Lighter mood', text: 'Shift the overall mood and lighting warmer and more inviting.' },
  { label: 'Bolder typography', text: 'Make the title typography larger and heavier weight.' },
  { label: 'Warmer palette', text: 'Shift the colour palette warmer.' },
  { label: 'Cooler palette', text: 'Shift the colour palette cooler.' },
];

function parsePayload(doc: { content: string }): CoverImagePayload | null {
  try {
    return JSON.parse(doc.content) as CoverImagePayload;
  } catch {
    return null;
  }
}

export default function CoverRefinePage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const { project, documents, chapters, revisionTasks, loading, error, updateProject, refresh } = useProject(projectId ?? null);

  const frontImages = useMemo(() => {
    return documents
      .filter((d) => d.type === 'cover-image')
      .map((d) => {
        const p = parsePayload(d);
        return p?.surface === 'front' ? { docId: d.id, payload: p, updatedAt: d.updatedAt } : null;
      })
      .filter(Boolean) as { docId: string; payload: CoverImagePayload; updatedAt: Date }[];
  }, [documents]);

  const versions = useMemo(() => {
    const list = [...frontImages];
    list.sort((a, b) => {
      const va = (a.payload.version ?? 1) - (b.payload.version ?? 1);
      if (va !== 0) return va;
      return a.updatedAt.getTime() - b.updatedAt.getTime();
    });
    return list.map((row, idx) => ({ ...row, label: `v${row.payload.version ?? 1}.${idx}`, shortReq: row.payload.refinementRequest }));
  }, [frontImages]);

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
          coverSide: 'front',
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
    if (typeof window !== 'undefined') {
      const ok = window.confirm(
        'Approve this as your front cover? This will unlock Back Cover and Full Wrap.'
      );
      if (!ok) return;
    }
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
        Branch from any prior version via the thumbnails. Requests compose as: original prompt plus refinement paragraph.
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
            <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto">
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
                  <span className="text-xs shrink-0 w-14">{v.label}</span>
                  <span className="text-[0.65rem] text-muted-foreground leading-snug truncate">
                    {v.shortReq || 'generation'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Describe your changes</h3>
            <textarea
              className="w-full rounded-md border border-border bg-background p-3 text-sm min-h-[100px]"
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder="e.g. Darken the sky to deep navy; make the emblem larger."
            />
            <div className="flex flex-wrap gap-1 mt-2">
              {QUICK.map((q) => (
                <Button key={q.label} type="button" variant="secondary" className="h-7 px-2 text-[0.65rem]" onClick={() => setRequest((r) => (r ? `${r} ${q.text}` : q.text))}>
                  {q.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={nVariants === 4}
                onChange={() => setNVariants((n) => (n === 2 ? 4 : 2))}
              />
              Generate 4 variants (default 2)
            </label>
            <Button type="button" disabled={busy || !pick || request.trim().length < 3} onClick={() => void refine()}>
              {busy ? 'Refining…' : `Refine (${nVariants} variants)`}
            </Button>
          </div>

          {pick && selected && (
            <details className="text-xs border border-border rounded-md p-2">
              <summary className="cursor-pointer font-medium text-foreground">Prompt preview sent to model</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words text-[0.65rem] max-h-40 overflow-auto">{`${selected.payload.promptUsed}\n\nRefinement: ${request.trim()}. Keep all other elements consistent with the above.`}</pre>
            </details>
          )}

          {err && <p className="text-sm text-red-600">{err}</p>}

          <Button type="button" variant="secondary" disabled={!pick} onClick={() => void approve()}>
            Approve selected as front cover
          </Button>
          {project.approvedCoverImageId && (
            <p className="text-xs text-green-700 dark:text-green-400">Approved front doc: {project.approvedCoverImageId}</p>
          )}
        </div>
      </div>

      <div className="mt-10 flex gap-4 text-sm">
        <Link href={`/projects/${projectId}/cover/front/generate`} className="text-muted-foreground underline">
          Generation
        </Link>
        <Link href={`/projects/${projectId}/cover/front/export`} className="text-accent underline">
          Export
        </Link>
      </div>
    </CoverLayout>
  );
}
