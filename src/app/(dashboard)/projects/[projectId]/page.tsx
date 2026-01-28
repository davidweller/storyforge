'use client';

import { use } from 'react';
import Link from 'next/link';
import { useProject } from '@/hooks/useProject';
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import { WorkflowSidebar } from '@/components/layout';
import { STAGE_NAMES, STAGE_ORDER, getStageIndex, formatDate, formatRelativeTime } from '@/lib/utils';

interface ProjectDashboardProps {
  params: Promise<{ projectId: string }>;
}

export default function ProjectDashboard({ params }: ProjectDashboardProps) {
  const { projectId } = use(params);
  const {
    project,
    documents,
    chapters,
    loading,
    error,
    getTotalWordCount,
    getApprovedChaptersCount,
    getOpenIssuesCount,
  } = useProject(projectId);
  
  if (loading || !project) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height))]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
          <p className="text-[var(--muted-foreground)]">Loading project...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height))]">
        <div className="text-center">
          <p className="text-[var(--destructive)] mb-4">{error}</p>
          <Link href="/projects">
            <Button variant="secondary">Back to Projects</Button>
          </Link>
        </div>
      </div>
    );
  }
  
  const currentStageIndex = getStageIndex(project.currentStage);
  const totalStages = STAGE_ORDER.length;
  const progressPercent = ((currentStageIndex + 1) / totalStages) * 100;
  
  const approvedDocs = documents.filter((d) => d.approved);
  const totalWordCount = getTotalWordCount();
  const approvedChapters = getApprovedChaptersCount();
  const openIssues = getOpenIssuesCount();
  
  // Get approved chapter IDs for sidebar
  const approvedChapterIds = new Set<string>();
  // Note: This would need to be populated from chapter versions in a real implementation
  
  return (
    <div className="flex h-[calc(100vh-var(--header-height))]">
      {/* Sidebar */}
      <WorkflowSidebar
        projectId={project.id}
        projectTitle={project.title}
        currentStage={project.currentStage}
        chapters={chapters}
        approvedChapterIds={approvedChapterIds}
      />
      
      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-8 lg:p-12">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-10 lg:mb-12">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">
                  {project.title}
                </h1>
                <p className="text-[var(--muted-foreground)]">
                  {project.genre} • Created {formatDate(project.createdAt)}
                </p>
              </div>
              <Badge variant={project.status === 'completed' ? 'success' : 'info'}>
                {project.status}
              </Badge>
            </div>
            
            {/* Progress bar */}
            <div className="bg-[var(--muted)] rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-sm text-[var(--muted-foreground)] mt-2">
              Stage {currentStageIndex + 1} of {totalStages}: {STAGE_NAMES[project.currentStage]}
            </p>
          </div>
          
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10 lg:mb-12">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-[var(--foreground)]">
                  {totalWordCount.toLocaleString()}
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">Total Words</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-[var(--foreground)]">
                  {approvedChapters}/{chapters.length}
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">Chapters Approved</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-[var(--foreground)]">
                  {approvedDocs.length}
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">Reference Docs</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-[var(--foreground)]">
                  {openIssues}
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">Open Issues</p>
              </CardContent>
            </Card>
          </div>
          
          {/* Continue CTA */}
          <Card className="mb-10 lg:mb-12 bg-gradient-to-r from-[var(--primary)] to-[var(--color-ink-light)] text-[var(--primary-foreground)]">
            <CardContent className="py-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Continue Your Story</h2>
                  <p className="opacity-80">
                    Pick up where you left off at {STAGE_NAMES[project.currentStage]}
                  </p>
                </div>
                <Link href={`/projects/${project.id}/stage/${project.currentStage}`}>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="bg-[var(--primary-foreground)] text-[var(--primary)] hover:opacity-90"
                  >
                    Continue
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
          
          {/* Premise */}
          <Card className="mb-10 lg:mb-12">
            <CardHeader>
              <CardTitle>Premise</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[var(--foreground)] whitespace-pre-wrap">{project.premise}</p>
            </CardContent>
          </Card>
          
          {/* Reference Documents */}
          {approvedDocs.length > 0 && (
            <Card className="mb-10 lg:mb-12">
              <CardHeader>
                <CardTitle>Reference Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {approvedDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 bg-[var(--muted)] rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-[var(--status-approved)] bg-opacity-20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-[var(--status-approved)]" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-[var(--foreground)] capitalize">
                            Reference – {doc.type}
                          </p>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            v{doc.version} • {formatRelativeTime(doc.updatedAt)}
                          </p>
                        </div>
                      </div>
                      <Link href={`/projects/${project.id}/stage/${doc.type}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Chapters */}
          {chapters.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Chapters</CardTitle>
                  <Link href={`/projects/${project.id}/stage/chapters`}>
                    <Button variant="ghost" size="sm">View All</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {chapters.slice(0, 5).map((chapter) => (
                    <Link
                      key={chapter.id}
                      href={`/projects/${project.id}/chapter/${chapter.id}`}
                      className="flex items-center justify-between p-3 bg-[var(--muted)] rounded-lg hover:bg-opacity-80 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-[var(--foreground)]">
                          Chapter {chapter.chapterNumber}: {chapter.title}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {chapter.beatReference}
                        </p>
                      </div>
                      <svg className="w-5 h-5 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
                  {chapters.length > 5 && (
                    <p className="text-sm text-[var(--muted-foreground)] text-center pt-2">
                      +{chapters.length - 5} more chapters
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
