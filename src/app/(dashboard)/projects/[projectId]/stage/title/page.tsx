'use client';

import { use, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useProject } from '@/hooks/useProject';
import { useGenerate } from '@/hooks/useGenerate';
import { useProjectStore } from '@/stores/projectStore';
import { StageLayout, LoadingContent, EmptyContent } from '@/components/stages';
import { Button, Card, CardContent } from '@/components/ui';
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
  const [isConfirming, setIsConfirming] = useState(false);
  const [contextWarnings, setContextWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (project && !projectLoading && !isStageAccessible(project.currentStage, 'title')) {
      router.push(`/projects/${projectId}`);
    }
  }, [project, projectLoading, projectId, router]);

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
      }, manualGenOpts);
      setTitleOptions(parseTitleOptions(result.content));
      setSelectedTitle(null);
    } catch {
      // Error already set by useGenerate
    }
  };

  const handleUseTitle = async () => {
    if (!selectedTitle?.trim() || !project) return;
    setIsConfirming(true);
    try {
      await updateProject({ title: selectedTitle.trim() });
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

      {!isGenerating && titleOptions.length === 0 && (
        <EmptyContent
          title="Generate title ideas"
          description="We'll generate a list of title ideas based on your genre, plot blueprint, characters, and ending. Choose your favourite to set as your book name."
          actionLabel="Generate title ideas"
          onAction={handleGenerate}
          isLoading={false}
        />
      )}

      {!isGenerating && titleOptions.length > 0 && (
        <>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
              Choose your book title
            </h2>
            <p className="text-[var(--muted-foreground)]">
              Select one title below. It will become the name of your book. You can generate new ideas if you want more options.
            </p>
          </div>

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

          <ReviewChecklist items={checklistItemsForKey('title')} className="mb-4" />

          <div className="flex items-center gap-3 flex-wrap">
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
