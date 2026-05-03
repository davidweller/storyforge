'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { CoverLayout } from '@/components/layout/CoverLayout';
import { Button } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import {
  COVER_ARCHETYPES,
  archetypesForGenreRows,
  assembleCoverPrompt,
  buildCoverPromptTokens,
  type CoverArchetypeId,
} from '@/lib/prompts/covers';
import { parseStoryBible } from '@/lib/generation/schemas';
import type { CoverBriefDocument, StoryBibleDocument } from '@/types';

const storageKey = (pid: string) => `storyforge.cover.selection.${pid}`;

interface SelectionPersist {
  ids: CoverArchetypeId[];
  highClick: Partial<Record<CoverArchetypeId, boolean>>;
  prompts: Partial<Record<CoverArchetypeId, string>>;
}

export default function CoverArchetypePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId as string | undefined;
  const { project, documents, chapters, revisionTasks, loading, error, getLatestDocumentByType } = useProject(
    projectId ?? null
  );

  const coverBriefDoc = getLatestDocumentByType('cover-brief');
  const canonUnlocked = documents.some(
    (d) => (d.type === 'story-bible' || d.type === 'creative-brief') && d.approved
  );
  const storyDoc = documents.find((d) => d.type === 'story-bible' && d.approved);

  const coverBrief = useMemo((): CoverBriefDocument | null => {
    if (!coverBriefDoc?.content?.trim()) return null;
    try {
      return JSON.parse(coverBriefDoc.content) as CoverBriefDocument;
    } catch {
      return null;
    }
  }, [coverBriefDoc]);

  const storyBible = useMemo((): StoryBibleDocument | null => {
    if (!storyDoc?.content) return null;
    try {
      return parseStoryBible(storyDoc.content) as unknown as StoryBibleDocument;
    } catch {
      return null;
    }
  }, [storyDoc]);

  const { recommended, rest } = useMemo(
    () => archetypesForGenreRows(project?.genre ?? 'general', project?.niche),
    [project?.genre, project?.niche]
  );

  const [selected, setSelected] = useState<Set<CoverArchetypeId>>(new Set());
  const [highClick, setHighClick] = useState<Partial<Record<CoverArchetypeId, boolean>>>({});
  const [prompts, setPrompts] = useState<Partial<Record<CoverArchetypeId, string>>>({});

  useEffect(() => {
    if (!projectId || typeof sessionStorage === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(storageKey(projectId));
      if (!raw) return;
      const p = JSON.parse(raw) as SelectionPersist;
      if (Array.isArray(p.ids)) setSelected(new Set(p.ids));
      if (p.highClick) setHighClick(p.highClick);
      if (p.prompts) setPrompts(p.prompts);
    } catch {
      /* ignore */
    }
  }, [projectId]);

  const mkPrompt = useCallback(
    (id: CoverArchetypeId, hi: boolean) => {
      if (!project?.title || !coverBrief || !storyBible) return '';
      const tokens = buildCoverPromptTokens({
        genre: project.genre,
        title: project.title,
        coverBrief,
        storyBible,
      });
      return assembleCoverPrompt(id, tokens, hi);
    },
    [project?.genre, project?.title, coverBrief, storyBible]
  );

  const toggle = (id: CoverArchetypeId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 6) next.add(id);
      return next;
    });
  };

  useEffect(() => {
    setPrompts((prev) => {
      const o = { ...prev };
      for (const id of selected) {
        if (!o[id]) o[id] = mkPrompt(id, !!highClick[id]);
      }
      for (const key of Object.keys(o)) {
        const k = key as CoverArchetypeId;
        if (!selected.has(k)) delete o[k];
      }
      return o;
    });
  }, [selected, highClick, mkPrompt]);

  const setHi = (id: CoverArchetypeId, v: boolean) => {
    setHighClick((h) => {
      const next = { ...h, [id]: v };
      setPrompts((p) => ({ ...p, [id]: mkPrompt(id, v) }));
      return next;
    });
  };

  const handleProceed = () => {
    if (!projectId) return;
    const sel: SelectionPersist = { ids: [...selected], highClick, prompts };
    sessionStorage.setItem(storageKey(projectId), JSON.stringify(sel));
    router.push(`/projects/${projectId}/cover/front/generate`);
  };

  if (!projectId) return null;
  if (loading || !project) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  const ready =
    canonUnlocked && coverBrief?.recommendedArchetypes?.length && storyBible && project.title?.trim();

  if (!ready) {
    return (
      <CoverLayout
        projectId={projectId}
        section="front"
        title="Archetype Selection"
        project={project}
        documents={documents}
        chapters={chapters ?? []}
        revisionTasks={revisionTasks ?? []}
      >
        <p className="text-muted-foreground mb-4">
          Approve your Story Bible (or Creative Brief), generate and approve a cover brief, and set your title before
          choosing archetypes.
        </p>
        <Link className="text-accent underline" href={`/projects/${projectId}/cover/front/brief`}>
          Go to Cover Brief
        </Link>
      </CoverLayout>
    );
  }

  const ArcGrid = ({
    rows,
    label,
    rec,
  }: {
    rows: typeof COVER_ARCHETYPES;
    label: string;
    rec: boolean;
  }) => (
    <div className="mb-10">
      <h3 className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground mb-3 px-1">{label}</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((a) => {
          const on = selected.has(a.id);
          const isRec = rec && !!coverBrief?.recommendedArchetypes?.some((r) => r.archetypeId === a.id);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => toggle(a.id)}
              className={cn(
                'text-left rounded-lg border border-border p-3 transition-colors',
                on ? 'bg-accent/[0.08] ring-1 ring-accent/25' : 'hover:bg-muted/50'
              )}
            >
              <div className="flex gap-3">
                <div
                  className="w-[72px] h-[108px] shrink-0 rounded-md bg-gradient-to-br from-slate-600/40 to-slate-900/50"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm">{a.name}</span>
                    {isRec && (
                      <span className="text-[0.625rem] rounded bg-accent/15 px-1.5 py-0.5 text-accent">Recommended</span>
                    )}
                  </div>
                  <p className="text-[0.6875rem] text-muted-foreground mt-1">{a.primaryGenres.join(' · ')}</p>
                  <p className="text-[0.625rem] text-muted-foreground mt-1">{a.thumbnailStrength} thumbnail</p>
                  {on && (
                    <label className="mt-2 flex items-center gap-2 text-xs" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={!!highClick[a.id]} onChange={() => setHi(a.id, !highClick[a.id])} />
                      High-click optimised
                    </label>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <CoverLayout
      projectId={projectId}
      section="front"
      title="Archetype Selection"
      project={project}
      documents={documents}
      chapters={chapters ?? []}
      revisionTasks={revisionTasks ?? []}
    >
      <p className="text-sm text-muted-foreground mb-6">
        Select up to four archetypes (six allowed in UI; more than four is expensive). Prompts pull from your approved cover
        brief and story bible.
      </p>
      {selected.size > 4 && (
        <p className="mb-4 text-sm text-amber-600">
          Generating more than four archetypes at once is expensive — consider narrowing your selection.
        </p>
      )}

      <ArcGrid rows={recommended} label="Recommended for your genre" rec />
      <ArcGrid rows={rest} label="All archetypes" rec={false} />

      <h3 className="text-sm font-semibold mb-3">Prompt preview (editable)</h3>
      <div className="space-y-4">
        {[...selected].map((id) => (
          <div key={id}>
            <p className="text-xs text-muted-foreground mb-1">{id}</p>
            <textarea
              className="w-full min-h-[140px] rounded-md border border-border bg-background p-3 font-mono text-xs"
              value={prompts[id] ?? mkPrompt(id, !!highClick[id])}
              onChange={(e) => setPrompts((p) => ({ ...p, [id]: e.target.value }))}
            />
            <Button type="button" variant="ghost" className="mt-1 h-8 text-xs" onClick={() => setPrompts((p) => ({ ...p, [id]: mkPrompt(id, !!highClick[id]) }))}>
              Reset from brief
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Button type="button" disabled={selected.size === 0} onClick={handleProceed}>
          Continue to generation
        </Button>
        <Link href={`/projects/${projectId}/cover/front/brief`} className="text-sm text-muted-foreground underline">
          Back to brief
        </Link>
      </div>
    </CoverLayout>
  );
}
