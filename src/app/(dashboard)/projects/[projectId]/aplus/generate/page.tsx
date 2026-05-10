'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { APlusLayout } from '@/components/layout';
import { Button } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import { APLUS_MODULES, APLUS_SETUP_STORAGE_PREFIX, parseStoredAPlusModuleIds } from '@/lib/aplus/moduleCatalog';
import type { APlusImagePayload, APlusModuleType, APlusTextMode } from '@/types';

type SetupState = { selectedModules: APlusModuleType[] };
type DraftMap = Record<APlusModuleType, { promptDraft: string; suggestedText: string | null }>;
type ModuleEditorState = {
  moduleType: APlusModuleType;
  prompt: string;
  textMode: APlusTextMode;
  customText: string;
  suggestedText: string;
};
type EditorMap = Record<APlusModuleType, ModuleEditorState>;

function readSetup(projectId: string): SetupState {
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

function readDrafts(projectId: string): Partial<DraftMap> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(`${APLUS_SETUP_STORAGE_PREFIX}${projectId}.drafts`);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<DraftMap>;
  } catch {
    return {};
  }
}

function readEditors(projectId: string): Partial<EditorMap> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(`${APLUS_SETUP_STORAGE_PREFIX}${projectId}.editors`);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<EditorMap>;
  } catch {
    return {};
  }
}

function writeEditors(projectId: string, editors: ModuleEditorState[]) {
  if (typeof window === 'undefined') return;
  const obj: Partial<EditorMap> = {};
  for (const entry of editors) {
    obj[entry.moduleType] = entry;
  }
  sessionStorage.setItem(`${APLUS_SETUP_STORAGE_PREFIX}${projectId}.editors`, JSON.stringify(obj));
}

function parseAPlusPayload(content: string): APlusImagePayload | null {
  try {
    return JSON.parse(content) as APlusImagePayload;
  } catch {
    return null;
  }
}

