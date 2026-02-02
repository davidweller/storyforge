'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProject } from '@/hooks/useProject';
import { useProjectStore } from '@/stores/projectStore';
import { StageLayout } from '@/components/stages';
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import { cn, getNextStage, isStageAccessible } from '@/lib/utils';
import type { WorkflowStage } from '@/types';

interface CompilationPageProps {
  params: Promise<{ projectId: string }>;
}

export default function CompilationPage({ params }: CompilationPageProps) {
  const { projectId } = use(params);
  const router = useRouter();
  
  const {
    project,
    chapters,
    loading,
    error,
    getApprovedChapterVersion,
    getTotalWordCount,
    getApprovedChaptersCount,
  } = useProject(projectId);
  
  const { advanceStage, loadChapterVersions } = useProjectStore();
  
  
  // Load versions for all chapters when chapters are available
  useEffect(() => {
    if (chapters.length > 0) {
      chapters.forEach(ch => {
        loadChapterVersions(ch.id);
      });
    }
  }, [chapters, loadChapterVersions]);
  
  // Auto-advance to compilation stage if all chapters are approved and we're still on chapters stage
  useEffect(() => {
    if (project && chapters.length > 0 && project.currentStage === 'chapters') {
      const allApproved = chapters.every(ch => getApprovedChapterVersion(ch.id));
      if (allApproved) {
        advanceStage(projectId, 'compilation');
      }
    }
  }, [project, chapters, getApprovedChapterVersion, advanceStage, projectId]);
  
  // Allow access to compilation if all chapters are approved, even if currentStage is still 'chapters'
  const canAccessCompilation = project && (
    isStageAccessible(project.currentStage, 'compilation') ||
    (project.currentStage === 'chapters' && chapters.length > 0 && chapters.every(ch => getApprovedChapterVersion(ch.id)))
  );
  
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
  
  // Check if compilation is accessible (allow if all chapters approved even if stage hasn't advanced)
  if (!canAccessCompilation) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height))]">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--muted)] flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Compilation Not Available</h2>
          <p className="text-[var(--muted-foreground)] max-w-md">
            Please complete and approve all chapters before accessing the manuscript assembly.
          </p>
          <Link href={`/projects/${projectId}/stage/chapters`}>
            <Button variant="secondary">Go to Chapters</Button>
          </Link>
        </div>
      </div>
    );
  }
  
  const totalWordCount = getTotalWordCount();
  const approvedCount = getApprovedChaptersCount();
  
  // Get approved chapter IDs
  const approvedChapterIds = new Set<string>();
  for (const ch of chapters) {
    if (getApprovedChapterVersion(ch.id)) {
      approvedChapterIds.add(ch.id);
    }
  }
  
  const handleContinueToExportDraft = async () => {
    try {
      const nextStage = getNextStage('compilation');
      if (nextStage && project.currentStage === 'compilation') {
        await advanceStage(projectId, nextStage as WorkflowStage);
      }
      router.push(`/projects/${projectId}/stage/export-draft`);
    } catch (err) {
      // Handle error
    }
  };
  
  return (
    <StageLayout
      projectId={projectId}
      projectTitle={project.title}
      genre={project.genre}
      niche={project.niche}
      currentStage={project.currentStage}
      activeStage="compilation"
      chapters={chapters}
      approvedChapterIds={approvedChapterIds}
    >
      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-[rgba(139,38,53,0.1)] border border-[var(--destructive)] rounded-lg">
          <p className="text-sm text-[var(--destructive)]">{error}</p>
        </div>
      )}
      
      {/* Manuscript summary */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Manuscript Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold text-[var(--foreground)]">{approvedCount}</div>
              <p className="text-sm text-[var(--muted-foreground)]">Chapters</p>
            </div>
            <div>
              <div className="text-3xl font-bold text-[var(--foreground)]">{totalWordCount.toLocaleString()}</div>
              <p className="text-sm text-[var(--muted-foreground)]">Words</p>
            </div>
            <div>
              <div className="text-3xl font-bold text-[var(--foreground)]">~{Math.ceil(totalWordCount / 250)}</div>
              <p className="text-sm text-[var(--muted-foreground)]">Est. Pages</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Chapter list */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Chapters to Include</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {chapters.map((chapter) => {
              const isApproved = approvedChapterIds.has(chapter.id);
              const version = getApprovedChapterVersion(chapter.id);
              
              return (
                <div
                  key={chapter.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg',
                    isApproved ? 'bg-[rgba(92,124,92,0.1)]' : 'bg-[var(--muted)] opacity-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {isApproved ? (
                      <svg className="w-5 h-5 text-[var(--status-approved)]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    <span className={isApproved ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}>
                      Chapter {chapter.chapterNumber}: {chapter.title}
                    </span>
                  </div>
                  {version && (
                    <span className="text-sm text-[var(--muted-foreground)]">
                      {version.wordCount.toLocaleString()} words
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          
          {approvedCount < chapters.length && (
            <p className="mt-4 text-sm text-[var(--status-in-progress)]">
              ⚠️ {chapters.length - approvedCount} chapter(s) not yet approved and will be excluded
            </p>
          )}
        </CardContent>
      </Card>
      
      {/* Continue to export draft */}
      <Card className="bg-gradient-to-r from-[var(--primary)] to-[var(--color-ink-light)] text-[var(--primary-foreground)]">
        <CardContent className="py-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">Ready to Export Your Draft?</h2>
              <p className="opacity-80">
                Export your manuscript in multiple formats for review or sharing before editorial analysis.
              </p>
            </div>
            <Button
              variant="secondary"
              size="lg"
              onClick={handleContinueToExportDraft}
              className="bg-[var(--primary-foreground)] text-[var(--primary)] hover:opacity-90"
            >
              Go to Export Draft
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          </div>
        </CardContent>
      </Card>
    </StageLayout>
  );
}
