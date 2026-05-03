'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { CoverLayout } from '@/components/layout/CoverLayout';
import { Button } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import { buildBackCoverImagePrompt, COVER_ARCHETYPES } from '@/lib/prompts';
import type {
  BackCoverBriefDocument,
  CoverBriefDocument,
  CoverImagePayload,
  ProjectDocument,
} from '@/types';

function latestApprovedByType(documents: ProjectDocument[], type: ProjectDocument['type']): ProjectDocument | undefined {
  const row = [...documents.filter((d) => d.type === type && d.approved)].sort(
    (a, b) => (b.version ?? 0) - (a.version ?? 0)
  )[0];
  return row;
}

export default function BackCoverGeneratePage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const { project, documents, chapters, revisionTasks, loading, error, createDocument, refresh, updateProject } =
    useProject(projectId ?? null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const approvedCoverBrief = latestApprovedByType(documents, 'cover-brief');
  const approvedBackBrief = latestApprovedByType(documents, 'back-cover-brief');

  const frontApprovedDoc = useMemo(() => {
    const fid = project?.approvedCoverImageId;
    if (!fid) return undefined;
    return documents.find((d) => d.id === fid);
  }, [documents, project?.approvedCoverImageId]);

  const frontPayload = useMemo((): CoverImagePayload | undefined => {
    if (!frontApprovedDoc?.content) return undefined;
    try {
      const p = JSON.parse(frontApprovedDoc.content) as CoverImagePayload;
      return p.surface === 'front' ? p : undefined;
    } catch {
      return undefined;
    }
  }, [frontApprovedDoc?.content]);

  const ready = !!(approvedCoverBrief && approvedBackBrief && frontPayload && project?.approvedCoverImageId);

  const run = useCallback(async () => {
    if (!projectId || !project || !ready || !approvedCoverBrief?.content || !approvedBackBrief?.content) return;
    setErr(null);
    setBusy(true);
    try {
      let cov: CoverBriefDocument;
      let backBrief: BackCoverBriefDocument;
      try {
        cov = JSON.parse(approvedCoverBrief.content) as CoverBriefDocument;
        backBrief = JSON.parse(approvedBackBrief.content) as BackCoverBriefDocument;
      } catch {
        throw new Error('Could not parse cover brief or back cover brief JSON.');
      }

      const archMeta = COVER_ARCHETYPES.find((a) => a.id === frontPayload!.archetypeId);
      const archetypeEcho =
        `${frontPayload!.archetypeId}${archMeta ? ` (${archMeta.name})` : ''}: ` +
        frontPayload!.promptUsed.slice(0, 400).trim();

      const prompt = buildBackCoverImagePrompt({
        genre: project.genre,
        paletteDirection: cov.paletteDirection,
        moodKeywords: cov.moodKeywords?.length ? cov.moodKeywords : ['commercial fiction'],
        backBrief,
        archetypeEcho,
      });

      const runId = crypto.randomUUID();
      await updateProject({ paperbackGenerationStatus: 'in-progress' });

      const res = await fetch('/api/cover/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, n: 4 }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === 'string' ? j.error : 'Image API failed');
      }
      const data = (await res.json()) as { images: string[] };
      let i = 0;
      for (const b64 of data.images) {
        const payload: CoverImagePayload = {
          schemaVersion: 1,
          runId,
          archetypeId: frontPayload!.archetypeId,
          highClickEnabled: false,
          promptUsed: prompt,
          variantIndex: i,
          parentImageId: null,
          refinementRequest: null,
          version: 1,
          surface: 'back',
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

      setDone(true);
      await refresh?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  }, [
    approvedBackBrief?.content,
    approvedCoverBrief?.content,
    createDocument,
    frontPayload,
    project,
    projectId,
    ready,
    refresh,
    updateProject,
  ]);

  if (!projectId) return null;
  if (loading || !project) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  if (!ready) {
    return (
      <CoverLayout projectId={projectId} section="paperback" title="Back cover generation" project={project} documents={documents}>
        <p className="text-muted-foreground mb-4">
          You need an approved cover brief, an approved front cover image, and an approved back-cover brief before
          generating back-panel art.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link className="text-accent underline" href={`/projects/${projectId}/cover/front/refine`}>
            Front refinement
          </Link>
          <Link className="text-accent underline" href={`/projects/${projectId}/cover/paperback/back-brief`}>
            Back cover brief
          </Link>
        </div>
      </CoverLayout>
    );
  }

  return (
    <CoverLayout
      projectId={projectId}
      section="paperback"
      title="Back cover generation"
      project={project}
      documents={documents}
      chapters={chapters ?? []}
      revisionTasks={revisionTasks ?? []}
    >
      <p className="text-sm text-muted-foreground mb-6">
        Uses the same portrait image model as the front cover. Prompt is assembled from both briefs plus the approved
        front variant’s lineage.
      </p>
      {err && <div className="mb-4 rounded-md bg-red-950/40 p-3 text-sm text-red-200">{err}</div>}
      {done && (
        <p className="mb-4 text-sm text-green-600">
          Saved back-panel variants. Continue to refinement to approve one for the full-wrap composite.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => void run()} disabled={busy}>
          {busy ? 'Generating…' : 'Run generation (4 variants)'}
        </Button>
        <Link href={`/projects/${projectId}/cover/paperback/back-brief`} className="text-sm text-muted-foreground underline self-center">
          Back to brief
        </Link>
        <Link href={`/projects/${projectId}/cover/paperback/back-refine`} className="text-sm text-accent underline self-center">
          Refinement →
        </Link>
      </div>
    </CoverLayout>
  );
}