export default function APlusGeneratePage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const { project, documents, chapters, revisionTasks, loading, error, refresh, updateDocument, updateProject } =
    useProject(projectId ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastErrors, setLastErrors] = useState<Record<string, string>>({});

  const selectedModules = useMemo((): APlusModuleType[] => {
    if (!projectId) return [];
    const setup = readSetup(projectId).selectedModules;
    const DEFAULT: APlusModuleType[] = ['hero-banner'];
    return setup.length ? setup : DEFAULT;
  }, [projectId]);

  const editors = useMemo(() => {
    if (!projectId) return [] as ModuleEditorState[];
    const drafts = readDrafts(projectId);
    const savedEditors = readEditors(projectId);
    return selectedModules.map((moduleType) => ({
      moduleType: savedEditors[moduleType]?.moduleType ?? moduleType,
      prompt: savedEditors[moduleType]?.prompt ?? drafts[moduleType]?.promptDraft ?? '',
      textMode: savedEditors[moduleType]?.textMode ?? ('suggested' as APlusTextMode),
      customText: savedEditors[moduleType]?.customText ?? '',
      suggestedText: savedEditors[moduleType]?.suggestedText ?? drafts[moduleType]?.suggestedText ?? '',
    }));
  }, [projectId, selectedModules]);

  const [moduleEditors, setModuleEditors] = useState<ModuleEditorState[]>(editors);

  const generated = useMemo(() => {
    return documents
      .filter((d) => d.type === 'a-plus-module')
      .map((d) => {
        const payload = parseAPlusPayload(d.content);
        return payload ? { docId: d.id, payload } : null;
      })
      .filter(Boolean) as Array<{ docId: string; payload: APlusImagePayload }>;
  }, [documents]);

  const byModule = useMemo(() => {
    const map = new Map<APlusModuleType, Array<{ docId: string; payload: APlusImagePayload }>>();
    for (const row of generated) {
      const list = map.get(row.payload.moduleType) ?? [];
      list.push(row);
      map.set(row.payload.moduleType, list);
    }
    return map;
  }, [generated]);

  if (!projectId) return null;
  if (loading || !project) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  const unlocked = Boolean(project.approvedCoverImageId && project.approvedBackCoverImageId);

  const setEditor = (moduleType: APlusModuleType, patch: Partial<ModuleEditorState>) => {
    setModuleEditors((prev) => {
      const next = prev.map((m) => (m.moduleType === moduleType ? { ...m, ...patch } : m));
      if (projectId) writeEditors(projectId, next);
      return next;
    });
  };

  const runGenerate = async () => {
    if (!projectId || !moduleEditors.length) return;
    setErr(null);
    setLastErrors({});
    setBusy(true);
    try {
      await updateProject({ aPlusGenerationStatus: 'in-progress' });
      const runId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      const res = await fetch('/api/aplus/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          runId,
          n: 2,
          quality: 'high',
          modules: moduleEditors.map((m) => ({
            moduleType: m.moduleType,
            prompt: m.prompt,
            textMode: m.textMode,
            customText: m.textMode === 'custom' ? m.customText : undefined,
            suggestedText: m.textMode === 'suggested' ? m.suggestedText : undefined,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Generation failed');
      const errs: Record<string, string> = {};
      const results = data.results as Array<{ moduleType: string; error?: string }>;
      if (Array.isArray(results)) {
        for (const r of results) {
          if (r.error) errs[r.moduleType] = r.error;
        }
      }
      setLastErrors(errs);
      await refresh?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (docId: string, status: APlusImagePayload['status']) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc?.content) return;
    const payload = parseAPlusPayload(doc.content);
    if (!payload) return;
    await updateDocument(docId, {
      content: JSON.stringify({ ...payload, status }),
      version: doc.version + 1,
    });
    await refresh?.();
  };

  return (
    <APlusLayout
      projectId={projectId}
      title="Generate"
      project={project}
      documents={documents}
      chapters={chapters ?? []}
      revisionTasks={revisionTasks ?? []}
    >
      {!unlocked && (
        <p className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          A+ generation unlocks after front and back covers are approved.
        </p>
      )}
      {err && <p className="mb-3 text-sm text-red-600">{err}</p>}
      {Object.keys(lastErrors).length > 0 && (
        <ul className="mb-4 text-sm text-amber-700 dark:text-amber-400 list-disc pl-6">
          {Object.entries(lastErrors).map(([k, v]) => (
            <li key={k}>
              {k}: {v}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-4 mb-6">
        {moduleEditors.map((m) => {
          const meta = APLUS_MODULES.find((row) => row.id === m.moduleType);
          return (
            <div key={m.moduleType} className="rounded-lg border border-border p-4">
              <p className="text-sm font-semibold">{meta?.label ?? m.moduleType}</p>
              <textarea
                className="mt-2 w-full rounded-md border border-border bg-background p-3 text-sm min-h-[120px]"
                value={m.prompt}
                onChange={(e) => setEditor(m.moduleType, { prompt: e.target.value })}
                placeholder="Edit generated prompt before image generation."
              />
              <div className="mt-3 flex flex-wrap gap-4 text-xs">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={m.textMode === 'none'}
                    onChange={() => setEditor(m.moduleType, { textMode: 'none' })}
                  />
                  No text
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={m.textMode === 'suggested'}
                    onChange={() => setEditor(m.moduleType, { textMode: 'suggested' })}
                  />
                  Suggested text
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={m.textMode === 'custom'}
                    onChange={() => setEditor(m.moduleType, { textMode: 'custom' })}
                  />
                  Custom text
                </label>
              </div>
              {m.textMode === 'suggested' && (
                <input
                  className="mt-2 w-full rounded-md border border-border bg-background p-2 text-xs"
                  value={m.suggestedText}
                  onChange={(e) => setEditor(m.moduleType, { suggestedText: e.target.value })}
                  placeholder="Optional suggested text"
                />
              )}
              {m.textMode === 'custom' && (
                <input
                  className="mt-2 w-full rounded-md border border-border bg-background p-2 text-xs"
                  value={m.customText}
                  onChange={(e) => setEditor(m.moduleType, { customText: e.target.value.slice(0, 300) })}
                  placeholder="Exact text to render in image"
                />
              )}
            </div>
          );
        })}
      </div>

      <Button type="button" onClick={() => void runGenerate()} disabled={!unlocked || busy}>
        {busy ? 'Generating images…' : 'Generate module images'}
      </Button>

      <div className="mt-8 space-y-6">
        {selectedModules.map((moduleType) => {
          const variants = byModule.get(moduleType) ?? [];
          if (!variants.length) return null;
          const label = APLUS_MODULES.find((m) => m.id === moduleType)?.label ?? moduleType;
          return (
            <div key={moduleType}>
              <p className="text-sm font-semibold mb-2">{label}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {variants.map(({ docId, payload }) => (
                  <div key={docId} className="rounded-md border border-border overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="" src={`data:image/png;base64,${payload.imageData}`} className="w-full h-auto" />
                    <div className="p-2 flex gap-2">
                      <Button type="button" variant="ghost" className="h-8 text-xs" onClick={() => void setStatus(docId, 'candidate')}>
                        Candidate
                      </Button>
                      <Button type="button" variant="ghost" className="h-8 text-xs" onClick={() => void setStatus(docId, 'discarded')}>
                        Discard
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex gap-4 text-sm">
        <Link href={`/projects/${projectId}/aplus/brief`} className="underline text-muted-foreground">
          Prompt brief
        </Link>
        <Link href={`/projects/${projectId}/aplus/refine`} className="underline text-accent">
          Refine
        </Link>
      </div>
    </APlusLayout>
  );
}
