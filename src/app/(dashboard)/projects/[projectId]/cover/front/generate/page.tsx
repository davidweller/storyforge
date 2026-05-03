'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { CoverLayout } from '@/components/layout/CoverLayout';
import { Button } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import type { CoverArchetypeId } from '@/lib/prompts/covers';
import type { CoverImagePayload } from '@/types';

const storageKey = (pid: string) => `storyforge.cover.selection.${pid}`;

interface SelectionPersist {
  ids: CoverArchetypeId[];
  highClick: Partial<Record<CoverArchetypeId, boolean>>;
  prompts: Partial<Record<CoverArchetypeId, string>>;
}

export default function CoverGeneratePage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const { project, documents, chapters, revisionTasks, loading, error, createDocument, refresh, updateProject } =
    useProject(projectId ?? null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const run = useCallback(async () => {
    if (!projectId || !project) return;
    setErr(null);
    setBusy(true);
    try {
      const raw = sessionStorage.getItem(storageKey(projectId));
      if (!raw) throw new Error('No archetype selection found — go back to Archetype Selection.');
      const sel = JSON.parse(raw) as SelectionPersist;
      if (!sel.ids?.length) throw new Error('No archetypes selected.');
      const runId = crypto.randomUUID();
      await updateProject({ coverGenerationStatus: 'in-progress' });

      for (const arch of sel.ids) {
        const prompt = sel.prompts?.[arch];
        if (!prompt?.trim()) continue;
        const res = await fetch('/api/cover/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, n: 4 }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `Image API failed for ${arch}`);
        }
        const data = (await res.json()) as { images: string[] };
        const hi = !!sel.highClick?.[arch];
        let i = 0;
        for (const b64 of data.images) {
          const payload: CoverImagePayload = {
            schemaVersion: 1,
            runId,
            archetypeId: arch,
            highClickEnabled: hi,
            promptUsed: prompt,
            variantIndex: i,
            parentImageId: null,
            refinementRequest: null,
            version: 1,
            surface: 'front',
            status: 'candidate',
            imageData: b64,
            generatedAt: new Date().toISOString(),
            refinementHistory: [],
          };
          await createDocument({
            projectId,
            type: 'cover-image',
            content: JSON.stringify(payload),
            version: 1,
            approved: false,
          });
          i += 1;
        }
      }
      setDone(true);
      await refresh?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  }, [projectId, project, createDocument, refresh, updateProject]);

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
      <p className="text-sm text-muted-foreground mb-6">
        Calls OpenAI <code className="text-xs">gpt-image-2</code> with portrait 1024×1536, high quality, four variants per archetype,
        sequentially.
      </p>
      {err && <div className="mb-4 rounded-md bg-red-950/40 p-3 text-sm text-red-200">{err}</div>}
      {done && (
        <p className="mb-4 text-sm text-green-600">
          Saved variants as <code className="text-xs">cover-image</code> documents. Continue to refinement to approve one.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => void run()} disabled={busy}>
          {busy ? 'Generating…' : 'Run generation'}
        </Button>
        <Link href={`/projects/${projectId}/cover/front/archetype`} className="text-sm text-muted-foreground underline self-center">
          Back to archetypes
        </Link>
        <Link href={`/projects/${projectId}/cover/front/refine`} className="text-sm text-accent underline self-center">
          Refinement
        </Link>
      </div>
    </CoverLayout>
  );
}
