'use client';

import { ReactNode, Suspense } from 'react';
import { WorkflowSidebar } from '@/components/layout';
import { ModelSelector } from './ModelSelector';
import { STAGE_NAMES, STAGE_DESCRIPTIONS } from '@/lib/utils';
import type { WorkflowStage, Chapter, RevisionTask, ProjectDocument } from '@/types';

interface StageLayoutProps {
  projectId: string;
  projectTitle?: string;  // Optional - may not be set until after ending stage
  genre?: string;         // Used as fallback display when title is missing
  niche?: string;         // Additional context for display
  currentStage: WorkflowStage;
  activeStage: WorkflowStage;
  chapters?: Chapter[];
  approvedChapterIds?: Set<string>;
  revisionTasks?: RevisionTask[];  // Optional - for checking revision completion
  documents?: ProjectDocument[];
  fourPassEditorial?: boolean;
  finalExportedAt?: Date;  // Optional - timestamp when final export was completed
  blurbFilled?: boolean;
  amazonDescriptionFilled?: boolean;
  children: ReactNode;
}

export function StageLayout({
  projectId,
  projectTitle,
  genre,
  niche,
  currentStage,
  activeStage,
  chapters = [],
  approvedChapterIds = new Set(),
  revisionTasks = [],
  documents = [],
  fourPassEditorial = false,
  finalExportedAt,
  blurbFilled = false,
  amazonDescriptionFilled = false,
  children,
}: StageLayoutProps) {
  // Don't show model selector for setup stage (no generation)
  const showModelSelector = activeStage !== 'setup';

  const sidebar = (
    <WorkflowSidebar
      projectId={projectId}
      projectTitle={projectTitle}
      genre={genre}
      niche={niche}
      currentStage={currentStage}
      chapters={chapters}
      approvedChapterIds={approvedChapterIds}
      revisionTasks={revisionTasks}
      documents={documents}
      fourPassEditorial={fourPassEditorial}
      finalExportedAt={finalExportedAt}
      blurbFilled={blurbFilled}
      amazonDescriptionFilled={amazonDescriptionFilled}
    />
  );
  
  return (
    <div className="flex h-[calc(100vh-var(--header-height))]">
      {/* Sidebar — Suspense for useSearchParams in nested pass links */}
      <Suspense fallback={<aside className="w-[var(--sidebar-width)] h-full shrink-0 bg-card border-r border-border" aria-hidden />}>
        {sidebar}
      </Suspense>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Stage header */}
        <div className="border-b border-border bg-card px-12 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {STAGE_NAMES[activeStage]}
              </h1>
              {showModelSelector && (
                <ModelSelector stage={activeStage} />
              )}
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {STAGE_DESCRIPTIONS[activeStage]}
            </p>
          </div>
        </div>

        {/* Stage content */}
        <div className="px-12 py-8">
          <div className="max-w-3xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
