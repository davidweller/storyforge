'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StageLayout } from '@/components/stages';
import { Button, Badge, Textarea, useToast } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import { useGenerate } from '@/hooks/useGenerate';
import { StoryBibleReadableView } from '@/components/canon/StoryBibleReadableView';
import { buildStoryBibleSourceRefs, getValidatedApprovedChapterOutlines, isCreativeBriefStale, isStoryBibleStale } from '@/lib/context/assembler';
import { parseStoryBible } from '@/lib/generation/schemas';

export default function StoryBibleStagePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const router = useRouter();
  const {
    project,
    documents,
    chapters,
    revisionTasks,
    loading,
    error,
    getApprovedChapterVersion,
    createDocument,
    updateDocument,
    approveDocument,
  } = useProject(projectId);
  const [storyBibleDraft, setStoryBibleDraft] = useState('');
  const [isCanonSaving, setIsCanonSaving] = useState(false);
  const { addToast } = useToast();
  const { generate, isGenerating: isGeneratingCanon } = useGenerate();

  const manualGenOpts = useMemo(
    () => ({ projectId, usageSource: 'manual-stage' as const }),
    [projectId]
  );

  const latestStoryBible = documents
    .filter((doc) => doc.type === 'story-bible')
    .sort((a, b) => b.version - a.version || b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  const approvedStoryBible = documents.find((doc) => doc.type === 'story-bible' && doc.approved);
  const latestCreativeBrief = documents
    .filter((doc) => doc.type === 'creative-brief')
    .sort((a, b) => b.version - a.version || b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  const approvedCreativeBrief = documents.find((doc) => doc.type === 'creative-brief' && doc.approved);
  const storyBibleStale = latestStoryBible ? isStoryBibleStale(latestStoryBible, documents) : true;
  const creativeBriefStale = latestCreativeBrief ? isCreativeBriefStale(latestCreativeBrief, approvedStoryBible ?? latestStoryBible) : true;

  const validatedOutlinesGate = useMemo(() => getValidatedApprovedChapterOutlines(documents), [documents]);
  const canGenerateStoryBible = validatedOutlinesGate.ok;

  const parsedReadable = useMemo(() => {
    try {
      if (!storyBibleDraft.trim()) return null;
      return parseStoryBible(storyBibleDraft).storyBible;
    } catch {
      return null;
    }
  }, [storyBibleDraft]);
  const storyBibleNeedsTropesRefresh =
    !!parsedReadable && (parsedReadable.schemaVersion < 2 || !('tropes' in parsedReadable));

  useEffect(() => {
    setStoryBibleDraft(latestStoryBible?.content ?? '');
  }, [latestStoryBible?.id, latestStoryBible?.content]);

  const approvedChapterIds = useMemo(() => {
    const s = new Set<string>();
    for (const chapter of chapters) {
      if (getApprovedChapterVersion(chapter.id)) s.add(chapter.id);
    }
    return s;
  }, [chapters, getApprovedChapterVersion]);

  const generateStoryBible = useCallback(async () => {
    if (!project) return;
    const outlineGate = getValidatedApprovedChapterOutlines(documents);
    if (!outlineGate.ok) {
      addToast({ type: 'error', message: outlineGate.reason });
      return;
    }
    const derivedFrom = buildStoryBibleSourceRefs(documents);
    if (derivedFrom.length === 0) {
      addToast({ type: 'error', message: 'Approve planning documents before generating a Story Bible.' });
      return;
    }
    setIsCanonSaving(true);
    try {
      const byType = (type: string) => documents.find((doc) => doc.type === type && doc.approved)?.content;
      const result = await generate(
        'story-bible',
        {
          title: project.title,
          premise: project.premise,
          genre: project.genre,
          niche: project.niche,
          research: project.research,
          derivedFrom,
          genreResearch: byType('genre'),
          nicheReference: byType('niche'),
          endingReference: byType('ending'),
          endingChoice: byType('ending-choice'),
          charactersReference: byType('characters'),
          structureReference: byType('structure'),
          chapterOutlinesReference: outlineGate.document.content,
        },
        manualGenOpts
      );
      if (latestStoryBible) {
        await updateDocument(latestStoryBible.id, {
          content: result.content,
          version: latestStoryBible.version + 1,
          approved: false,
        });
      } else {
        await createDocument({
          projectId: project.id,
          type: 'story-bible',
          content: result.content,
          version: 1,
          approved: false,
        });
      }
      setStoryBibleDraft(result.content);
      addToast({ type: 'success', message: 'Story Bible generated. Review and approve before drafting chapters.' });
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to generate Story Bible.' });
    } finally {
      setIsCanonSaving(false);
    }
  }, [project, documents, latestStoryBible, generate, manualGenOpts, addToast, createDocument, updateDocument]);

  const saveStoryBibleDraft = useCallback(
    async (approve = false) => {
      if (!latestStoryBible) return;
      setIsCanonSaving(true);
      try {
        let content = storyBibleDraft;
        if (approve) {
          const parsed = parseStoryBible(storyBibleDraft);
          content = JSON.stringify(
            {
              storyBible: {
                ...parsed.storyBible,
                approvedAt: new Date().toISOString(),
              },
            },
            null,
            2
          );
        }
        await updateDocument(latestStoryBible.id, {
          content,
          approved: approve,
          ...(!approve ? { version: latestStoryBible.version + 1 } : {}),
        });
        setStoryBibleDraft(content);
        addToast({
          type: 'success',
          message: approve ? 'Story Bible approved.' : 'Story Bible saved as a new draft version.',
        });
      } catch (err) {
        addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to save Story Bible.' });
      } finally {
        setIsCanonSaving(false);
      }
    },
    [latestStoryBible, storyBibleDraft, updateDocument, addToast]
  );

  const generateCreativeBrief = useCallback(async () => {
    if (!project || !approvedStoryBible) {
      addToast({ type: 'error', message: 'Approve the Story Bible before generating a Creative Brief.' });
      return;
    }
    setIsCanonSaving(true);
    try {
      const result = await generate(
        'creative-brief',
        {
          storyBibleContent: approvedStoryBible.content,
          storyBibleDocumentId: approvedStoryBible.id,
          storyBibleVersion: approvedStoryBible.version,
          storyBibleUpdatedAt: approvedStoryBible.updatedAt.toISOString(),
        },
        manualGenOpts
      );
      if (latestCreativeBrief) {
        await updateDocument(latestCreativeBrief.id, {
          content: result.content,
          version: latestCreativeBrief.version + 1,
          approved: false,
        });
      } else {
        await createDocument({
          projectId: project.id,
          type: 'creative-brief',
          content: result.content,
          version: 1,
          approved: false,
        });
      }
      addToast({ type: 'success', message: 'Creative Brief generated.' });
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to generate Creative Brief.' });
    } finally {
      setIsCanonSaving(false);
    }
  }, [project, approvedStoryBible, latestCreativeBrief, generate, manualGenOpts, addToast, createDocument, updateDocument]);

  const approveCreativeBrief = useCallback(async () => {
    if (!latestCreativeBrief) return;
    setIsCanonSaving(true);
    try {
      await approveDocument(latestCreativeBrief.id);
      addToast({ type: 'success', message: 'Creative Brief approved.' });
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to approve Creative Brief.' });
    } finally {
      setIsCanonSaving(false);
    }
  }, [latestCreativeBrief, approveDocument, addToast]);

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height))] text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height))]">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <StageLayout
      projectId={projectId}
      projectTitle={project.title}
      genre={project.genre}
      niche={project.niche}
      currentStage={project.currentStage}
      activeStage="story-bible"
      chapters={chapters}
      approvedChapterIds={approvedChapterIds}
      revisionTasks={revisionTasks}
      documents={documents}
      finalExportedAt={project.finalExportedAt}
      blurbFilled={!!project.blurb?.trim()}
      amazonDescriptionFilled={!!project.amazonDescription?.trim()}
    >
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground leading-relaxed">
          The Story Bible locks canon after{' '}
          <Link href={`/projects/${projectId}/stage/chapter-outlines`} className="text-accent underline">
            Chapter Outlines
          </Link>
          . Approve it to feed drafting, covers, and marketing.
        </p>

        <div className="flex flex-wrap gap-2">
          <Badge variant={approvedStoryBible ? 'success' : 'default'}>
            Story Bible:{' '}
            {approvedStoryBible
              ? `Approved v${approvedStoryBible.version}`
              : latestStoryBible
                ? `Draft v${latestStoryBible.version}`
                : 'Missing'}
          </Badge>
          <Badge variant={storyBibleStale ? 'warning' : 'success'}>{storyBibleStale ? 'Story Bible stale' : 'Story Bible current'}</Badge>
          <Badge variant={approvedCreativeBrief ? 'success' : 'default'}>
            Creative Brief:{' '}
            {approvedCreativeBrief
              ? `Approved v${approvedCreativeBrief.version}`
              : latestCreativeBrief
                ? `Draft v${latestCreativeBrief.version}`
                : 'Missing'}
          </Badge>
          <Badge variant={creativeBriefStale ? 'warning' : 'success'}>{creativeBriefStale ? 'Brief stale' : 'Brief current'}</Badge>
        </div>

        {!validatedOutlinesGate.ok && (
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {validatedOutlinesGate.reason}{' '}
            <Link href={`/projects/${projectId}/stage/chapter-outlines`} className="underline text-accent">
              Open Chapter Outlines
            </Link>
          </p>
        )}

        {storyBibleNeedsTropesRefresh && (
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Story Bible needs refresh to include canonical reader tropes. Regenerate it after approving a structured niche document.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => void generateStoryBible()}
            disabled={isCanonSaving || isGeneratingCanon || !canGenerateStoryBible}
          >
            {latestStoryBible ? 'Regenerate Story Bible' : 'Generate Story Bible'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void generateCreativeBrief()}
            disabled={isCanonSaving || isGeneratingCanon || !approvedStoryBible}
          >
            {latestCreativeBrief ? 'Regenerate Brief' : 'Generate Brief'}
          </Button>
        </div>

        {latestStoryBible ? (
          <div className="space-y-4">
            {parsedReadable ? (
              <>
                <h2 className="text-lg font-semibold text-foreground">Canon overview</h2>
                <StoryBibleReadableView story={parsedReadable} />
              </>
            ) : (
              <p className="text-sm text-amber-600">Story Bible draft is present but JSON could not be parsed for the overview.</p>
            )}

            <details className="rounded-lg border border-border bg-card">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Edit JSON (advanced)</summary>
              <div className="px-4 pb-4">
                <Textarea
                  value={storyBibleDraft}
                  onChange={(e) => setStoryBibleDraft(e.target.value)}
                  rows={14}
                  className="font-mono text-xs"
                  aria-label="Story Bible JSON"
                />
                <div className="flex flex-wrap justify-between gap-2 mt-3">
                  <p className="text-xs text-muted-foreground max-w-md">
                    Approve triggers validation. Edits outside JSON mode will make the Creative Brief stale until regenerated.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => void saveStoryBibleDraft(false)} disabled={isCanonSaving || isGeneratingCanon}>
                      Save Draft
                    </Button>
                    <Button size="sm" onClick={() => void saveStoryBibleDraft(true)} disabled={isCanonSaving || isGeneratingCanon}>
                      Approve Story Bible
                    </Button>
                    {latestCreativeBrief && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void approveCreativeBrief()}
                        disabled={isCanonSaving || isGeneratingCanon || creativeBriefStale}
                      >
                        Approve Brief
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </details>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            No Story Bible yet. Approve outlines the app can parse, then generate.
          </div>
        )}

        <div className="pt-4">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/projects/${projectId}`)}>
            ← Project dashboard
          </Button>
        </div>
      </div>
    </StageLayout>
  );
}
