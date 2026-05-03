'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CoverLayout } from '@/components/layout/CoverLayout';
import { Button, Input } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import {
  computePaperbackCanvas,
  KDP_TRIM_PRESETS,
  wordsPerPageForTrim,
  type KdpPaperType,
} from '@/lib/kdp/paperbackDimensions';
import type { PaperbackSpecPayload } from '@/types';

type TrimKey = keyof typeof KDP_TRIM_PRESETS;

const PAPER_OPTIONS: KdpPaperType[] = ['White 60lb', 'Cream 60lb', 'White 50lb (premium)', 'Cream 50lb (premium)'];

export default function PaperbackSpecPage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const {
    project,
    documents,
    chapters,
    revisionTasks,
    loading,
    error,
    getTotalWordCount,
    createDocument,
    updateDocument,
    refresh,
    getLatestDocumentByType,
  } = useProject(projectId ?? null);

  const existing = getLatestDocumentByType('paperback-spec');

  const [trimKey, setTrimKey] = useState<TrimKey>('6x9');
  const [paperType, setPaperType] = useState<KdpPaperType>('White 60lb');
  const [pageCount, setPageCount] = useState(300);

  const wc = getTotalWordCount();

  useEffect(() => {
    const wpp = wordsPerPageForTrim(trimKey);
    setPageCount(Math.max(24, Math.ceil(wc / wpp)));
  }, [trimKey, wc]);

  useEffect(() => {
    if (!existing?.content) return;
    try {
      const p = JSON.parse(existing.content) as PaperbackSpecPayload;
      setPageCount(p.pageCount);
      setPaperType(p.paperType as KdpPaperType);
      const key = p.trimPresetKey as TrimKey | undefined;
      if (key && key in KDP_TRIM_PRESETS) setTrimKey(key);
    } catch {
      /* ignore */
    }
  }, [existing]);

  const dims = useMemo(() => {
    const preset = KDP_TRIM_PRESETS[trimKey];
    return computePaperbackCanvas({
      trimWidthInches: preset.widthIn,
      trimHeightInches: preset.heightIn,
      pageCount,
      paperType,
    });
  }, [trimKey, pageCount, paperType]);

  const save = async () => {
    if (!projectId) return;
    const preset = KDP_TRIM_PRESETS[trimKey];
    const payload: PaperbackSpecPayload = {
      schemaVersion: 1,
      mode: 'calculated',
      trimWidthIn: preset.widthIn,
      trimHeightIn: preset.heightIn,
      paperType,
      pageCount,
      canvasWidthPx: dims.canvasWidthPx,
      canvasHeightPx: dims.canvasHeightPx,
      bleedPx: dims.bleedPx,
      frontPanelRect: dims.frontPanelRect,
      spineRect: dims.spineRect,
      backPanelRect: dims.backPanelRect,
      updatedAt: new Date().toISOString(),
      trimPresetKey: trimKey,
    };
    const json = JSON.stringify(payload, null, 2);
    if (existing) {
      await updateDocument(existing.id, { content: json, version: existing.version + 1 });
    } else {
      await createDocument({ projectId, type: 'paperback-spec', content: json, version: 1, approved: false });
    }
    await refresh?.();
  };

  if (!projectId) return null;
  if (loading || !project) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  const pub = project.approvedCoverImageId;

  return (
    <CoverLayout
      projectId={projectId}
      section="paperback"
      title="Paperback spec"
      project={project}
      documents={documents}
      chapters={chapters ?? []}
      revisionTasks={revisionTasks ?? []}
    >
      {!pub && <p className="mb-4 text-sm text-amber-600">Approve a front cover first for the full paperback branch.</p>}
      <div className="grid max-w-lg gap-4">
        <label className="text-sm">
          Trim size
          <select
            className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
            value={trimKey}
            onChange={(e) => setTrimKey(e.target.value as TrimKey)}
          >
            {(Object.keys(KDP_TRIM_PRESETS) as TrimKey[]).map((k) => (
              <option key={k} value={k}>
                {KDP_TRIM_PRESETS[k].label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Paper type
          <select
            className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
            value={paperType}
            onChange={(e) => setPaperType(e.target.value as KdpPaperType)}
          >
            {PAPER_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Page count
          <Input type="number" min={24} value={pageCount} onChange={(e) => setPageCount(Number(e.target.value))} />
        </label>
      </div>
      <pre className="mt-6 max-h-56 overflow-auto rounded-lg bg-muted/40 p-4 text-xs">
        {JSON.stringify(
          {
            canvasWidthPx: dims.canvasWidthPx,
            canvasHeightPx: dims.canvasHeightPx,
            spineWidthPx: dims.spineWidthPx,
            frontPanelRect: dims.frontPanelRect,
            spineRect: dims.spineRect,
            backPanelRect: dims.backPanelRect,
          },
          null,
          2
        )}
      </pre>
      <p className="mt-4 text-xs text-muted-foreground">
        Spine will be colour-filled only (no spine text). Barcode reserve is drawn at paperback export time.
      </p>
      <Button className="mt-6" type="button" onClick={() => void save()} disabled={!pub}>
        Save paperback spec
      </Button>
      {!pub ? null : (
        <Link href={`/projects/${projectId}/cover/paperback/back-brief`} className="mt-8 inline-block text-sm text-accent underline">
          Back cover brief →
        </Link>
      )}
    </CoverLayout>
  );
}
