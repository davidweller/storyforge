'use client';

import { ReactNode } from 'react';
import { WorkflowNav } from '@/components/layout';
import { useProject } from '@/hooks/useProject';

interface SerialPageShellProps {
  projectId: string;
  title: string;
  description: string;
  children?: ReactNode;
}

export function SerialPageShell({
  projectId,
  title,
  description,
  children,
}: SerialPageShellProps) {
  const { project, chapters, documents, revisionTasks, loading } = useProject(projectId);

  if (loading || !project) {
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
    <div style={{ display: 'flex', height: 'calc(100vh - var(--header-height))' }}>
      <WorkflowNav
        projectId={projectId}
        projectTitle={project.title}
        genre={project.genre}
        niche={project.niche}
        currentStage={project.currentStage}
        chapters={chapters}
        revisionTasks={revisionTasks}
        documents={documents}
        finalExportedAt={project.finalExportedAt}
        blurbFilled={!!project.blurb?.trim()}
        amazonDescriptionFilled={!!project.amazonDescription?.trim()}
        approvedCoverImageId={project.approvedCoverImageId ?? null}
        approvedBackCoverImageId={project.approvedBackCoverImageId ?? null}
        approvedAPlusModuleId={project.approvedAPlusModuleId ?? null}
      />
      <main style={{ flex: 1, overflowY: 'auto', padding: '2rem 3rem' }}>
        <div style={{ maxWidth: '900px', marginLeft: 'auto', marginRight: 'auto' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: '0.5rem' }}>{title}</h1>
          <p style={{ color: 'var(--muted-foreground)', marginBottom: '1.5rem' }}>{description}</p>
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e5e5',
              borderRadius: '12px',
              padding: '1.5rem',
            }}
          >
            {children ?? (
              <p style={{ color: 'var(--muted-foreground)' }}>
                This page is scaffolded for Serialisation Phase 1 wiring.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
