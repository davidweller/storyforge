'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { WorkflowNav } from './WorkflowNav';
import { ModelSelector } from '@/components/stages';
import type { WorkflowStage, Chapter, RevisionTask, Project, ProjectDocument } from '@/types';

type CoverSlug =
  | 'archetype'
  | 'review'
  | 'advanced-wrap'
  | 'back-brief'
  | 'back-generate'
  | 'back-refine'
  | 'back-export'
  | 'full-wrap';

interface CoverLayoutProps {
  projectId: string;
  title: string;
  /** Model UI only appears on stages that hit /api/generate (text JSON). */
  modelStage?: Extract<WorkflowStage, 'cover-brief' | 'back-cover-brief'>;
  project: Project;
  documents: ProjectDocument[];
  chapters?: Chapter[];
  revisionTasks?: RevisionTask[];
  section: 'front' | 'paperback';
  children: ReactNode;
}

const FRONT_NAV: {
  slug: Extract<CoverSlug, 'archetype' | 'review' | 'advanced-wrap'>;
  label: string;
}[] = [
  { slug: 'archetype', label: 'Design' },
  { slug: 'review', label: 'Review & Export' },
  { slug: 'advanced-wrap', label: 'Advanced Wrap' },
];

const PB_NAV: {
  slug: Extract<CoverSlug, 'full-wrap'>;
  label: string;
}[] = [{ slug: 'full-wrap', label: 'Full wrap (legacy)' }];

export function CoverLayout({
  projectId,
  title,
  modelStage,
  project,
  documents,
  chapters = [],
  revisionTasks = [],
  section,
  children,
}: CoverLayoutProps) {
  const pathname = usePathname();
  const approvedChapterIds = new Set<string>();

  const trail = section === 'front' ? 'Front cover' : 'Back Cover';

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
              <Link href={`/projects/${projectId}/cover/front/archetype`} className="hover:opacity-80 no-underline">
                Cover
              </Link>
              <span>/</span>
              <span>{trail}</span>
              <span>/</span>
              <span className="text-foreground font-medium">{title}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              {section === 'front'
                ? FRONT_NAV.map((n) => {
                    const href =
                      n.slug === 'advanced-wrap'
                        ? `/projects/${projectId}/cover/paperback/full-wrap`
                        : `/projects/${projectId}/cover/front/archetype`;
                    const active =
                      n.slug === 'advanced-wrap'
                        ? pathname.includes('/cover/paperback/full-wrap')
                        : pathname.includes('/cover/front/archetype');
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
                  })
                : PB_NAV.map((n) => {
                    const href =
                      n.slug === 'full-wrap'
                        ? `/projects/${projectId}/cover/paperback/full-wrap`
                        : `/projects/${projectId}/cover/paperback/${n.slug}`;
                    const active =
                      n.slug === 'full-wrap'
                        ? pathname.includes('/cover/paperback/full-wrap')
                        : pathname.includes(`/cover/paperback/${n.slug}`);
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
