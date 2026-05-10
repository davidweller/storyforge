'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CoverLayout } from '@/components/layout';
import { Button, Textarea } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import { useGenerate } from '@/hooks/useGenerate';
import { getEffectiveModelForStage } from '@/lib/data/models';
import { assembleCanonForCoverBrief, isoNow, safeParseCoverBrief } from '@/lib/cover/assembleCanonForCover';
import type { CoverArchetypeId } from '@/lib/prompts/covers';
import { COVER_ARCHETYPES, syncResolvedPromptFromLayers } from '@/lib/prompts';
import type { CoverBriefDocumentV2, ProjectDocument } from '@/types';
import { isCoverBriefV2 } from '@/types';
import type { StoryBibleDocument } from '@/types';
import { parseStoryBible } from '@/lib/generation/schemas';

const SESSION_KEY = (pid: string) => `storyforge.cover.selection.${pid}`;

function loadSessionIds(projectId: string): CoverArchetypeId[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(SESSION_KEY(projectId));
    if (!raw) return [];
    const p = JSON.parse(raw) as { ids?: string[] };
    return Array.isArray(p.ids) ? (p.ids as CoverArchetypeId[]) : [];
  } catch {
    return [];
  }
}

function findLatestBriefForArchetype(documents: ProjectDocument[], archetypeId: string): ProjectDocument | null {
  const list = documents
    .filter((d) => d.type === 'cover-brief')
    .filter((d) => {
      const b = safeParseCoverBrief(d.content);
      return b && isCoverBriefV2(b) && b.archetypeId === archetypeId;
    })
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return list[0] ?? null;
}

