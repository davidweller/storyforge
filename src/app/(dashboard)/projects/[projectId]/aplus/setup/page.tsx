'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { APlusLayout } from '@/components/layout';
import { Button } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import { APLUS_MODULES, APLUS_SETUP_STORAGE_PREFIX } from '@/lib/aplus/moduleCatalog';
import type { APlusModuleType } from '@/types';

type APlusSetupState = {
  selectedModules: APlusModuleType[];
};

function readSetup(projectId: string): APlusSetupState {
  if (typeof window === 'undefined') return { selectedModules: [] };
  try {
    const raw = sessionStorage.getItem(`${APLUS_SETUP_STORAGE_PREFIX}${projectId}`);
    if (!raw) return { selectedModules: [] };
    const parsed = JSON.parse(raw) as APlusSetupState;
    return Array.isArray(parsed.selectedModules) ? parsed : { selectedModules: [] };
  } catch {
    return { selectedModules: [] };
  }
}

function writeSetup(projectId: string, state: APlusSetupState) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(`${APLUS_SETUP_STORAGE_PREFIX}${projectId}`, JSON.stringify(state));
}

export default function APlusSetupPage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const { project, documents, chapters, revisionTasks, loading, error } = useProject(projectId ?? null);

  const initial = useMemo(
    () => (projectId ? readSetup(projectId).selectedModules : []),
    [projectId]
  );
  const [selected, setSelected] = useState<APlusModuleType[]>(
    initial.length ? initial : ['hero-banner', 'character-spotlight', 'quote-review']
  );

  if (!projectId) return null;
  if (loading || !project) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  const unlocked = Boolean(project.approvedCoverImageId && project.approvedBackCoverImageId);

  const toggle = (id: APlusModuleType) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const save = async () => {
    const finalSelection = selected.length ? selected : ['hero-banner'];
    writeSetup(projectId, { selectedModules: finalSelection });
  };

  return (
    <APlusLayout
      projectId={projectId}
      title="Setup"
      project={project}
      documents={documents}
      chapters={chapters ?? []}
      revisionTasks={revisionTasks ?? []}
    >
      {!unlocked && (
        <p className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          A+ unlocks after both front and back covers are approved.
        </p>
      )}
      <p className="text-sm text-muted-foreground mb-4">
        Select which A+ module styles you want to build. This selection seeds the brief and generation steps.
      </p>
      <div className="grid gap-3 mb-6">
        {APLUS_MODULES.map((m) => (
          <label key={m.id} className="rounded-lg border border-border p-4 flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} className="mt-1" />
            <div>
              <div className="font-medium text-sm">{m.label}</div>
              <p className="text-xs text-muted-foreground mt-1">{m.purpose}</p>
              <p className="text-xs text-muted-foreground">{m.composition}</p>
            </div>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={() => void save()}
          disabled={!unlocked}
        >
          Save module selection
        </Button>
        <Link href={`/projects/${projectId}/aplus/brief`} className="text-sm underline text-accent">
          Continue to prompt brief
        </Link>
      </div>
    </APlusLayout>
  );
}
