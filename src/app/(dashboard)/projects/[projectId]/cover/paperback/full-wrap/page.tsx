'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CoverLayout } from '@/components/layout/CoverLayout';
import { Button } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import type { CoverImagePayload } from '@/types';
import { defaultThirdZones } from '@/lib/cover/fullWrapZones';

type Rect = { x: number; y: number; width: number; height: number };

/** Decode pixel size from raw base64 (PNG or JPEG) for rehydrating canvas when `kdpTemplateImageData` exists. */
function readImageDimsFromBase64(b64: string): Promise<{ w: number; h: number } | null> {
  const tryMime = (mime: string) =>
    new Promise<{ w: number; h: number } | null>((resolve) => {
      const img = new Image();
      img.onload = () =>
        resolve(
          img.naturalWidth > 0 && img.naturalHeight > 0
            ? { w: img.naturalWidth, h: img.naturalHeight }
            : null
        );
      img.onerror = () => resolve(null);
      img.src = `data:${mime};base64,${b64}`;
    });
  return (async () => (await tryMime('image/png')) ?? (await tryMime('image/jpeg')))();
}

function parseCov(doc: string | undefined): CoverImagePayload | null {
  if (!doc) return null;
  try {
    return JSON.parse(doc) as CoverImagePayload;
  } catch {
    return null;
  }
}

