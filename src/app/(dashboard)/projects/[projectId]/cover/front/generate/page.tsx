'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { CoverLayout } from '@/components/layout/CoverLayout';
import { Button } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import type { CoverArchetypeId } from '@/lib/prompts/covers';
import type { CoverImagePayload } from '@/types';
import { isCoverBriefV2 } from '@/types';
import { safeParseCoverBrief } from '@/lib/cover/assembleCanonForCover';

const storageKey = (pid: string) => `storyforge.cover.selection.${pid}`;

interface SelectionPersist {
  ids: CoverArchetypeId[];
  highClick: Partial<Record<CoverArchetypeId, boolean>>;
  prompts?: Partial<Record<CoverArchetypeId, string>>;
}

function approvedBriefPromptFor(documents: { type: string; approved: boolean; content: string }[], arch: string): string | null {
  const hit = documents.find((d) => {
    if (d.type !== 'cover-brief' || !d.approved) return false;
    const b = safeParseCoverBrief(d.content);
    return !!(b && isCoverBriefV2(b) && b.archetypeId === arch && b.resolvedPrompt?.trim());
  });
  if (!hit?.content) return null;
  const b = safeParseCoverBrief(hit.content);
  return b && isCoverBriefV2(b) ? b.resolvedPrompt : null;
}

