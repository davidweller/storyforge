'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { WorkflowSidebar } from '@/components/layout';
import { ModelSelector } from '@/components/stages';
import type { WorkflowStage, Chapter, RevisionTask, Project } from '@/types';

interface MarketingLayoutProps {
  projectId: string;
  title: string;
  stage: 'blurb' | 'amazon-description';
  project: Project;
  chapters?: Chapter[];
  revisionTasks?: RevisionTask[];
  children: ReactNode;
}

export function MarketingLayout({
  projectId,
  title,
  stage,
  project,
  chapters = [],
  revisionTasks = [],
  children,
}: MarketingLayoutProps) {
  const approvedChapterIds = new Set<string>();

  return (
    <div className="flex h-[calc(100vh-var(--header-height))]">
      <WorkflowSidebar
        projectId={projectId}
        projectTitle={project.title}
        genre={project.genre}
        niche={project.niche}
        currentStage={project.currentStage as WorkflowStage}
        chapters={chapters}
        approvedChapterIds={approvedChapterIds}
        revisionTasks={revisionTasks}
        finalExportedAt={project.finalExportedAt}
        blurbFilled={!!project.blurb?.trim()}
        amazonDescriptionFilled={!!project.amazonDescription?.trim()}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="border-b border-border bg-card px-12 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 mb-1">
              <Link
                href={`/projects/${projectId}/marketing/blurb`}
                className="text-sm text-muted-foreground hover:opacity-80 transition-opacity no-underline"
              >
                Marketing
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium text-foreground">{title}</span>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {title}
              </h1>
              <ModelSelector stage={stage} />
            </div>
          </div>
        </div>
        <div className="px-12 py-8">
          <div className="max-w-3xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
