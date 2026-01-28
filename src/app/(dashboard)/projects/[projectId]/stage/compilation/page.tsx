'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProject } from '@/hooks/useProject';
import { useProjectStore } from '@/stores/projectStore';
import { StageLayout } from '@/components/stages';
import { ContextSection } from '@/components/layout';
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import { auth } from '@/lib/firebase/config';
import { cn, getNextStage } from '@/lib/utils';
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
  
  const { advanceStage } = useProjectStore();
  
  const [includeFrontMatter, setIncludeFrontMatter] = useState(true);
  const [includeBackMatter, setIncludeBackMatter] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  
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
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      
      const token = await user.getIdToken();
      
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
          format,
          includeFrontMatter,
          includeBackMatter,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Export failed');
      }
      
      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.title.toLowerCase().replace(/\s+/g, '-')}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };
  
  const handleContinueToEditorial = async () => {
    try {
      const nextStage = getNextStage('compilation');
      if (nextStage && project.currentStage === 'compilation') {
        await advanceStage(projectId, nextStage as WorkflowStage);
      }
      router.push(`/projects/${projectId}/stage/editorial`);
    } catch (err) {
      // Handle error
    }
  };
  
  // Context content
  const contextContent = (
    <>
      <ContextSection title="Manuscript Stats">
        <div className="space-y-2 text-sm">
          <p><strong>Chapters:</strong> {approvedCount}</p>
          <p><strong>Total Words:</strong> {totalWordCount.toLocaleString()}</p>
          <p><strong>Est. Pages:</strong> ~{Math.ceil(totalWordCount / 250)}</p>
        </div>
      </ContextSection>
    </>
  );
  
  return (
    <StageLayout
      projectId={projectId}
      projectTitle={project.title}
      currentStage={project.currentStage}
      activeStage="compilation"
      chapters={chapters}
      approvedChapterIds={approvedChapterIds}
      contextContent={contextContent}
    >
      {/* Error */}
      {(error || exportError) && (
        <div className="mb-6 p-4 bg-[rgba(139,38,53,0.1)] border border-[var(--destructive)] rounded-lg">
          <p className="text-sm text-[var(--destructive)]">{error || exportError}</p>
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
      
      {/* Export options */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Export Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeFrontMatter}
                onChange={(e) => setIncludeFrontMatter(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--border)]"
              />
              <div>
                <p className="font-medium text-[var(--foreground)]">Include Front Matter</p>
                <p className="text-sm text-[var(--muted-foreground)]">Title page with book title and genre</p>
              </div>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeBackMatter}
                onChange={(e) => setIncludeBackMatter(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--border)]"
              />
              <div>
                <p className="font-medium text-[var(--foreground)]">Include Back Matter</p>
                <p className="text-sm text-[var(--muted-foreground)]">&quot;The End&quot; marker</p>
              </div>
            </label>
          </div>
        </CardContent>
      </Card>
      
      {/* Export buttons */}
      <div className="grid grid-cols-2 gap-4 mb-8">
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
      
      {/* Continue to editorial */}
      <Card className="bg-gradient-to-r from-[var(--primary)] to-[var(--color-ink-light)] text-[var(--primary-foreground)]">
        <CardContent className="py-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">Ready for Editorial Review?</h2>
              <p className="opacity-80">
                Get AI-powered feedback on your manuscript to identify areas for improvement.
              </p>
            </div>
            <Button
              variant="secondary"
              size="lg"
              onClick={handleContinueToEditorial}
              className="bg-[var(--primary-foreground)] text-[var(--primary)] hover:opacity-90"
            >
              Continue to Editorial
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
