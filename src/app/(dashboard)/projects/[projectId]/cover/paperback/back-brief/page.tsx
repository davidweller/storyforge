'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CoverLayout } from '@/components/layout/CoverLayout';
import { Button, Textarea } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import { useGenerate } from '@/hooks/useGenerate';
import { getEffectiveModelForStage } from '@/lib/data/models';
import type { ProjectDocument } from '@/types';

function latestApprovedByType(documents: ProjectDocument[], type: ProjectDocument['type']): ProjectDocument | undefined {
  const row = [...documents.filter((d) => d.type === type && d.approved)].sort(
    (a, b) => (b.version ?? 0) - (a.version ?? 0)
  )[0];
  return row;
}

export default function BackCoverBriefPage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const {
    project,
    documents,
    chapters,
    revisionTasks,
    loading,
    error,
    createDocument,
    updateDocument,
    approveDocument,
    refresh,
  } = useProject(projectId ?? null);
  const { generate, isGenerating, error: genErr, clearError } = useGenerate();

  const covBrief = latestApprovedByType(documents, 'cover-brief');
  const story = documents.find((d) => d.type === 'story-bible' && d.approved);
  const frontId = project?.approvedCoverImageId;

  const existing = [...documents.filter((d) => d.type === 'back-cover-brief')]
    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0];

  const [json, setJson] = useState('');

  useEffect(() => {
    if (existing?.content) setJson((prev) => (prev.trim() ? prev : existing.content));
  }, [existing?.content, existing?.id]);

  const ctx = useMemo(() => {
    if (!covBrief?.content || !frontId) return '';
    try {
      JSON.parse(covBrief.content);
    } catch {
      return '';
    }
    return [
      `FRONT COVER IMAGE DOC: ${frontId}`,
      `COVER BRIEF JSON:`,
      covBrief.content,
      story?.content ? `STORY BIBLE (extra context):\n${story.content}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }, [covBrief, frontId, story]);

  const persist = async (): Promise<string | null> => {
    if (!projectId || !json.trim()) return null;
    const content = json.trim();
    if (existing) {
      await updateDocument(existing.id, { content, version: existing.version + 1 });
      return existing.id;
    }
    return createDocument({ projectId, type: 'back-cover-brief', content, version: 1, approved: false });
  };

  const handleGen = async () => {
    clearError();
    const model = getEffectiveModelForStage('back-cover-brief');
    if (!ctx.trim() || !covBrief || !frontId) return;
    const res = await generate(
      'back-cover-brief',
      { assembledContext: ctx },
      { model: model.id, projectId, usageSource: 'manual-stage' }
    );
    setJson(res.content);
    await refresh?.();
  };

  const handleApprove = async () => {
    const id = await persist();
    if (id) await approveDocument(id);
    await refresh?.();
  };

  if (!projectId) return null;
  if (loading || !project) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  const ready = covBrief?.approved && frontId;

  if (!ready) {
    return (
      <CoverLayout
        projectId={projectId}
        section="paperback"
        title="Back cover brief"
        project={project}
        documents={documents}
      >
        <p className="text-muted-foreground mb-4">
          Approve your cover brief and your front cover image before generating a back-panel brief.
        </p>
        <Link className="text-accent underline" href={`/projects/${projectId}/cover/front/brief`}>
          Cover brief
        </Link>
      </CoverLayout>
    );
  }

  return (
    <CoverLayout
      projectId={projectId}
      section="paperback"
      title="Back cover brief"
      modelStage="back-cover-brief"
      project={project}
      documents={documents}
      chapters={chapters ?? []}
      revisionTasks={revisionTasks ?? []}
    >
      {genErr && <div className="mb-4 rounded-md bg-red-950/40 p-3 text-sm text-red-200">{genErr}</div>}
      <p className="mb-4 text-sm text-muted-foreground">
        JSON brief for image-only back-panel art. Derived from the approved front cover and cover brief.
      </p>
      <Textarea className="font-mono text-xs" rows={22} value={json || existing?.content || ''} onChange={(e) => setJson(e.target.value)} />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" disabled={isGenerating} onClick={() => void handleGen()}>
          {json.trim() ? 'Regenerate' : 'Generate back cover brief'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void persist().then(() => {
              refresh?.();
            });
          }}
        >
          Save
        </Button>
        <Button type="button" variant="secondary" onClick={() => void handleApprove()}>
          Approve
        </Button>
      </div>
      <Link href={`/projects/${projectId}/cover/paperback/back-generate`} className="mt-8 inline-block text-sm text-accent underline">
        Back cover generation →
      </Link>
    </CoverLayout>
  );
}
