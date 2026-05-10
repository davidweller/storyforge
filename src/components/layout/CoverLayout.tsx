'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { WorkflowNav } from './WorkflowNav';
import { WorkflowSectionNav } from './WorkflowSectionNav';
import { ModelSelector } from '@/components/stages';
import type { WorkflowStage, Chapter, RevisionTask, Project, ProjectDocument } from '@/types';

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

const PB_NAV = [{ slug: 'full-wrap' as const, label: 'Full wrap (legacy)' }];

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
            <WorkflowSectionNav
              className="mb-6"
              items={
                section === 'front'
                  ? (() => {
                      const designActive = ['/cover/front/archetype', '/cover/front/brief', '/cover/front/generate', '/cover/front/refine'].some(
                        (p) => pathname.includes(p)
                      );
                      const reviewActive =
                        pathname.includes('/cover/front/export') ||
                        pathname.includes('/cover/paperback/back-export');
                      const wrapActive = pathname.includes('/cover/paperback/full-wrap');
                      return [
                        {
                          href: `/projects/${projectId}/cover/front/archetype`,
                          label: 'Design',
                          isActive: designActive,
                        },
                        {
                          href: `/projects/${projectId}/cover/front/export`,
                          label: 'Review & Export',
                          isActive: reviewActive,
                        },
                        {
                          href: `/projects/${projectId}/cover/paperback/full-wrap`,
                          label: 'Advanced Wrap',
                          isActive: wrapActive,
                        },
                      ];
                    })()
                  : PB_NAV.map((n) => {
                      const href =
                        n.slug === 'full-wrap'
                          ? `/projects/${projectId}/cover/paperback/full-wrap`
                          : `/projects/${projectId}/cover/paperback/${n.slug}`;
                      const active =
                        n.slug === 'full-wrap'
                          ? pathname.includes('/cover/paperback/full-wrap')
                          : pathname.includes(`/cover/paperback/${n.slug}`);
                      return { href, label: n.label, isActive: active };
                    })
              }
            />
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
