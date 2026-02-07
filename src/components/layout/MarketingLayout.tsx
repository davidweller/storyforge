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
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
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
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <div
          style={{
            borderBottom: '1px solid #e5e5e5',
            backgroundColor: '#ffffff',
            padding: '2rem 3rem',
          }}
        >
          <div style={{ maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Link
                href={`/projects/${projectId}/marketing/blurb`}
                style={{
                  fontSize: '0.875rem',
                  color: '#737373',
                  textDecoration: 'none',
                }}
              >
                Marketing
              </Link>
              <span style={{ color: '#a3a3a3' }}>/</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#171717' }}>{title}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.025em', color: '#171717' }}>
                {title}
              </h1>
              <ModelSelector stage={stage} />
            </div>
          </div>
        </div>
        <div style={{ padding: '2rem 3rem' }}>
          <div style={{ maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto' }}>{children}</div>
        </div>
      </main>
    </div>
  );
}
