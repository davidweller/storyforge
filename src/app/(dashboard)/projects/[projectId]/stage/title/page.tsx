'use client';

import { use, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useProject } from '@/hooks/useProject';
import { useGenerate } from '@/hooks/useGenerate';
import { useProjectStore } from '@/stores/projectStore';
import { StageLayout, LoadingContent } from '@/components/stages';
import { Button, Card, CardContent, Input } from '@/components/ui';
import { ReviewChecklist } from '@/components/review/ReviewChecklist';
import { checklistItemsForKey } from '@/lib/review/checklists';
import { getNextStage, isStageAccessible } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { WorkflowStage } from '@/types';
import { parseTitleOptions } from '@/lib/generation/schemas';
import { assembleContext } from '@/lib/context/assembler';

interface TitlePageProps {
  params: Promise<{ projectId: string }>;
}

export default function TitlePage({ params }: TitlePageProps) {
  const { projectId } = use(params);
  const router = useRouter();

  const {
    project,
    documents,
    chapters,
    loading: projectLoading,
    error: projectError,
    getLatestDocumentByType,
    updateProject,
  } = useProject(projectId);

  const { advanceStage } = useProjectStore();
  const { generate, isGenerating, error: generateError, clearError } = useGenerate();

  const manualGenOpts = useMemo(
    () => ({ projectId, usageSource: 'manual-stage' as const }),
    [projectId]
  );

  const [titleOptions, setTitleOptions] = useState<string[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [customTitleDraft, setCustomTitleDraft] = useState('');
  const [showSelectionView, setShowSelectionView] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [contextWarnings, setContextWarnings] = useState<string[]>([]);
  const [subtitleDraft, setSubtitleDraft] = useState('');
  const [taglineDraft, setTaglineDraft] = useState('');

  useEffect(() => {
    if (project && !projectLoading && !isStageAccessible(project.currentStage, 'title')) {
      router.push(`/projects/${projectId}`);
    }
  }, [project, projectLoading, projectId, router]);

  useEffect(() => {
    if (!project) return;
    setSubtitleDraft(project.subtitle ?? '');
    setTaglineDraft(project.tagline ?? '');
  }, [project?.subtitle, project?.tagline, project]);

  const handleGenerate = async () => {
    if (!project) return;
    clearError();
    const structureDoc = getLatestDocumentByType('structure');
    const endingDoc = getLatestDocumentByType('ending');
    const charactersDoc = getLatestDocumentByType('characters');
    const nicheDoc = getLatestDocumentByType('niche');
    const assembled = assembleContext({
      purpose: 'title',
      project,
      documents,
      chapters,
    });
    setContextWarnings(assembled.warnings);

    try {
      const result = await generate('title', {
        genre: project.genre,
        premise: project.premise,
        assembledContext: assembled.text,
        structureReference: structureDoc?.content ?? '',
        endingReference: endingDoc?.content ?? '',
        charactersReference: charactersDoc?.content ?? '',
        nicheReference: nicheDoc?.content ?? '',
        userTitleIdea: customTitleDraft.trim() || undefined,
      }, manualGenOpts);
      setTitleOptions(parseTitleOptions(result.content));
      setSelectedTitle(null);
      setShowSelectionView(true);
    } catch {
      // Error already set by useGenerate
    }
  };

  const handleUseCustomTitle = () => {
    const trimmed = customTitleDraft.trim();
    if (!trimmed) return;
    setSelectedTitle(trimmed);
    setShowSelectionView(true);
  };

  const handleCustomTitleChange = (value: string) => {
    const wasSelected = selectedTitle === customTitleDraft.trim() && customTitleDraft.trim().length > 0;
    setCustomTitleDraft(value);
    if (wasSelected) {
      setSelectedTitle(value.trim() || null);
    }
  };

  const handleSelectCustomTitle = () => {
    const trimmed = customTitleDraft.trim();
    if (!trimmed) return;
    setSelectedTitle(trimmed);
  };

  const handleUseTitle = async () => {
    if (!selectedTitle?.trim() || !project) return;
    setIsConfirming(true);
    try {
      await updateProject({
        title: selectedTitle.trim(),
        subtitle: subtitleDraft.trim() || undefined,
        tagline: taglineDraft.trim() || undefined,
      });
      const nextStage = getNextStage('title') as WorkflowStage;
      if (nextStage && project.currentStage === 'title') {
        await advanceStage(projectId, nextStage);
      }
      router.push(`/projects/${projectId}/stage/${nextStage}`);
    } catch {
      setIsConfirming(false);
    }
  };

  if (projectLoading || !project) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height))]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
          <p className="text-[var(--muted-foreground)]">Loading...</p>
        </div>
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
      activeStage="title"
      chapters={chapters}
      blurbFilled={!!project.blurb?.trim()}
      amazonDescriptionFilled={!!project.amazonDescription?.trim()}
    >
      {(projectError || generateError) && (
        <div className="mb-6 p-4 bg-[rgba(139,38,53,0.1)] border border-[var(--destructive)] rounded-lg">
          <p className="text-sm text-[var(--destructive)]">{projectError || generateError}</p>
        </div>
      )}

      {contextWarnings.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm font-medium text-amber-900 mb-1">Canon context warning</p>
          <p className="text-sm text-amber-800">{contextWarnings[0]}</p>
        </div>
      )}

      {isGenerating && (
        <LoadingContent message="Generating title ideas..." />
      )}

      {!isGenerating && !showSelectionView && (
        <div className="bg-card border border-border rounded-xl p-8 md:p-12">
          <div className="max-w-lg mx-auto text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-muted rounded-full mb-4">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Choose your book title</h3>
            <p className="text-muted-foreground">
              Enter a title you already have in mind, or generate a list of ideas based on your genre, plot blueprint, characters, and ending.
            </p>
          </div>

          <div className="max-w-lg mx-auto space-y-2 mb-6">
            <label className="text-sm font-medium text-foreground" htmlFor="custom-title-idea">
              Your title idea
            </label>
            <Input
              id="custom-title-idea"
              value={customTitleDraft}
              onChange={(e) => setCustomTitleDraft(e.target.value)}
              placeholder="Enter a title you have in mind..."
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              Optional. Use it as your book title, or include it when generating more ideas.
            </p>
          </div>

          <div className="max-w-lg mx-auto flex flex-wrap gap-3 justify-center">
            <Button onClick={handleGenerate} disabled={isGenerating}>
              Generate title ideas
            </Button>
            <Button
              variant="secondary"
              onClick={handleUseCustomTitle}
              disabled={!customTitleDraft.trim()}
            >
              Use my title
            </Button>
          </div>
        </div>
      )}

      {!isGenerating && showSelectionView && (
        <>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
              Choose your book title
            </h2>
            <p className="text-[var(--muted-foreground)]">
              Select one title below. It will become the name of your book. You can generate new ideas if you want more options.
            </p>
          </div>

          <Card
            className={cn(
              'cursor-pointer transition-all duration-200 mb-6',
              selectedTitle === customTitleDraft.trim() && customTitleDraft.trim()
                ? 'ring-2 ring-[var(--ring)] bg-[var(--muted)]'
                : 'hover:border-[var(--ring)]'
            )}
            onClick={handleSelectCustomTitle}
          >
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                    selectedTitle === customTitleDraft.trim() && customTitleDraft.trim()
                      ? 'border-[var(--accent)] bg-[var(--accent)]'
                      : 'border-[var(--border)]'
                  )}
                >
                  {selectedTitle === customTitleDraft.trim() && customTitleDraft.trim() && (
                    <svg className="w-3 h-3 text-[var(--primary-foreground)]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium text-[var(--foreground)]">Your own title</p>
                  <Input
                    value={customTitleDraft}
                    onChange={(e) => handleCustomTitleChange(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => e.stopPropagation()}
                    placeholder="Enter your title idea..."
                    maxLength={200}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {titleOptions.length > 0 && (
          <div className="grid gap-3 mb-6">
            {titleOptions.map((title) => (
              <Card
                key={title}
                className={cn(
                  'cursor-pointer transition-all duration-200',
                  selectedTitle === title
                    ? 'ring-2 ring-[var(--ring)] bg-[var(--muted)]'
                    : 'hover:border-[var(--ring)]'
                )}
                onClick={() => setSelectedTitle(title)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                        selectedTitle === title
                          ? 'border-[var(--accent)] bg-[var(--accent)]'
                          : 'border-[var(--border)]'
                      )}
                    >
                      {selectedTitle === title && (
                        <svg className="w-3 h-3 text-[var(--primary-foreground)]" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <span className="font-medium text-[var(--foreground)]">{title}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          )}

          <div className="mb-6 space-y-4 rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">Cover & listing metadata</p>
            <p className="text-xs text-muted-foreground">
              Optional subtitle and tagline feed print cover typography and Ads. Saved with your title choice.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="subtitle-draft">
                Subtitle
              </label>
              <Input
                id="subtitle-draft"
                value={subtitleDraft}
                onChange={(e) => setSubtitleDraft(e.target.value)}
                placeholder="Subtitle (e.g., A Novel)"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="tagline-draft">
                Tagline
              </label>
              <Input
                id="tagline-draft"
                value={taglineDraft}
                onChange={(e) => setTaglineDraft(e.target.value)}
                placeholder="Short hook for cover — a few words"
                maxLength={160}
              />
            </div>
          </div>

          <ReviewChecklist items={checklistItemsForKey('title')} className="mb-4" />

          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="secondary" onClick={() => setShowSelectionView(false)} disabled={isGenerating}>
              Back
            </Button>
            <Button variant="secondary" onClick={handleGenerate} disabled={isGenerating}>
              Generate new ideas
            </Button>
            <Button
              onClick={handleUseTitle}
              disabled={!selectedTitle || isConfirming}
            >
              {isConfirming ? 'Saving...' : 'Use this title'}
            </Button>
          </div>
        </>
      )}
    </StageLayout>
  );
}