export default function CoverGeneratePage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const { project, documents, chapters, revisionTasks, loading, error, updateDocument, refresh, updateProject } =
    useProject(projectId ?? null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [lastErrors, setLastErrors] = useState<Record<string, string>>({});

  const fronts = useMemo(() => {
    return documents
      .filter((d) => d.type === 'cover-image')
      .map((d) => {
        try {
          const p = JSON.parse(d.content) as CoverImagePayload;
          return p.surface === 'front' ? { docId: d.id, payload: p } : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as { docId: string; payload: CoverImagePayload }[];
  }, [documents]);

  const byArchetype = useMemo(() => {
    const m = new Map<string, { docId: string; payload: CoverImagePayload }[]>();
    for (const row of fronts) {
      const id = row.payload.archetypeId;
      if (!m.has(id)) m.set(id, []);
      m.get(id)!.push(row);
    }
    for (const v of m.values()) {
      v.sort((a, b) => {
        const t = Date.parse(a.payload.generatedAt) - Date.parse(b.payload.generatedAt);
        return Number.isFinite(t) ? t : a.payload.variantIndex - b.payload.variantIndex;
      });
    }
    return m;
  }, [fronts]);

  const run = useCallback(async () => {
    if (!projectId || !project) return;
    setErr(null);
    setLastErrors({});
    setBusy(true);
    try {
      const raw = sessionStorage.getItem(storageKey(projectId));
      if (!raw) throw new Error('No archetype selection found — go back to Archetype Selection.');
      const sel = JSON.parse(raw) as SelectionPersist;
      if (!sel.ids?.length) throw new Error('No archetypes selected.');

      const archetypesPayload: Array<{ archetypeId: string; prompt: string; highClickEnabled: boolean }> = [];
      for (const arch of sel.ids) {
        let prompt =
          approvedBriefPromptFor(documents, arch)?.trim()
          ?? sel.prompts?.[arch]?.trim()
          ?? null;
        if (!prompt?.trim()) {
          throw new Error(
            `No approved layered brief found for ${arch}. Approve a cover brief first, or return to archetype flow for legacy prompts.`
          );
        }
        archetypesPayload.push({
          archetypeId: arch,
          prompt,
          highClickEnabled: !!sel.highClick?.[arch],
        });
      }

      const estimatedCalls = archetypesPayload.length;
      const n = 4;
      if (
        typeof window !== 'undefined' &&
        !window.confirm(
          `This will run about ${estimatedCalls} cover image generation call(s), ${n} images each (~${estimatedCalls * n} PNGs total). Uses OpenAI gpt-image-2 billed to your configured key. Continue?`
        )
      ) {
        setBusy(false);
        return;
      }

      const runId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;

      await updateProject({ coverGenerationStatus: 'in-progress' });

      const res = await fetch('/api/cover/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          runId,
          coverSide: 'front',
          archetypes: archetypesPayload,
          n,
          quality: 'high',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Image API failed');

      const errs: Record<string, string> = {};
      const results = data.results as Array<{ archetypeId: string; error?: string }>;
      if (Array.isArray(results)) {
        for (const r of results) {
          if (r.error) errs[r.archetypeId] = r.error;
        }
      }
      setLastErrors(errs);

      setDone(true);
      await refresh?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  }, [projectId, project, documents, refresh, updateProject]);

  const setStatus = async (docId: string, status: CoverImagePayload['status']) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc?.content) return;
    try {
      const payload = JSON.parse(doc.content) as CoverImagePayload;
      await updateDocument(docId, {
        content: JSON.stringify({ ...payload, status }),
        version: doc.version + 1,
      });
      await refresh?.();
    } catch {
      /* ignore */
    }
  };

  if (!projectId) return null;
  if (loading || !project) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <CoverLayout
      projectId={projectId}
      section="front"
      title="Generation"
      project={project}
      documents={documents}
      chapters={chapters ?? []}
      revisionTasks={revisionTasks ?? []}
    >
      <p className="text-sm text-muted-foreground mb-4">
        Parallel <code className="text-xs">gpt-image-2</code> calls via{' '}
        <code className="text-xs">POST /api/cover/generate</code> (1024×1536 portrait, four variants per archetype).
      </p>
      {Object.keys(lastErrors).length > 0 && (
        <ul className="mb-4 text-sm text-amber-700 dark:text-amber-400 list-disc pl-6">
          {Object.entries(lastErrors).map(([k, v]) => (
            <li key={k}>
              {k}: {v}
            </li>
          ))}
        </ul>
      )}
      {err && <div className="mb-4 rounded-md bg-red-950/40 p-3 text-sm text-red-200">{err}</div>}
      {done && !err && (
        <p className="mb-4 text-sm text-green-600 dark:text-green-400">
          Generation finished. Saved as <code className="text-xs">cover-image</code> documents. Discard or refine in the
          grid below.
        </p>
      )}

      {Array.from(byArchetype.entries()).map(([arch, variants]) => (
        <div key={arch} className="mb-10 border-b border-border pb-8">
          <h3 className="text-sm font-semibold mb-2">
            {arch}{' '}
            <span className="font-normal text-muted-foreground">
              ({variants[0]?.payload.highClickEnabled ? 'high-click' : 'standard'})
            </span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:gap-4 gap-2">
            {variants
              .filter((v) => v.payload.status !== 'discarded')
              .map(({ docId, payload }) => (
                <div key={docId} className="rounded-lg border border-border overflow-hidden bg-muted/20">
                  {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URLs */}
                  <img
                    alt=""
                    className="w-full h-auto aspect-[1024/1536] object-cover"
                    src={`data:image/png;base64,${payload.imageData}`}
                  />
                  <div className="p-2 flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" className="h-8 text-xs" onClick={() => void setStatus(docId, 'candidate')}>
                      Candidate
                    </Button>
                    <Button type="button" variant="ghost" className="h-8 text-xs" onClick={() => void setStatus(docId, 'discarded')}>
                      Discard
                    </Button>
                  </div>
                  <details className="px-2 pb-2">
                    <summary className="text-[0.65rem] cursor-pointer text-muted-foreground">Prompt used</summary>
                    <pre className="text-[0.58rem] whitespace-pre-wrap break-words max-h-32 overflow-auto mt-1">{payload.promptUsed}</pre>
                  </details>
                </div>
              ))}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => void run()} disabled={busy}>
          {busy ? 'Generating…' : 'Run generation'}
        </Button>
        <Link
          href={`/projects/${projectId}/cover/front/brief`}
          className="text-sm text-muted-foreground underline self-center"
        >
          Cover brief
        </Link>
        <Link href={`/projects/${projectId}/cover/front/archetype`} className="text-sm text-muted-foreground underline self-center">
          Archetypes
        </Link>
        <Link href={`/projects/${projectId}/cover/front/refine`} className="text-sm text-accent underline self-center">
          Refinement
        </Link>
      </div>
    </CoverLayout>
  );
}
