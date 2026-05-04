'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { CoverLayout } from '@/components/layout/CoverLayout';
import { Button } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import { COVER_ARCHETYPES, archetypesForGenreRows, type CoverArchetypeId } from '@/lib/prompts/covers';

const storageKey = (pid: string) => `storyforge.cover.selection.${pid}`;

interface SelectionPersist {
  ids: CoverArchetypeId[];
  highClick: Partial<Record<CoverArchetypeId, boolean>>;
}

export default function CoverArchetypePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId as string | undefined;
  const { project, documents, chapters, revisionTasks, loading, error } = useProject(projectId ?? null);

  const canonUnlocked = documents.some(
    (d) => (d.type === 'story-bible' || d.type === 'creative-brief') && d.approved
  );

  const { recommended, rest } = useMemo(
    () => archetypesForGenreRows(project?.genre ?? 'general', project?.niche),
    [project?.genre, project?.niche]
  );

  const [selected, setSelected] = useState<Set<CoverArchetypeId>>(new Set());
  const [highClick, setHighClick] = useState<Partial<Record<CoverArchetypeId, boolean>>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!projectId || typeof sessionStorage === 'undefined') {
      setIsLoaded(true);
      return;
    }
    try {
      const raw = sessionStorage.getItem(storageKey(projectId));
      if (raw) {
        const p = JSON.parse(raw) as SelectionPersist & { prompts?: unknown };
        if (Array.isArray(p.ids)) setSelected(new Set(p.ids));
        if (p.highClick) setHighClick(p.highClick);
      }
    } catch {
      /* ignore */
    }
    setIsLoaded(true);
  }, [projectId]);

  useEffect(() => {
    if (!isLoaded || !projectId || typeof sessionStorage === 'undefined') return;
    const sel: SelectionPersist = { ids: [...selected], highClick };
    sessionStorage.setItem(storageKey(projectId), JSON.stringify(sel));
  }, [projectId, selected, highClick, isLoaded]);

  const toggle = (id: CoverArchetypeId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setHi = (id: CoverArchetypeId, v: boolean) => {
    setHighClick((h) => ({ ...h, [id]: v }));
  };

  const handleProceed = () => {
    if (!projectId) return;
    router.push(`/projects/${projectId}/cover/front/brief`);
  };

  if (!projectId) return null;
  if (loading || !project) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  const ready = canonUnlocked && !!project.title?.trim();
  const overFour = selected.size > 4;
  const noneSelected = selected.size === 0;

  const ArcGrid = ({
    rows,
    label,
    showRecBadge,
  }: {
    rows: typeof COVER_ARCHETYPES;
    label: string;
    showRecBadge: boolean;
  }) => (
    <div className="mb-10">
      <h3 className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground mb-3 px-1">{label}</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((a) => {
          const on = selected.has(a.id);
          const isRecBadge = showRecBadge && recommended.some((r) => r.id === a.id);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => toggle(a.id)}
              className={cn(
                'text-left rounded-lg border border-border p-3 transition-colors relative',
                on ? 'bg-accent/[0.08] ring-1 ring-accent/25' : 'hover:bg-muted/50'
              )}
            >
              {on ? (
                <span className="absolute top-2 right-2 text-accent text-xs" aria-hidden>
                  ✓
                </span>
              ) : null}
              <div className="flex gap-3">
                <div
                  className="w-[120px] h-[180px] shrink-0 rounded-md bg-gradient-to-br from-slate-600/40 to-slate-900/50 border border-border/50"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm">{a.name}</span>
                    {isRecBadge ? (
                      <span className="text-[0.625rem] rounded bg-accent/15 px-1.5 py-0.5 text-accent">
                        Recommended
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[0.6875rem] text-muted-foreground mt-1">{a.primaryGenres.join(' · ')}</p>
                  <p className="text-[0.625rem] text-muted-foreground mt-1 mb-2">
                    Thumbnail strength: {a.thumbnailStrength}
                  </p>
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                  {on ? (
                    <label className="mt-2 flex items-center gap-2 text-xs" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={!!highClick[a.id]}
                        onChange={() => setHi(a.id, !highClick[a.id])}
                      />
                      High-click optimised
                    </label>
                  ) : null}
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
        Pick 1–4 archetypes (you can choose more, but batches beyond four get expensive). High-click mode optimises
        for Amazon thumbnail visibility.
      </p>

      {!ready && (
        <div className="mb-6 p-4 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm">
          <p className="mb-2">
            <strong>Complete canon first:</strong> Approve your Story Bible (or Creative Brief) and choose a title on
            the Title stage before building cover briefs.
          </p>
          <Link className="text-accent underline font-medium" href={`/projects/${projectId}/stage/story-bible`}>
            Go to Story Bible
          </Link>
        </div>
      )}

      {overFour && (
        <div className="mb-6 p-3 rounded-md border border-amber-500/40 bg-amber-500/10 text-sm text-foreground">
          Generating more than 4 archetypes at once is expensive — consider narrowing your selection.
        </div>
      )}

      {recommended.length > 0 && <ArcGrid rows={recommended} label="Recommended for your genre" showRecBadge />}
      <ArcGrid
        rows={rest}
        label={recommended.length > 0 ? 'All archetypes' : 'Archetypes'}
        showRecBadge={false}
      />

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Button type="button" disabled={noneSelected || !ready} onClick={handleProceed}>
          Build brief for {selected.size || '…'} selected archetype
          {selected.size === 1 ? '' : 's'}
        </Button>
      </div>
    </CoverLayout>
  );
}
