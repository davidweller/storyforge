'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { WorkflowNav } from './WorkflowNav';
import { ModelSelector } from '@/components/stages';
import type { WorkflowStage, Chapter, RevisionTask, Project, ProjectDocument } from '@/types';

type APlusSlug = 'setup' | 'brief' | 'generate' | 'refine' | 'export';

interface APlusLayoutProps {
  projectId: string;
  title: string;
  project: Project;
  documents: ProjectDocument[];
  chapters?: Chapter[];
  revisionTasks?: RevisionTask[];
  modelStage?: Extract<WorkflowStage, 'a-plus-brief'>;
  children: ReactNode;
}

const NAV: { slug: APlusSlug; label: string }[] = [
  { slug: 'setup', label: 'Setup' },
  { slug: 'brief', label: 'Prompt brief' },
  { slug: 'generate', label: 'Generate' },
  { slug: 'refine', label: 'Refine' },
  { slug: 'export', label: 'Export' },
];

export function APlusLayout({
  projectId,
  title,
  project,
  documents,
  chapters = [],
  revisionTasks = [],
  modelStage,
  children,
}: APlusLayoutProps) {
  const pathname = usePathname();
  const approvedChapterIds = new Set<string>();

  return (
    <div className="flex h-[calc(100vh-var(--header-height))]">
      <WorkflowNav
        projectId={projectId}
        projectTitle={project.title}
        genre={project.genre}
        niche={project.niche}
        currentStage={project.currentStage as WorkflowStage}
        chapters={chapters}
        approvedChapterIds={approvedChapterIds}
        revisionTasks={revisionTasks}
        documents={documents}
        finalExportedAt={project.finalExportedAt}
        blurbFilled={!!project.blurb?.trim()}
        amazonDescriptionFilled={!!project.amazonDescription?.trim()}
        approvedCoverImageId={project.approvedCoverImageId ?? null}
        approvedBackCoverImageId={project.approvedBackCoverImageId ?? null}
        approvedAPlusModuleId={project.approvedAPlusModuleId ?? null}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="border-b border-border bg-card px-12 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-1 text-sm text-muted-foreground">
              <Link href={`/projects/${projectId}/aplus/setup`} className="hover:opacity-80 no-underline">
                A+ Content
              </Link>
              <span>/</span>
              <span className="text-foreground font-medium">{title}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              {NAV.map((n) => {
                const href = `/projects/${projectId}/aplus/${n.slug}`;
                const active = pathname.includes(`/aplus/${n.slug}`);
                return (
                  <Link
                    key={n.slug}
                    href={href}
                    className={
                      active
                        ? 'text-sm font-semibold text-foreground border-b-2 border-accent pb-0.5 no-underline'
                        : 'text-sm text-muted-foreground hover:text-foreground no-underline pb-0.5'
                    }
                  >
                    {n.label}
                  </Link>
                );
              })}
            </div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
              {modelStage && <ModelSelector stage={modelStage} />}
            </div>
          </div>
        </div>
        <div className="px-12 py-8">
          <div className="max-w-4xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
