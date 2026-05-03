'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CoverLayout } from '@/components/layout';
import { Button, Textarea } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import { useGenerate } from '@/hooks/useGenerate';
import { getEffectiveModelForStage } from '@/lib/data/models';
import {
  assembleCanonForCoverBrief,
  safeParseCoverBrief,
} from '@/lib/cover/assembleCanonForCover';
import type { StoryBibleDocument } from '@/types';
import { parseStoryBible } from '@/lib/generation/schemas';

export default function CoverBriefPage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const {
    project,
    documents,
    chapters,
    revisionTasks,
    loading,
    error,
    getDocumentByType,
    refresh,
    createDocument,
    updateDocument,
    approveDocument,
    getTotalWordCount,
  } = useProject(projectId ?? null);
  const { generate, isGenerating, error: generateError, clearError } = useGenerate();

  const storyDoc = projectId ? documents.find((d) => d.type === 'story-bible' && d.approved) : undefined;
  const briefDoc = projectId ? documents.find((d) => d.type === 'creative-brief' && d.approved) : undefined;
  const nicheDoc = getDocumentByType('niche');

  const canonUnlocked =
    !!(documents.some((d) => (d.type === 'story-bible' || d.type === 'creative-brief') && d.approved));

  const assembledPreview = useMemo(() => {
    if (!storyDoc || !project) return '';
    try {
      const sb = parseStoryBible(storyDoc.content);
      return assembleCanonForCoverBrief({
        genre: project.genre,
        niche: project.niche,
        microniche: project.microniche,
        title: project.title,
        wordCountApprox: getTotalWordCount(),
        storyBible: sb as unknown as StoryBibleDocument,
        storyBibleDocumentId: storyDoc.id,
        creativeBriefContent: briefDoc?.content ?? null,
        creativeBriefDocumentId: briefDoc?.id ?? null,
        nicheDocContent: nicheDoc?.content ?? null,
      });
    } catch {
      return '';
    }
  }, [storyDoc, briefDoc, nicheDoc, project, getTotalWordCount]);

  const latestCoverBrief = useMemo(() => {
    const list = documents.filter((d) => d.type === 'cover-brief');
    if (list.length === 0) return null;
    return list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  }, [documents]);

  const [briefJson, setBriefJson] = useState('');
  const [assembledEdit, setAssembledEdit] = useState('');

  useEffect(() => {
    setAssembledEdit(assembledPreview);
  }, [assembledPreview]);

  useEffect(() => {
    if (latestCoverBrief?.content) {
      setBriefJson(latestCoverBrief.content);
    }
  }, [latestCoverBrief]);

  const persistBrief = useCallback(async (): Promise<string | null> => {
    if (!projectId || !briefJson.trim()) return null;
    const content = briefJson.trim();
    if (latestCoverBrief) {
      await updateDocument(latestCoverBrief.id, {
        content,
        version: latestCoverBrief.version + 1,
      });
      return latestCoverBrief.id;
    }
    return createDocument({
      projectId,
      type: 'cover-brief',
      content,
      version: 1,
      approved: false,
    });
  }, [projectId, briefJson, latestCoverBrief, createDocument, updateDocument]);

  const handleSave = useCallback(async () => {
    await persistBrief();
    await refresh?.();
  }, [persistBrief, refresh]);

  const handleApproveBrief = useCallback(async () => {
    const id = await persistBrief();
    if (!id) return;
    await approveDocument(id);
    await refresh?.();
  }, [persistBrief, approveDocument, refresh]);

  const handleGenerate = useCallback(async () => {
    if (!project || !storyDoc?.content) return;
    clearError();
    const assembled = assembledEdit.trim() || assembledPreview;
    const model = getEffectiveModelForStage('cover-brief');
    try {
      const result = await generate(
        'cover-brief',
        { assembledCanon: assembled },
        { model: model.id, projectId, usageSource: 'manual-stage' }
      );
      setBriefJson(result.content);
      await refresh?.();
    } catch {
      // surfaced in generateError
    }
  }, [project, storyDoc, assembledEdit, assembledPreview, generate, clearError, projectId, refresh]);

  if (!projectId) return null;

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground">Loading...</div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-red-600">{error}</p>
        <Link href={`/projects/${projectId}`} className="text-sm underline">Back</Link>
      </div>
    );
  }

  if (!canonUnlocked || !storyDoc) {
    return (
      <CoverLayout
        projectId={projectId}
        title="Cover Brief"
        modelStage="cover-brief"
        project={project}
        documents={documents}
        chapters={chapters ?? []}
        revisionTasks={revisionTasks ?? []}
        section="front"
      >
        <p className="text-muted-foreground">
          Approve your Story Bible (or Creative Brief) first to unlock cover generation.
        </p>
        <Link href={`/projects/${projectId}/stage/story-bible`} className="text-accent underline mt-4 inline-block">
          Go to Story Bible
        </Link>
      </CoverLayout>
    );
  }

  const parsedBrief = briefJson.trim() ? safeParseCoverBrief(briefJson) : null;

  return (
    <CoverLayout
      projectId={projectId}
      title="Cover Brief"
      modelStage="cover-brief"
      project={project}
      documents={documents}
      chapters={chapters ?? []}
      revisionTasks={revisionTasks ?? []}
      section="front"
    >
      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          Generate a structured visual-direction JSON brief from canon. Edit fields, save, then approve to continue to
          archetype selection.
        </p>

        {generateError && (
          <div className="p-3 rounded-md bg-red-950/30 text-red-300 text-sm">{generateError}</div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Canon inputs (assembled)</h3>
            <p className="text-xs text-muted-foreground">
              Editable reference block sent as “SOURCE MATERIAL” for the brief model.
            </p>
            <Textarea value={assembledEdit} onChange={(e) => setAssembledEdit(e.target.value)} rows={22} />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Cover brief JSON</h3>
            <Textarea value={briefJson} onChange={(e) => setBriefJson(e.target.value)} rows={22} className="font-mono text-xs" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Button type="button" onClick={() => void handleGenerate()} disabled={isGenerating}>
            {briefJson.trim() ? 'Regenerate brief' : 'Generate cover brief'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => void handleSave()} disabled={!briefJson.trim()}>
            Save draft
          </Button>
          <Button type="button" variant="secondary" onClick={() => void handleApproveBrief()} disabled={!parsedBrief}>
            Approve brief
          </Button>
          {isGenerating && <span className="text-xs text-muted-foreground">Generating…</span>}
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-foreground mb-2">What the AI sees</summary>
          <pre className="p-4 rounded-lg bg-muted/40 text-xs overflow-auto max-h-80">{assembledEdit}</pre>
        </details>

        {parsedBrief?.recommendedArchetypes?.length ? (
          <p className="text-xs text-muted-foreground">
            Recommended archetypes:{' '}
            {parsedBrief.recommendedArchetypes.map((x) => x.archetypeId).join(', ')} —{' '}
            <Link href={`/projects/${projectId}/cover/front/archetype`} className="text-accent underline">
              Continue to archetype selection
            </Link>
          </p>
        ) : null}

        {latestCoverBrief?.approved && (
          <p className="text-sm text-green-700 dark:text-green-400">Brief approved.</p>
        )}
      </div>
    </CoverLayout>
  );
}
