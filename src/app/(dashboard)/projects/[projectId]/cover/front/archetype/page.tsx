'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CoverLayout } from '@/components/layout/CoverLayout';
import { Button } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import { archetypesForGenreRows, type CoverArchetypeId } from '@/lib/prompts/covers';
import { DEFAULT_KDP_TRIM_SIZE_ID, KDP_TRIM_SIZES, getKdpTrimSizeById } from '@/lib/cover/kdpTrimSizes';
import { cn } from '@/lib/utils';

type CoverJobStatus =
  | 'queued'
  | 'running_front'
  | 'running_back'
  | 'running_wrap'
  | 'finalizing'
  | 'succeeded'
  | 'partially_succeeded'
  | 'failed';

type CoverJobResponse = {
  id: string;
  status: CoverJobStatus;
  progressStage: string;
  error: string | null;
  result: {
    frontDocumentId?: string;
    backDocumentId?: string;
    wrapDocumentId?: string;
    resolvedCanvasWidth?: number;
    resolvedCanvasHeight?: number;
    resolvedSizingSource?: 'uploaded-template' | 'trim-size-estimate' | 'fallback-default';
    error?: string;
  } | null;
};

export default function CoverArchetypePage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const { project, documents, chapters, revisionTasks, loading, error, refresh } = useProject(projectId ?? null);

  const { recommended, rest } = useMemo(
    () => archetypesForGenreRows(project?.genre ?? 'general', project?.niche),
    [project?.genre, project?.niche]
  );

  const [selectedId, setSelectedId] = useState<CoverArchetypeId | null>(null);
  const [authorName, setAuthorName] = useState('');
  const [trimSizeId, setTrimSizeId] = useState(DEFAULT_KDP_TRIM_SIZE_ID);
  const [templateUpload, setTemplateUpload] = useState<{ mimeType: string; base64Data: string; filename: string } | null>(null);
  const [step, setStep] = useState<'inputs' | 'generate' | 'review'>('inputs');
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<CoverJobResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'front' | 'back' | 'wrap' | 'spine'>('front');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const refreshRef = useRef(refresh);

  const hasAmazonDescription = !!project?.amazonDescription?.trim();
  const canGenerate = !!selectedId && !!authorName.trim() && hasAmazonDescription && !!project?.title?.trim() && !!trimSizeId;
  const rows = [...recommended, ...rest];
  const uniqueRows = rows.filter((row, idx) => rows.findIndex((x) => x.id === row.id) === idx);
  const trim = getKdpTrimSizeById(trimSizeId);

  useEffect(() => {
    if (!project) return;
    if (project.authorName?.trim()) setAuthorName(project.authorName);
    if (project.coverTrimSizeId?.trim()) setTrimSizeId(project.coverTrimSizeId);
  }, [project]);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!jobId) {
      setElapsedSec(0);
      return;
    }
    const startedAt = Date.now();
    setElapsedSec(0);
    const tickId = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(tickId);
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();
    const MAX_MS = 6 * 60 * 1000;
    const nextDelayMs = (sinceStartMs: number): number => {
      if (sinceStartMs < 30_000) return 2_000;
      if (sinceStartMs < 90_000) return 5_000;
      return 10_000;
    };
    const poll = async () => {
      if (stop) return;
      const res = await fetch(`/api/cover/generate-all/${jobId}`, { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as CoverJobResponse & { error?: string };
      if (!res.ok) {
        setErrorText(data.error || 'Failed to fetch job status');
        return;
      }
      if (stop) return;
      setJob(data);
      if (data.status === 'succeeded' || data.status === 'partially_succeeded' || data.status === 'failed') {
        await refreshRef.current?.();
        setStep(data.status === 'failed' ? 'generate' : 'review');
        return;
      }
      const sinceStart = Date.now() - startedAt;
      if (sinceStart > MAX_MS) {
        setErrorText('Generation is taking too long. Please retry.');
        setStep('inputs');
        return;
      }
      timer = window.setTimeout(poll, nextDelayMs(sinceStart));
    };
    void poll();
    return () => {
      stop = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [jobId]);

  if (!projectId) return null;
  if (loading || !project) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  async function onPickTemplate(file: File | null) {
    if (!file) {
      setTemplateUpload(null);
      return;
    }
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowed.includes(file.type)) {
      setErrorText('Template must be PDF, PNG, or JPG.');
      return;
    }
    const data = await readFileAsDataUrl(file);
    const comma = data.indexOf(',');
    const b64 = comma >= 0 ? data.slice(comma + 1) : data;
    setTemplateUpload({
      mimeType: file.type || 'application/octet-stream',
      base64Data: b64,
      filename: file.name,
    });
  }

  async function createJob() {
    if (!projectId || !canGenerate || !selectedId) return;
    setErrorText(null);
    setJob(null);
    setStep('generate');
    try {
      const response = await fetch('/api/cover/generate-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          archetypeId: selectedId,
          authorName: authorName.trim(),
          trimSizeId,
          templateUpload: templateUpload
            ? { mimeType: templateUpload.mimeType, base64Data: templateUpload.base64Data }
            : undefined,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { jobId?: string; error?: string };
      if (!response.ok) {
        throw new Error(data?.error || 'Cover generation failed.');
      }
      if (!data.jobId) throw new Error('Job creation failed.');
      setJobId(data.jobId);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : 'Cover generation failed.');
      setStep('inputs');
    }
  }

  const frontDoc = job?.result?.frontDocumentId
    ? documents.find((d) => d.id === job.result?.frontDocumentId)
    : null;
  const backDoc = job?.result?.backDocumentId
    ? documents.find((d) => d.id === job.result?.backDocumentId)
    : null;
  const frontImage = safeImageB64(frontDoc?.content);
  const backImage = safeImageB64(backDoc?.content);

  return (
    <CoverLayout
      projectId={projectId}
      section="front"
      title="Design"
      project={project}
      documents={documents}
      chapters={chapters ?? []}
      revisionTasks={revisionTasks ?? []}
    >
      <div className="mb-6 flex items-center gap-2 text-xs">
        <Badge active={step === 'inputs'} done={step !== 'inputs'}>1. Inputs</Badge>
        <Badge active={step === 'generate'} done={step === 'review'}>2. Generate</Badge>
        <Badge active={step === 'review'} done={false}>3. Review & Export</Badge>
      </div>

      {step === 'inputs' && (
        <>
          <p className="text-sm text-muted-foreground mb-6">
            Select one archetype, enter author name, choose KDP trim size, optionally upload a template, then generate
            front, back, and wraparound in one run.
          </p>

          {!project.title?.trim() && (
            <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              Title is missing. Set your title first in the Title stage.
            </div>
          )}
          {!hasAmazonDescription && (
            <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              Amazon description is missing. Generate or write it in Marketing before running covers.
              <div className="mt-2">
                <Link className="underline text-accent" href={`/projects/${projectId}/marketing/amazon-description`}>
                  Go to Amazon Description
                </Link>
              </div>
            </div>
          )}

          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {uniqueRows.map((a) => {
              const active = selectedId === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedId(a.id)}
                  className={cn(
                    'text-left rounded-lg border border-border p-3 transition-colors',
                    active ? 'bg-accent/[0.08] ring-1 ring-accent/25' : 'hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold">{a.name}</span>
                    {active && <span className="text-xs text-accent">Selected</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{a.primaryGenres.join(' · ')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Thumbnail strength: {a.thumbnailStrength}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{a.description}</p>
                </button>
              );
            })}
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium">Author name</label>
            <input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder={project.authorName || 'Author Name'}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium">Book trim size (KDP)</label>
            <select
              value={trimSizeId}
              onChange={(e) => setTrimSizeId(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            >
              {KDP_TRIM_SIZES.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6 rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            <p>Selected trim size drives baseline wrap dimensions.</p>
            <p>If template is uploaded, template dimensions override trim-size estimate.</p>
            <p className="mt-1">Current selection: {trim?.label || trimSizeId}</p>
          </div>

          <div className="mb-6">
            <label className="mb-1 block text-xs font-medium">Amazon template (optional: PDF/PNG/JPG)</label>
            <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => void onPickTemplate(e.target.files?.[0] ?? null)} />
            <p className="mt-1 text-xs text-muted-foreground">
              {templateUpload
                ? `Using template: ${templateUpload.filename} (${templateUpload.mimeType})`
                : 'No template uploaded. Wraparound will use trim-size estimated dimensions.'}
            </p>
          </div>

          {errorText && <div className="mb-4 rounded-md bg-red-950/40 p-3 text-sm text-red-200">{errorText}</div>}
          <Button type="button" disabled={!canGenerate} onClick={() => void createJob()}>
            Generate front, back, and wraparound
          </Button>
        </>
      )}

      {step === 'generate' && (() => {
        const progress = describeJobProgress(job, elapsedSec);
        return (
          <div className="rounded-md border border-border bg-muted/20 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Generating covers</h3>
              <span className="text-xs text-muted-foreground">
                {formatDuration(elapsedSec)} elapsed
                {progress.remainingSec != null && ` • ~${formatDuration(progress.remainingSec)} remaining`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{progress.label}</p>
            <div className="h-2 w-full rounded bg-muted overflow-hidden">
              <div
                className="h-full bg-accent transition-[width] duration-700 ease-out"
                style={{ width: `${Math.round(progress.fraction * 100)}%` }}
              />
            </div>
            <p className="mt-3 text-[0.65rem] text-muted-foreground">
              OpenAI image rendering is the bottleneck (front + back run in parallel). Typical end‑to‑end: 3–4 min.
            </p>
            {job?.error && <p className="mt-3 text-sm text-red-500">{job.error}</p>}
            <div className="mt-4 flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep('inputs')}>
                Back to inputs
              </Button>
            </div>
          </div>
        );
      })()}

      {step === 'review' && (
        <div className="mt-2">
          <div className="mb-4 flex gap-2">
            {(['front', 'back', 'wrap', 'spine'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'rounded px-3 py-1 text-xs border border-border',
                  activeTab === tab ? 'bg-accent/20 text-foreground' : 'text-muted-foreground'
                )}
              >
                {tab === 'front' ? 'Front' : tab === 'back' ? 'Back' : tab === 'wrap' ? 'Full Wrap' : 'Spine'}
              </button>
            ))}
          </div>
          {job?.result?.resolvedCanvasWidth && job?.result?.resolvedCanvasHeight && (
            <p className="mb-3 text-xs text-muted-foreground">
              Resolved size: {job.result.resolvedCanvasWidth}x{job.result.resolvedCanvasHeight} px ({job.result.resolvedSizingSource})
            </p>
          )}

          {activeTab === 'front' && frontImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="max-w-sm rounded border border-border" src={`data:image/png;base64,${frontImage}`} alt="Front cover" />
          )}
          {activeTab === 'back' && backImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="max-w-sm rounded border border-border" src={`data:image/png;base64,${backImage}`} alt="Back cover" />
          )}
          {activeTab === 'wrap' && (
            <div className="text-sm text-muted-foreground">
              Use export actions below to generate full wrap PDF/PNG from the saved run.
            </div>
          )}
          {activeTab === 'spine' && (
            <div className="text-sm text-muted-foreground">
              Spine text uses title + author and adapts to resolved wrap dimensions.
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <a href={`/api/cover/digital-export?projectId=${projectId}&format=kdp-front`} className="text-sm underline text-accent">
              Download front PNG
            </a>
            <a href={`/api/cover/back-digital-export?projectId=${projectId}&format=kdp-back`} className="text-sm underline text-accent">
              Download back PNG
            </a>
            <Link href={`/projects/${projectId}/cover/paperback/full-wrap`} className="text-sm underline text-accent">
              Open advanced wrap export
            </Link>
            {jobId && (
              <button
                type="button"
                className="text-sm underline text-accent bg-transparent border-none p-0"
                onClick={async () => {
                  const res = await fetch(`/api/cover/generate-all/${jobId}/retry-wrap`, { method: 'POST' });
                  if (res.ok) {
                    setStep('generate');
                    setErrorText(null);
                  } else {
                    const data = await res.json().catch(() => ({}));
                    setErrorText(data.error || 'Retry wrap failed');
                  }
                }}
              >
                Retry wrap
              </button>
            )}
            <Button type="button" variant="secondary" onClick={() => setStep('inputs')}>
              Regenerate
            </Button>
          </div>
          {errorText && <div className="mt-4 rounded-md bg-red-950/40 p-3 text-sm text-red-200">{errorText}</div>}
        </div>
      )}
    </CoverLayout>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === 'string' ? r.result : '');
    r.onerror = () => reject(new Error('Unable to read uploaded template file.'));
    r.readAsDataURL(file);
  });
}

function safeImageB64(content?: string): string | null {
  if (!content) return null;
  try {
    const payload = JSON.parse(content) as { imageData?: string };
    return payload.imageData ?? null;
  } catch {
    return null;
  }
}

/**
 * Estimated total seconds for the typical happy path: ~3 min for the parallel
 * front+back OpenAI image phase, ~30 s for wrap composite, plus a small buffer.
 */
const ESTIMATED_TOTAL_SEC = 210;

/** Visual-only progress mapping. We over-estimate fractions a touch so the
 * bar feels alive even when OpenAI sits silent for ~2 min. */
const STAGE_FRACTIONS: Record<string, number> = {
  queued: 0.02,
  'running_images:openai_generate': 0.1,
  'running_images:save_documents': 0.7,
  'running_front:init': 0.05,
  'running_front:openai_generate': 0.1,
  'running_back:init': 0.55,
  'running_wrap:init': 0.78,
  'running_wrap:retry_init': 0.6,
  'finalizing:update_project': 0.95,
  succeeded: 1,
};

const STAGE_LABELS: Record<string, string> = {
  queued: 'Queuing job…',
  'running_images:openai_generate':
    'Rendering front + back covers in parallel (OpenAI gpt-image-2, ~2–3 min)…',
  'running_images:save_documents': 'Saving generated images…',
  'running_front:init': 'Preparing front cover prompt…',
  'running_front:openai_generate': 'Rendering front cover (OpenAI gpt-image-2)…',
  'running_back:init': 'Preparing back cover prompt…',
  'running_back:openai_generate': 'Rendering back cover (OpenAI gpt-image-2)…',
  'running_wrap:init': 'Compositing full wraparound (spine + bleed)…',
  'running_wrap:retry_init': 'Re-running wraparound composite…',
  'finalizing:update_project': 'Finalizing project record…',
  succeeded: 'Done.',
  failed: 'Generation failed.',
  partially_succeeded: 'Generated front + back, but wrap composite failed.',
};

function describeJobProgress(
  job: CoverJobResponse | null,
  elapsedSec: number
): { label: string; fraction: number; remainingSec: number | null } {
  if (!job) {
    return {
      label: STAGE_LABELS.queued,
      fraction: Math.min(0.05 + elapsedSec / 200, 0.1),
      remainingSec: Math.max(ESTIMATED_TOTAL_SEC - elapsedSec, 30),
    };
  }
  const stage = job.progressStage;
  const baseFraction = STAGE_FRACTIONS[stage] ?? STAGE_FRACTIONS[job.status] ?? 0.5;
  // Inside the long parallel image phase, slowly grow the bar from 10% → 65%
  // over the elapsed time so users see motion even with no stage update.
  let fraction = baseFraction;
  if (stage === 'running_images:openai_generate' || stage === 'running_front:openai_generate' || stage === 'running_back:openai_generate') {
    const longPhaseProgress = Math.min(elapsedSec / 180, 1);
    fraction = 0.1 + longPhaseProgress * 0.55;
  }
  const remainingSec =
    job.status === 'succeeded' || job.status === 'failed' || job.status === 'partially_succeeded'
      ? null
      : Math.max(ESTIMATED_TOTAL_SEC - elapsedSec, 15);
  const label = STAGE_LABELS[stage] ?? STAGE_LABELS[job.status] ?? `Status: ${stage}`;
  return { label, fraction: Math.min(Math.max(fraction, 0), 1), remainingSec };
}

function formatDuration(totalSec: number): string {
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function Badge({ children, active, done }: { children: string; active: boolean; done: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full border px-2 py-1',
        active ? 'border-accent text-foreground bg-accent/15' : done ? 'border-green-500 text-green-600' : 'border-border text-muted-foreground'
      )}
    >
      {children}
    </span>
  );
}
