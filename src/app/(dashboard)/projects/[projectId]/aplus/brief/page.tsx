'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { APlusLayout } from '@/components/layout';
import { Button } from '@/components/ui';
import { useGenerate } from '@/hooks/useGenerate';
import { useProject } from '@/hooks/useProject';
import { getEffectiveModelForStage } from '@/lib/data/models';
import { parseAPlusBrief } from '@/lib/generation/aplusSchemas';
import { formatCoverCampaignPack } from '@/lib/aplus/coverStylePack';
import { formatCoverToneForPrompt, resolveApprovedCoverTone } from '@/lib/cover/marketingCoverTone';
import { APLUS_MODULES, APLUS_SETUP_STORAGE_PREFIX, parseStoredAPlusModuleIds } from '@/lib/aplus/moduleCatalog';
import type { APlusModuleType, APlusTextMode } from '@/types';

type SetupState = { selectedModules: APlusModuleType[] };
type DraftMap = Record<APlusModuleType, { promptDraft: string; suggestedText: string | null }>;

const defaultTextModeFor: Record<APlusModuleType, APlusTextMode> = {
  'hero-banner': 'suggested',
  'character-spotlight': 'suggested',
  'world-spotlight': 'none',
  'trope-promise': 'suggested',
  'series-author-brand': 'custom',
  'quote-review': 'custom',
};

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

function writeDrafts(projectId: string, drafts: DraftMap) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(`${APLUS_SETUP_STORAGE_PREFIX}${projectId}.drafts`, JSON.stringify(drafts));
}

function buildCanonContext(project: {
  title?: string;
  genre: string;
  niche?: string;
  premise?: string;
}, docs: Array<{ type: string; approved: boolean; content: string }>): string {
  const storyBible = docs.find((d) => d.type === 'story-bible' && d.approved)?.content ?? '';
  const creativeBrief = docs.find((d) => d.type === 'creative-brief' && d.approved)?.content ?? '';
  return [
    `Title: ${project.title ?? 'Untitled'}`,
    `Genre: ${project.genre}`,
    `Niche: ${project.niche ?? ''}`,
    `Premise: ${project.premise ?? ''}`,
    '',
    'Story Bible:',
    storyBible.slice(0, 5000),
    '',
    'Creative Brief:',
    creativeBrief.slice(0, 3000),
  ].join('\n');
}

export default function APlusBriefPage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const { project, documents, chapters, revisionTasks, loading, error, createDocument } = useProject(projectId ?? null);
  const { generate, isGenerating, error: generateError, clearError } = useGenerate();
  const [localError, setLocalError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Partial<DraftMap>>({});

  const selectedModules = useMemo((): APlusModuleType[] => {
    if (!projectId) return [];
    const setup = readSetup(projectId).selectedModules;
    const fallback: APlusModuleType[] = ['hero-banner'];
    return setup.length ? setup : fallback;
  }, [projectId]);

  if (!projectId) return null;
  if (loading || !project) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  const unlocked = Boolean(project.approvedCoverImageId && project.approvedBackCoverImageId);

  const runBrief = async () => {
    if (!unlocked) return;
    clearError();
    setLocalError(null);
    const tone = resolveApprovedCoverTone(documents ?? [], project.approvedCoverImageId);
    if (!tone) {
      setLocalError('Approved front cover style reference is required.');
      return;
    }
    const coverToneBlock = formatCoverToneForPrompt(tone);
    const coverCampaignPack = formatCoverCampaignPack(project, documents ?? []);
    const canonContext = buildCanonContext(project, documents ?? []);
    const selectedModel = getEffectiveModelForStage('a-plus-brief');
    const nextDrafts: Partial<DraftMap> = {};

    for (const moduleType of selectedModules) {
      try {
        const result = await generate(
          'a-plus-brief',
          {
            moduleType,
            textMode: defaultTextModeFor[moduleType],
            genre: project.genre,
            title: project.title,
            niche: project.niche,
            canonContext,
            coverToneBlock,
            ...(coverCampaignPack.trim() ? { coverCampaignPack } : {}),
          },
          { model: selectedModel.id, projectId, usageSource: 'manual-stage' }
        );
        const parsed = parseAPlusBrief(result.content);
        nextDrafts[moduleType] = {
          promptDraft: parsed.promptDraft,
          suggestedText: parsed.suggestedText,
        };
        await createDocument({
          projectId,
          type: 'a-plus-brief',
          content: JSON.stringify(parsed),
          version: 1,
          approved: false,
        });
      } catch (e) {
        setLocalError(e instanceof Error ? e.message : 'Failed to generate one or more module briefs.');
        return;
      }
    }

    setDrafts(nextDrafts);
    writeDrafts(projectId, nextDrafts as DraftMap);
  };

  return (
    <APlusLayout
      projectId={projectId}
      title="Prompt brief"
      project={project}
      documents={documents}
      chapters={chapters ?? []}
      revisionTasks={revisionTasks ?? []}
      modelStage="a-plus-brief"
    >
      <p className="text-sm text-muted-foreground mb-4">
        Generate module-specific prompt drafts aligned to your approved front-cover style profile.
      </p>
      {localError && <p className="mb-3 text-sm text-red-600">{localError}</p>}
      {generateError && <p className="mb-3 text-sm text-red-600">{generateError}</p>}
      <div className="mb-4">
        <Button type="button" onClick={() => void runBrief()} disabled={!unlocked || isGenerating}>
          {isGenerating ? 'Generating briefs…' : 'Generate prompt briefs'}
        </Button>
      </div>
      <div className="space-y-3">
        {selectedModules.map((id) => {
          const meta = APLUS_MODULES.find((m) => m.id === id);
          const draft = drafts[id];
          return (
            <div key={id} className="rounded-md border border-border p-3">
              <p className="text-sm font-medium">{meta?.label ?? id}</p>
              {draft ? (
                <>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs bg-muted/40 rounded p-2">
                    {draft.promptDraft}
                  </pre>
                  {draft.suggestedText && (
                    <p className="mt-2 text-xs text-muted-foreground">Suggested text: {draft.suggestedText}</p>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">No brief generated yet.</p>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex gap-4">
        <Link href={`/projects/${projectId}/aplus/setup`} className="text-sm underline text-muted-foreground">
          Setup
        </Link>
        <Link href={`/projects/${projectId}/aplus/generate`} className="text-sm underline text-accent">
          Continue to generate
        </Link>
      </div>
    </APlusLayout>
  );
}
