'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { APlusLayout } from '@/components/layout';
import { Button } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import { APLUS_MODULES, APLUS_SETUP_STORAGE_PREFIX, parseStoredAPlusModuleIds } from '@/lib/aplus/moduleCatalog';
import {
  MAX_STYLE_REFERENCE_SLOTS,
  parseProjectStyleReferences,
  serializeProjectStyleReferences,
} from '@/lib/cover/styleReferences';
import type { APlusModuleType, ProjectStyleReference } from '@/types';

type APlusSetupState = {
  selectedModules: APlusModuleType[];
};

type APlusRefDraft = { mimeType: 'image/png' | 'image/jpeg'; base64Data: string; note: string };

function readSetup(projectId: string): APlusSetupState {
  if (typeof window === 'undefined') return { selectedModules: [] };
  try {
    const raw = sessionStorage.getItem(`${APLUS_SETUP_STORAGE_PREFIX}${projectId}`);
    if (!raw) return { selectedModules: [] };
    const parsed = JSON.parse(raw) as { selectedModules?: unknown };
    return { selectedModules: parseStoredAPlusModuleIds(parsed.selectedModules) };
  } catch {
    return { selectedModules: [] };
  }
}

function writeSetup(projectId: string, state: APlusSetupState) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(`${APLUS_SETUP_STORAGE_PREFIX}${projectId}`, JSON.stringify(state));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === 'string' ? r.result : '');
    r.onerror = () => reject(new Error('Failed to read file'));
    r.readAsDataURL(file);
  });
}

export default function APlusSetupPage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const { project, documents, chapters, revisionTasks, loading, error, updateProject, refresh } = useProject(
    projectId ?? null
  );
  const fallbackSelection: APlusModuleType[] = ['hero-banner', 'character-spotlight', 'quote-review'];
  const [selected, setSelected] = useState<APlusModuleType[]>(fallbackSelection);
  const [refDrafts, setRefDrafts] = useState<APlusRefDraft[]>([]);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [suggestBusy, setSuggestBusy] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    const fromSession = readSetup(projectId).selectedModules;
    if (fromSession.length) setSelected(fromSession);
  }, [projectId]);

  useEffect(() => {
    const parsed = parseProjectStyleReferences(project?.aPlusStyleReferencesJson);
    setRefDrafts(
      parsed.map((r) => ({ mimeType: r.mimeType, base64Data: r.base64Data, note: r.note ?? '' }))
    );
  }, [project?.aPlusStyleReferencesJson]);

  if (!projectId) return null;
  if (loading || !project) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  const unlocked = Boolean(project.approvedCoverImageId && project.approvedBackCoverImageId);

  const toggle = (id: APlusModuleType) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const save = async () => {
    const fb: APlusModuleType[] = ['hero-banner'];
    const finalSelection: APlusModuleType[] = selected.length ? selected : fb;
    writeSetup(projectId, { selectedModules: finalSelection });
  };

  async function saveRefs() {
    try {
      const payload: ProjectStyleReference[] = refDrafts.map((r) => ({
        mimeType: r.mimeType,
        base64Data: r.base64Data.trim(),
        ...(r.note.trim() ? { note: r.note.trim().slice(0, 600) } : {}),
      }));
      const json = serializeProjectStyleReferences(payload);
      await updateProject({ aPlusStyleReferencesJson: json });
      setLocalErr(null);
      await refresh();
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : 'Could not save A+ examples.');
    }
  }

  async function addRef(file: File | null) {
    if (!file || refDrafts.length >= MAX_STYLE_REFERENCE_SLOTS) return;
    const ok = file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/jpg';
    if (!ok) {
      setLocalErr('Examples must be PNG or JPEG.');
      return;
    }
    const mime: 'image/png' | 'image/jpeg' =
      file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const data = await readFileAsDataUrl(file);
    const comma = data.indexOf(',');
    const b64 = comma >= 0 ? data.slice(comma + 1) : data;
    setRefDrafts((p) => [...p, { mimeType: mime, base64Data: b64, note: '' }]);
    setLocalErr(null);
  }

  async function suggestModules() {
    setSuggestBusy(true);
    setLocalErr(null);
    try {
      const res = await fetch('/api/aplus/suggest-modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const j = (await res.json().catch(() => ({}))) as { suggestedModules?: APlusModuleType[]; error?: string };
      if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Suggestion failed.');
      const next = Array.isArray(j.suggestedModules) ? j.suggestedModules : [];
      if (next.length >= 2) setSelected(next);
      else throw new Error('Could not derive module suggestions.');
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : 'Suggestion failed.');
    } finally {
      setSuggestBusy(false);
    }
  }

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
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        Upload example A+ screenshots (optional) and optionally use AI to pre-select modules that match those references. Save examples
        to the project before suggesting so the server can read them.
      </p>

      <div className="rounded-lg border border-border p-4 space-y-3 mb-6">
        <p className="text-sm font-medium">Example A+ modules (PNG/JPEG, up to {MAX_STYLE_REFERENCE_SLOTS})</p>
        <div className="flex flex-wrap gap-3">
          {refDrafts.map((r, i) => (
            <div key={`${r.base64Data.slice(0, 12)}-${i}`} className="w-44 space-y-2 border border-border rounded-md p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                className="w-full h-28 object-cover rounded"
                src={`data:${r.mimeType};base64,${r.base64Data}`}
              />
              <input
                className="text-xs border border-border rounded px-2 py-1 w-full bg-background"
                value={r.note}
                placeholder="Note"
                onChange={(e) =>
                  setRefDrafts((rows) =>
                    rows.map((row, j) => (j === i ? { ...row, note: e.target.value } : row))
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs w-full"
                onClick={() => setRefDrafts((rows) => rows.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {refDrafts.length < MAX_STYLE_REFERENCE_SLOTS ? (
            <label className="text-sm cursor-pointer text-accent underline">
              Add example screenshot
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => void addRef(e.target.files?.[0] ?? null)}
              />
            </label>
          ) : null}
          <Button type="button" variant="secondary" size="sm" disabled={refDrafts.length === 0} onClick={() => void saveRefs()}>
            Save examples on project
          </Button>
          <Button type="button" size="sm" disabled={!unlocked || suggestBusy} onClick={() => void suggestModules()}>
            {suggestBusy ? 'Suggesting…' : 'Suggest modules from examples'}
          </Button>
        </div>
      </div>

      {localErr && <p className="mb-4 text-sm text-red-600">{localErr}</p>}

      <p className="text-sm font-medium mb-2">Modules</p>
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
      <div className="flex items-center gap-3 flex-wrap">
        <Button type="button" onClick={() => void save()} disabled={!unlocked}>
          Save module selection
        </Button>
        <Link href={`/projects/${projectId}/aplus/brief`} className="text-sm underline text-accent">
          Continue to prompt brief
        </Link>
      </div>
    </APlusLayout>
  );
}
