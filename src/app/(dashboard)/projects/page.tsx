'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProjects } from '@/hooks/useProject';
import { useProjectStore } from '@/stores/projectStore';
import { Button, Badge, Modal } from '@/components/ui';
import { formatRelativeTime, STAGE_NAMES } from '@/lib/utils';

// Skeleton card component for loading state
function SkeletonCard() {
  return (
    <div className="bg-card rounded-xl p-5 shadow-[var(--shadow-card)] border border-border h-full">
      <div className="flex justify-between items-start gap-2 mb-2">
        <div className="h-5 rounded w-3/4 bg-muted" />
        <div className="h-4 rounded-full w-16 bg-muted" />
      </div>
      <div className="h-3 rounded w-1/3 bg-muted mb-3" />
      <div className="flex flex-col gap-2 mb-4">
        <div className="h-4 rounded w-full bg-muted" />
        <div className="h-4 rounded w-2/3 bg-muted" />
      </div>
      <div className="flex justify-between items-center">
        <div className="h-3 rounded w-24 bg-muted" />
        <div className="h-3 rounded w-16 bg-muted" />
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { projects, loading, error, refresh } = useProjects();
  const { deleteProject } = useProjectStore();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  const filteredProjects = projects.filter((project) =>
    (project.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    project.genre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (project.niche?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const handleDeleteClick = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDeleteId(projectId);
  };

  const handleConfirmDelete = async (projectId: string) => {
    setDeletingProjectId(projectId);
    setConfirmDeleteId(null);
    try {
      await deleteProject(projectId);
      await refresh();
    } catch (err) {
      console.error('Failed to delete project:', err);
    } finally {
      setDeletingProjectId(null);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDeleteId(null);
  };
  
  // Show skeleton loading state
  if (loading && projects.length === 0) {
    return (
      <div className="pt-10 pb-16 max-w-[1200px] mx-auto px-10">
        {/* Header skeleton */}
        <div className="flex justify-between items-center mb-7">
          <div>
            <div className="h-7 rounded w-44 bg-muted mb-2" />
            <div className="h-4 rounded w-20 bg-muted" />
          </div>
          <div className="h-10 rounded-lg w-36 bg-muted" />
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-10 pb-16 max-w-[1200px] mx-auto px-10">
      {/* Header */}
      <div className="flex justify-between items-center mb-7">
        <div>
          <h1 className="text-foreground tracking-tight">
            Your Projects
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </p>
        </div>
        <Link href="/projects/new">
          <Button size="lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </Button>
        </Link>
      </div>

      {/* Search */}
      {projects.length > 0 && (
        <div className="mb-7">
          <div className="relative max-w-xs">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-9 rounded-xl bg-card text-foreground border border-border outline-none text-sm focus:border-ring focus:ring-1 focus:ring-ring/30"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full bg-muted text-muted-foreground border-none cursor-pointer"
                aria-label="Clear search"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] border border-[color-mix(in_srgb,var(--destructive)_30%,transparent)]">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {projects.length === 0 && !loading && (
        <div className="max-w-lg mx-auto">
          <div className="bg-card rounded-2xl py-16 px-8 text-center shadow-[var(--shadow-md)]">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No projects yet
            </h2>
            <p className="text-muted-foreground mb-6">
              Start your first novel project and let AI help you through the entire writing process.
            </p>
            <Link href="/projects/new">
              <Button size="lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Your First Project
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Projects grid */}
      {filteredProjects.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="project-card relative bg-card rounded-xl p-5 shadow-[var(--shadow-card)] border border-border h-full transition-all"
            >
              {/* Delete button */}
              <button
                onClick={(e) => handleDeleteClick(e, project.id)}
                disabled={deletingProjectId === project.id}
                className="delete-btn absolute top-3.5 right-3.5 w-7 h-7 flex items-center justify-center rounded-md bg-transparent border-none text-muted-foreground/50 cursor-pointer z-10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Delete project"
              >
                {deletingProjectId === project.id ? (
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>

              {/* Project content - clickable link */}
              <Link href={`/projects/${project.id}`} className="no-underline block">
                <div className="flex justify-between items-start gap-2 mb-2 pr-8">
                  <h3 className="text-[0.9375rem] font-semibold text-foreground leading-snug mb-0 overflow-hidden text-ellipsis [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                    {project.title || `${project.genre} Project`}
                  </h3>
                  <Badge variant={project.status === 'completed' ? 'success' : 'default'}>
                    {project.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground/80 mb-3 font-medium tracking-wide">
                  {project.genre}{project.niche && ` · ${project.niche}`}
                </p>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed overflow-hidden text-ellipsis [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                  {project.premise || 'No premise provided yet'}
                </p>
                <div className="flex justify-between items-center text-xs text-muted-foreground/70">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    {STAGE_NAMES[project.currentStage]}
                  </span>
                  <span>{formatRelativeTime(project.updatedAt)}</span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Modal
        isOpen={!!confirmDeleteId}
        onClose={handleCancelDelete}
        title="Delete Project?"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={handleCancelDelete}
              disabled={deletingProjectId === confirmDeleteId}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteId && handleConfirmDelete(confirmDeleteId)}
              loading={deletingProjectId === confirmDeleteId}
              disabled={deletingProjectId === confirmDeleteId}
            >
              Delete
            </Button>
          </>
        }
      >
        Are you sure you want to delete this project? This action cannot be undone and will
        permanently delete all associated data including chapters, documents, and versions.
      </Modal>
      
      {/* No search results */}
      {projects.length > 0 && filteredProjects.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No projects match &quot;{searchQuery}&quot;
          </p>
        </div>
      )}
    </div>
  );
}
