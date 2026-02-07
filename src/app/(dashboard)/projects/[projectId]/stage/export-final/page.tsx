'use client';

import { use, useState, useEffect } from 'react';
import { useProject } from '@/hooks/useProject';
import { useProjectStore } from '@/stores/projectStore';
import { StageLayout } from '@/components/stages';
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { isStageAccessible } from '@/lib/utils';

interface ExportFinalPageProps {
  params: Promise<{ projectId: string }>;
}

export default function ExportFinalPage({ params }: ExportFinalPageProps) {
  const { projectId } = use(params);
  
  const {
    project,
    chapters,
    revisionTasks,
    loading,
    error,
    getApprovedChapterVersion,
    getTotalWordCount,
    getApprovedChaptersCount,
  } = useProject(projectId);
  
  const { loadChapterVersions, loadRevisionTasks, updateProject } = useProjectStore();
  
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  
  // Load versions for all chapters when chapters are available
  useEffect(() => {
    if (chapters.length > 0) {
      chapters.forEach(ch => {
        loadChapterVersions(ch.id);
      });
    }
  }, [chapters, loadChapterVersions]);
  
  // Load revision tasks to check completion
  useEffect(() => {
    if (projectId) {
      loadRevisionTasks(projectId);
    }
  }, [projectId, loadRevisionTasks]);
  
  // Allow access to export-final if revision is accessible OR all revisions are complete
  const allRevisionsComplete = revisionTasks.length > 0 && revisionTasks.every(task => task.status === 'done');
  const canAccessExportFinal = project && (
    isStageAccessible(project.currentStage, 'export-final') ||
    (project.currentStage === 'revision' && allRevisionsComplete)
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
  
  // Check if export-final is accessible
  if (!canAccessExportFinal) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height))]">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--muted)] flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Export Final Not Available</h2>
          <p className="text-[var(--muted-foreground)] max-w-md">
            Please complete all revisions before exporting your final manuscript.
          </p>
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
  
  const handleExport = async (format: 'docx' | 'txt') => {
    setIsExporting(true);
    setExportError(null);
    
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          format,
        }),
      });
      
      if (!response.ok) {
        let errorMessage = 'Export failed';
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch {
          try {
            const text = await response.text();
            errorMessage = text || errorMessage;
          } catch {
            errorMessage = `Export failed with status ${response.status}`;
          }
        }
        throw new Error(errorMessage);
      }
      
      // Check if response is actually a file (blob) or an error
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }
      
      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = project.title 
        ? `${project.title.toLowerCase().replace(/\s+/g, '-')}-final.${format}`
        : `project-${projectId}-final.${format}`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      // Mark export-final as completed (only on first export)
      if (!project.finalExportedAt) {
        await updateProject(projectId, { finalExportedAt: new Date() });
      }
      
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <StageLayout
      projectId={projectId}
      projectTitle={project.title}
      genre={project.genre}
      niche={project.niche}
      currentStage={project.currentStage}
      activeStage="export-final"
      chapters={chapters}
      approvedChapterIds={approvedChapterIds}
      revisionTasks={revisionTasks}
      finalExportedAt={project.finalExportedAt}
      blurbFilled={!!project.blurb?.trim()}
      amazonDescriptionFilled={!!project.amazonDescription?.trim()}
    >
      {/* Error */}
      {(error || exportError) && (
        <div className="mb-6 p-4 bg-[rgba(139,38,53,0.1)] border border-[var(--destructive)] rounded-lg">
          <p className="text-sm text-[var(--destructive)]">{error || exportError}</p>
        </div>
      )}
      
      {/* Success message */}
      <Card className="mb-8 bg-gradient-to-r from-[rgba(16,185,129,0.1)] to-[rgba(16,185,129,0.05)] border-[var(--status-approved)]">
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8 text-[var(--status-approved)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <h2 className="text-xl font-semibold text-[var(--foreground)] mb-1">Manuscript Complete!</h2>
              <p className="text-[var(--muted-foreground)]">
                Your manuscript has been revised and is ready for export. Download your final version in your preferred format.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Final Manuscript Stats */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Final Manuscript Stats</CardTitle>
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
      
      {/* Export buttons */}
      <div className="grid grid-cols-2 gap-4">
        <Button
          variant="secondary"
          size="lg"
          onClick={() => handleExport('docx')}
          disabled={isExporting || approvedCount === 0}
          className="h-auto py-6"
        >
          <div className="flex flex-col items-center gap-2">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="font-semibold">Export as .docx</span>
            <span className="text-xs text-[var(--muted-foreground)]">Microsoft Word format</span>
          </div>
        </Button>
        
        <Button
          variant="secondary"
          size="lg"
          onClick={() => handleExport('txt')}
          disabled={isExporting || approvedCount === 0}
          className="h-auto py-6"
        >
          <div className="flex flex-col items-center gap-2">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="font-semibold">Export as .txt</span>
            <span className="text-xs text-[var(--muted-foreground)]">Plain text format</span>
          </div>
        </Button>
      </div>
    </StageLayout>
  );
}
