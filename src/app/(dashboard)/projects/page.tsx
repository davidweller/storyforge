'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useProjects } from '@/hooks/useProject';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@/components/ui';
import { formatRelativeTime, STAGE_NAMES, countWords } from '@/lib/utils';

export default function ProjectsPage() {
  const { projects, loading, error } = useProjects();
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredProjects = projects.filter((project) =>
    project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.genre.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  if (loading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height))]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
          <p className="text-[var(--muted-foreground)]">Loading projects...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Projects</h1>
          <p className="text-[var(--muted-foreground)] mt-1.5">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </p>
        </div>
        <Link href="/projects/new">
          <Button size="lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </Button>
        </Link>
      </div>
      
      {/* Search */}
      {projects.length > 0 && (
        <div className="mb-6">
          <div className="relative max-w-md">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--muted-foreground)]"
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
              className="w-full h-11 pl-10 pr-4 py-2.5 border border-[var(--input)] rounded-xl bg-[var(--card)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-opacity-20 transition-all"
            />
          </div>
        </div>
      )}
      
      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-[rgba(239,68,68,0.1)] border border-[var(--destructive)] border-opacity-30 rounded-xl">
          <p className="text-sm text-[var(--destructive)]">{error}</p>
        </div>
      )}
      
      {/* Empty state */}
      {projects.length === 0 && !loading && (
        <div className="max-w-2xl mx-auto">
          <Card className="text-center py-16">
            <CardContent>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--muted)] rounded-full mb-4">
                <svg className="w-8 h-8 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold tracking-tight mb-2">No projects yet</h2>
              <p className="text-[var(--muted-foreground)] mb-6">
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
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Projects grid */}
      {filteredProjects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.map((project, index) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="group animate-slideIn"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <Card className="h-full transition-all duration-200 hover:shadow-lg hover:border-[var(--ring)] group-hover:-translate-y-1">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-2 group-hover:text-[var(--accent)] transition-colors">
                      {project.title}
                    </CardTitle>
                    <Badge variant={project.status === 'completed' ? 'success' : 'default'}>
                      {project.status}
                    </Badge>
                  </div>
                  <CardDescription>{project.genre}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[var(--muted-foreground)] line-clamp-2 mb-4">
                    {project.premise}
                  </p>
                  <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      {STAGE_NAMES[project.currentStage]}
                    </span>
                    <span>{formatRelativeTime(project.updatedAt)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
      
      {/* No search results */}
      {projects.length > 0 && filteredProjects.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[var(--muted-foreground)]">
            No projects match &quot;{searchQuery}&quot;
          </p>
        </div>
      )}
    </div>
  );
}