/** Edit flat path in layers object via shallow copy drill-down. */
function setLayerField(
  brief: CoverBriefDocumentV2,
  path: string,
  value: string
): CoverBriefDocumentV2 {
  const next = JSON.parse(JSON.stringify(brief)) as CoverBriefDocumentV2;
  const parts = path.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = next;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
  return next;
}

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
    updateProject,
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
        authorName: project.authorName,
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

  const [archetypes, setArchetypes] = useState<CoverArchetypeId[]>([]);
  const [activeArch, setActiveArch] = useState<CoverArchetypeId | null>(null);
  const [localBrief, setLocalBrief] = useState<CoverBriefDocumentV2 | null>(null);
  const [rawOpen, setRawOpen] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    const ids = loadSessionIds(projectId);
    setArchetypes(ids);
  }, [projectId]);

  useEffect(() => {
    if (archetypes.length === 0) return;
    setActiveArch((prev) => (prev && archetypes.includes(prev) ? prev : archetypes[0]));
  }, [archetypes]);

  const latestDocForActive =
    activeArch && projectId ? findLatestBriefForArchetype(documents, activeArch) : null;

  useEffect(() => {
    if (!activeArch || !latestDocForActive?.content) return;
    const b = safeParseCoverBrief(latestDocForActive.content);
    if (b && isCoverBriefV2(b)) setLocalBrief(b);
  }, [activeArch, latestDocForActive?.id, latestDocForActive?.content]);

  useEffect(() => {
    if (activeArch && !latestDocForActive && project?.title?.trim()) {
      setLocalBrief(null);
    }
  }, [activeArch, latestDocForActive, project?.title]);

  const persistOrCreate = useCallback(async (brief: CoverBriefDocumentV2) => {
    if (!projectId) return null;
    const content = JSON.stringify(brief);
    const existing = findLatestBriefForArchetype(documents, brief.archetypeId);
    if (existing && !existing.approved) {
      await updateDocument(existing.id, { content, version: existing.version + 1 });
      await refresh?.();
      return existing.id;
    }
    const id = await createDocument({
      projectId,
      type: 'cover-brief',
      content,
      version: 1,
      approved: false,
    });
    await refresh?.();
    return id;
  }, [projectId, documents, updateDocument, createDocument, refresh]);

  const handleRegenerateArchetype = useCallback(async () => {
    if (!project || !storyDoc?.content || !activeArch || !assembledPreview.trim()) return;
    clearError();
    const assembled = assembledPreview.trim();
    const model = getEffectiveModelForStage('cover-brief');
    const titleApprovedAt =
      typeof project.updatedAt === 'object' ? project.updatedAt.toISOString() : isoNow();
    const canonExtra = `\n---\nFor derivedFrom.titleApprovedAt use: "${titleApprovedAt}"\nFor layers.text.authorText prefer: "${project.authorName ?? 'Author'}"\nFor layers.text.titleText prefer: "${project.title ?? ''}"\n`;
    try {
      const result = await generate(
        'cover-brief',
        {
          assembledCanon: `${assembled}${canonExtra}`,
          archetypeId: activeArch,
          genre: project.genre,
        },
        { model: model.id, projectId, usageSource: 'manual-stage' }
      );
      const parsed = JSON.parse(result.content) as unknown;
      if (
        parsed &&
        typeof parsed === 'object' &&
        (parsed as CoverBriefDocumentV2).schemaVersion === 2
      ) {
        let brief = parsed as CoverBriefDocumentV2;
        const author = project.authorName?.trim() || 'Author';
        // Keep regenerated briefs in sync with the latest project author name.
        brief.layers.text.authorText = author;
        brief.layers.text.titleText = brief.layers.text.titleText || project.title || brief.layers.text.titleText;
        brief = syncResolvedPromptFromLayers(brief, project.genre, false);
        setLocalBrief(brief);
        await persistOrCreate(brief);
      }
    } catch {
      /* surfaced */
    }
  }, [
    project,
    storyDoc,
    activeArch,
    assembledPreview,
    generate,
    clearError,
    projectId,
    persistOrCreate,
  ]);

  const handleApproveOne = async () => {
    if (!localBrief) return;
    const json = syncResolvedPromptFromLayers(localBrief, project?.genre ?? 'fiction', false);
    const id = await persistOrCreate(json);
    if (!id) return;
    await approveDocument(id);
    await refresh?.();
  };

  const handleApproveAll = useCallback(async () => {
    if (!project) return;
    for (const arch of archetypes) {
      const d = findLatestBriefForArchetype(documents, arch);
      if (!d?.content || d.approved) continue;
      const b = safeParseCoverBrief(d.content);
      if (!b || !isCoverBriefV2(b)) continue;
      const json = syncResolvedPromptFromLayers(b, project.genre ?? 'fiction', false);
      await updateDocument(d.id, { content: JSON.stringify(json), version: d.version + 1 });
      await approveDocument(d.id);
    }
    await refresh?.();
  }, [project, archetypes, documents, updateDocument, approveDocument, refresh]);

  const syncPromptFromLayers = () => {
    if (!localBrief || !project) return;
    setLocalBrief(syncResolvedPromptFromLayers(localBrief, project.genre, false));
  };

  if (!projectId) return null;
  if (loading || !project) {
    return <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground">Loading...</div>;
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-red-600">{error}</p>
        <Link href={`/projects/${projectId}`} className="text-sm underline">
          Back
        </Link>
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
      </CoverLayout>
    );
  }

  if (archetypes.length === 0) {
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
        <p className="text-sm text-muted-foreground mb-4">Select archetypes first.</p>
        <Link href={`/projects/${projectId}/cover/front/archetype`} className="text-accent underline">
          Archetype Selection
        </Link>
      </CoverLayout>
    );
  }

  const archMeta = activeArch ? COVER_ARCHETYPES.find((a) => a.id === activeArch) : null;
  const allApproved =
    archetypes.length > 0 &&
    archetypes.every((aid) => {
      const hit = documents.find((d) => {
        const b = safeParseCoverBrief(d.content);
        return d.type === 'cover-brief' && d.approved && b && isCoverBriefV2(b) && b.archetypeId === aid;
      });
      return !!hit;
    });

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
      <div className="flex flex-wrap gap-2 mb-4">
        <label className="text-xs text-muted-foreground flex items-center gap-2">
          Author display name (cover type):
          <input
            className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
            placeholder="Displayed on generated cover typography"
            value={project.authorName ?? ''}
            onChange={(e) => updateProject({ authorName: e.target.value || undefined })}
          />
        </label>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6 mb-6">
        <div>
          <h3 className="text-sm font-semibold mb-2">Canon inputs used</h3>
          <p className="text-[0.7rem] text-muted-foreground mb-2">
            Genre: {project.genre}. Title: {project.title ?? '(set title)'}. Layers below are synced into the resolved
            image prompt.
          </p>
          <Textarea readOnly rows={14} value={assembledPreview.slice(0, 12_000)} className="text-xs font-mono" />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">Archetype briefs</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {archetypes.map((id) => {
              const draft = findLatestBriefForArchetype(documents, id);
              const appr = !!draft?.approved;
              return (
                <button
                  key={id}
                  type="button"
                  className={`text-xs px-2 py-1 rounded border ${activeArch === id ? 'border-accent ring-1 ring-accent/30' : 'border-border'}`}
                  onClick={() => setActiveArch(id)}
                >
                  {id}
                  {appr ? ' ✓' : ''}
                </button>
              );
            })}
          </div>

          {!localBrief && activeArch ? (
            <p className="text-sm text-muted-foreground mb-3">
              Generate a layered brief for {archMeta?.name ?? activeArch}.
            </p>
          ) : null}

          {localBrief && activeArch && localBrief.archetypeId === activeArch ? (
            <div className="space-y-3">
              <div className="border border-border rounded-lg p-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Background</h4>
                <Textarea
                  rows={3}
                  className="text-xs mb-2"
                  value={localBrief.layers.background.description}
                  onChange={(e) =>
                    setLocalBrief(setLayerField(localBrief, 'layers.background.description', e.target.value))
                  }
                />
                <Textarea
                  rows={2}
                  className="text-xs mb-2"
                  value={localBrief.layers.background.paletteDirection}
                  onChange={(e) =>
                    setLocalBrief(setLayerField(localBrief, 'layers.background.paletteDirection', e.target.value))
                  }
                  placeholder="paletteDirection"
                />
                <Textarea
                  rows={2}
                  className="text-xs"
                  value={localBrief.layers.background.lightingNotes}
                  onChange={(e) =>
                    setLocalBrief(setLayerField(localBrief, 'layers.background.lightingNotes', e.target.value))
                  }
                  placeholder="lightingNotes"
                />
              </div>
              <div className="border border-border rounded-lg p-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Text</h4>
                <input
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs mb-2"
                  value={localBrief.layers.text.titleText}
                  onChange={(e) =>
                    setLocalBrief(setLayerField(localBrief, 'layers.text.titleText', e.target.value))
                  }
                />
                <input
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs mb-2"
                  value={localBrief.layers.text.authorText}
                  onChange={(e) =>
                    setLocalBrief(setLayerField(localBrief, 'layers.text.authorText', e.target.value))
                  }
                />
                <textarea
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs mb-2"
                  rows={2}
                  value={localBrief.layers.text.typographyDirection}
                  onChange={(e) =>
                    setLocalBrief(setLayerField(localBrief, 'layers.text.typographyDirection', e.target.value))
                  }
                />
                <textarea
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                  rows={2}
                  value={localBrief.layers.text.textPlacement}
                  onChange={(e) =>
                    setLocalBrief(setLayerField(localBrief, 'layers.text.textPlacement', e.target.value))
                  }
                />
              </div>
              <details className="border border-border rounded-lg p-3">
                <summary className="text-xs cursor-pointer font-medium text-foreground">Other layer fields (JSON paths)</summary>
                <p className="text-[0.65rem] text-muted-foreground mt-2 mb-2">
                  Archetype-specific layers (protagonist, symbol, landscape, …) remain in structured JSON —
                  regenerate or edit raw prompt if you need granular changes.
                </p>
              </details>
              <details open={rawOpen} onToggle={(e) => setRawOpen((e.target as HTMLDetailsElement).open)}>
                <summary className="text-xs cursor-pointer font-medium">What the AI sees (resolved prompt)</summary>
                <p className="text-[0.65rem] text-muted-foreground my-2">
                  {localBrief.promptOverridden
                    ? 'Manually edited — use “Sync from layers” to discard manual prompt edits.'
                    : 'Auto-assembled from layers when you regenerate or sync.'}
                </p>
                <Textarea
                  rows={12}
                  className="font-mono text-[0.7rem]"
                  value={localBrief.resolvedPrompt}
                  onChange={(e) =>
                    setLocalBrief((b) =>
                      b
                        ? { ...b, resolvedPrompt: e.target.value, promptOverridden: true }
                        : null
                    )
                  }
                />
                <div className="flex gap-2 mt-2">
                  <Button type="button" variant="secondary" className="h-8 text-xs" onClick={syncPromptFromLayers}>
                    Sync from layers
                  </Button>
                </div>
              </details>
            </div>
          ) : null}
        </div>
      </div>

      {generateError ? (
        <div className="p-3 rounded-md bg-red-950/30 text-red-300 text-sm mb-4">{generateError}</div>
      ) : null}

      <div className="flex flex-wrap gap-2 items-center">
        <Button type="button" onClick={() => void handleRegenerateArchetype()} disabled={isGenerating || !activeArch}>
          Regenerate brief (active archetype)
        </Button>
        <Button type="button" variant="secondary" disabled={!localBrief} onClick={() => localBrief && void persistOrCreate(syncResolvedPromptFromLayers(localBrief, project.genre ?? 'fiction', false))}>
          Save draft
        </Button>
        <Button type="button" variant="secondary" disabled={!localBrief} onClick={() => void handleApproveOne()}>
          Approve this brief
        </Button>
        <Button type="button" variant="secondary" disabled={archetypes.length < 2} onClick={() => void handleApproveAll()}>
          Approve all archetypes with drafts
        </Button>
        {isGenerating && <span className="text-xs text-muted-foreground">Generating…</span>}
        {allApproved && (
          <Link href={`/projects/${projectId}/cover/front/generate`} className="text-sm text-accent underline">
            Continue to Generation →
          </Link>
        )}
      </div>
    </CoverLayout>
  );
}