export default function FullWrapPage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const { project, documents, chapters, revisionTasks, loading, error, updateProject } = useProject(projectId ?? null);

  const [cw, setCw] = useState(3000);
  const [ch, setCh] = useState(2000);
  const [backZ, setBackZ] = useState<Rect>({ x: 0, y: 0, width: 1000, height: 2000 });
  const [spineZ, setSpineZ] = useState<Rect>({ x: 1000, y: 0, width: 200, height: 2000 });
  const [frontZ, setFrontZ] = useState<Rect>({ x: 1200, y: 0, width: 1800, height: 2000 });
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [series, setSeries] = useState('');
  const [bg, setBg] = useState('#1e293b');
  const [fg, setFg] = useState('#f8fafc');
  const [logoB64, setLogoB64] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    setTitle(project.title ?? '');
    setAuthor(project.authorName ?? '');
  }, [project?.title, project?.authorName, project]);

  useEffect(() => {
    const b64 = project?.kdpTemplateImageData?.trim();
    if (!b64 || typeof window === 'undefined') return;
    let cancelled = false;
    void readImageDimsFromBase64(b64).then((d) => {
      if (!cancelled && d) {
        setCw(d.w);
        setCh(d.h);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [project?.kdpTemplateImageData]);

  const frontPayload = useMemo(() => {
    const id = project?.approvedCoverImageId;
    const d = id ? documents.find((x) => x.id === id) : undefined;
    return parseCov(d?.content);
  }, [project?.approvedCoverImageId, documents]);

  const applyThirdsFromCanvas = useCallback(() => {
    const z = defaultThirdZones(cw, ch);
    setBackZ(z.backZone);
    setSpineZ(z.spineZone);
    setFrontZ(z.frontZone);
  }, [cw, ch]);

  useEffect(() => {
    applyThirdsFromCanvas();
  }, [cw, ch, applyThirdsFromCanvas]);

  const onTemplateFile = (file: File | null) => {
    if (!file || !projectId) return;
    const r = new FileReader();
    r.onload = () => {
      const data = typeof r.result === 'string' ? r.result : '';
      const comma = data.indexOf(',');
      const b64 = comma >= 0 ? data.slice(comma + 1) : data;
      void updateProject({ kdpTemplateImageData: b64 });

      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (w && h) {
          setCw(w);
          setCh(h);
        }
      };
      img.src = data.startsWith('data:') ? data : `data:${file.type};base64,${b64}`;
    };
    r.readAsDataURL(file);
  };

  const downloadBlob = async (fmt: 'pdf' | 'png') => {
    if (
      !projectId ||
      !project?.approvedCoverImageId ||
      !project?.approvedBackCoverImageId ||
      !project.kdpTemplateImageData?.trim()
    )
      return;
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch('/api/cover/full-wrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          frontCoverImageId: project.approvedCoverImageId,
          backCoverImageId: project.approvedBackCoverImageId,
          spineConfig: {
            titleText: title || project.title || 'Untitled',
            authorText: author || project.authorName || 'Author',
            seriesText: series.trim() ? series.trim() : null,
            backgroundColour: bg,
            textColour: fg,
            logoImageData: logoB64,
          },
          templateDimensions: {
            canvasWidth: cw,
            canvasHeight: ch,
            frontZone: frontZ,
            backZone: backZ,
            spineZone: spineZ,
            bleedPx: 0,
          },
          outputFormat: fmt,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === 'string' ? j.error : 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        fmt === 'pdf'
          ? `full-wrap-${projectId!.slice(0, 8)}.pdf`
          : `full-wrap-${projectId!.slice(0, 8)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  const onLogoPick = (f: File | null) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const data = typeof r.result === 'string' ? r.result : '';
      const comma = data.indexOf(',');
      setLogoB64(comma >= 0 ? data.slice(comma + 1) : data);
    };
    r.readAsDataURL(f);
  };

  if (!projectId) return null;
  if (loading || !project) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  const unlocked = !!(project.approvedCoverImageId && project.approvedBackCoverImageId);
  const hasTemplate = !!project.kdpTemplateImageData?.trim();
  const canExport = unlocked && hasTemplate;

  return (
    <CoverLayout
      projectId={projectId}
      section="paperback"
      title="Full wrap"
      project={project}
      documents={documents}
      chapters={chapters ?? []}
      revisionTasks={revisionTasks ?? []}
    >
      <p className="text-sm text-muted-foreground mb-4">
        Upload your Amazon KDP cover template (PNG or JPEG only). Dimensions and back · spine · front zones come from an
        automatic equal-thirds split matching the uploaded image pixel size — no manual coordinate entry needed.         Export composites
        your approved front and rear art with an auto spine strip using the title and author below (defaults pull from project metadata).
        Export requires a template image saved on this project below (dimensions are detected server-side — same rule as automated generate-all wrap).
      </p>

      {!unlocked ? (
        <p className="text-amber-600 dark:text-amber-400">Approve front and back covers first.</p>
      ) : (
        <>
          {!hasTemplate ? (
            <p className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
              Upload and save your KDP template PNG or JPEG below before exporting — the composite uses the dimensions from that stored file.
            </p>
          ) : null}
          {frontPayload && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              className="h-28 w-auto rounded border border-border mb-2"
              src={`data:image/png;base64,${frontPayload.imageData}`}
            />
          )}
          <label className="block text-xs font-medium mb-2">Template image (PNG or JPEG)</label>
          <input
            type="file"
            accept="image/png,image/jpeg"
            className="text-sm mb-4"
            onChange={(e) => onTemplateFile(e.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-muted-foreground mb-4">
            <a href="https://kdp.amazon.com/en_US/cover-calculator" className="underline" target="_blank" rel="noopener noreferrer">
              Download your KDP template from Amazon
            </a>
          </p>

          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground mb-6 font-mono">
            Canvas {cw}×{ch}px · thirds: Back x={Math.round(backZ.x)} · Spine x={Math.round(spineZ.x)} w=
            {Math.round(spineZ.width)} · Front x={Math.round(frontZ.x)}
          </div>

          <h3 className="text-sm font-semibold mb-2">Spine text</h3>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <input className="border rounded px-2 py-1 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
            <input className="border rounded px-2 py-1 text-sm" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author" />
            <input className="border rounded px-2 py-1 text-sm" value={series} onChange={(e) => setSeries(e.target.value)} placeholder="Series (optional)" />
            <div className="flex gap-2">
              <label className="text-xs flex flex-col gap-1">
                Spine bg
                <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} />
              </label>
              <label className="text-xs flex flex-col gap-1">
                Text
                <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} />
              </label>
            </div>
          </div>
          <label className="text-xs block mb-4">
            Spine logo (PNG, optional)
            <input type="file" accept="image/png" className="block mt-1" onChange={(e) => onLogoPick(e.target.files?.[0] ?? null)} />
          </label>

          {err && <p className="text-red-600 text-sm mb-2">{err}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy || !canExport} onClick={() => void downloadBlob('pdf')}>
              {busy ? 'Exporting…' : 'Download PDF'}
            </Button>
            <Button type="button" variant="secondary" disabled={busy || !canExport} onClick={() => void downloadBlob('png')}>
              Download composite PNG
            </Button>
          </div>

          <p className="text-[0.7rem] text-muted-foreground mt-4">
            Template summary: Canvas {cw}×{ch} px. Back [{backZ.x},{backZ.y}] {backZ.width}×{backZ.height} · Spine [
            {spineZ.x},{spineZ.y}] {spineZ.width}×{spineZ.height} · Front [{frontZ.x},{frontZ.y}] {frontZ.width}×
            {frontZ.height}
          </p>
        </>
      )}

      <Link href={`/projects/${projectId}/cover/paperback/back-export`} className="mt-8 inline-block text-sm text-accent underline">
        Back exports
      </Link>
    </CoverLayout>
  );
}
