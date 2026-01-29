'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useProject } from '@/hooks/useProject';
import { useGenerate } from '@/hooks/useGenerate';
import { useProjectStore } from '@/stores/projectStore';
import { StageLayout } from '@/components/stages';
import { ContextSection } from '@/components/layout';
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import * as Diff from 'diff';

interface RevisionPageProps {
  params: Promise<{ projectId: string }>;
}

export default function RevisionPage({ params }: RevisionPageProps) {
  const { projectId } = use(params);
  
  const {
    project,
    chapters,
    revisionTasks,
    editorialIssues,
    loading: projectLoading,
    error: projectError,
    getApprovedChapterVersion,
    getLatestChapterVersion,
    getPendingRevisionTasksCount,
  } = useProject(projectId);
  
  const { loadRevisionTasks, createChapterVersion, approveChapterVersion, updateRevisionTask } = useProjectStore();
  const { generate, isGenerating, error: generateError, clearError } = useGenerate();
  
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [revisedContent, setRevisedContent] = useState('');
  const [showDiff, setShowDiff] = useState(true);
  
  // Load revision tasks
  useEffect(() => {
    if (projectId) {
      loadRevisionTasks(projectId);
    }
  }, [projectId, loadRevisionTasks]);
  
  if (projectLoading || !project) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height))]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
          <p className="text-[var(--muted-foreground)]">Loading...</p>
        </div>
      </div>
    );
  }
  
  const pendingCount = getPendingRevisionTasksCount();
  
  // Get approved chapter IDs
  const approvedChapterIds = new Set<string>();
  for (const ch of chapters) {
    if (getApprovedChapterVersion(ch.id)) {
      approvedChapterIds.add(ch.id);
    }
  }
  
  // Get selected chapter and its data
  const selectedChapter = chapters.find((c) => c.id === selectedChapterId);
  const originalVersion = selectedChapter ? getApprovedChapterVersion(selectedChapter.id) : null;
  const chapterIssues = selectedChapter
    ? editorialIssues.filter((i) => i.chapterNumber === selectedChapter.chapterNumber && i.status === 'open')
    : [];
  
  // Handle revision generation
  const handleGenerateRevision = async () => {
    if (!selectedChapter || !originalVersion) return;
    clearError();
    
    try {
      const { getDocumentByType } = useProject(projectId);
      
      // Build revision instructions from issues
      const instructions = chapterIssues
        .map((i) => `- ${i.category}: ${i.description}\n  Fix: ${i.recommendedFix}`)
        .join('\n');
      
      const result = await generate('revision' as any, {
        genre: project.genre,
        chapterNumber: selectedChapter.chapterNumber,
        chapterTitle: selectedChapter.title,
        originalContent: originalVersion.content,
        revisionInstructions: instructions,
        acceptanceCriteria: chapterIssues.map((i) => i.recommendedFix),
      });
      
      setRevisedContent(result.content);
    } catch (err) {
      // Error handled by hook
    }
  };
  
  // Handle approval of revision
  const handleApproveRevision = async () => {
    if (!selectedChapter || !revisedContent) return;
    
    try {
      // Create new version
      const latestVersion = getLatestChapterVersion(selectedChapter.id);
      const newVersion = (latestVersion?.version || 0) + 1;
      
      const versionId = await createChapterVersion({
        chapterId: selectedChapter.id,
        projectId,
        chapterNumber: selectedChapter.chapterNumber,
        version: newVersion,
        content: revisedContent,
        wordCount: revisedContent.split(/\s+/).length,
        approved: true,
        parentVersionId: latestVersion?.id,
      });
      
      // Mark issues as resolved
      // (In production, this would update the specific issues)
      
      // Reset state
      setRevisedContent('');
      setSelectedChapterId(null);
    } catch (err) {
      // Handle error
    }
  };
  
  // Generate diff view
  const renderDiff = () => {
    if (!originalVersion || !revisedContent) return null;
    
    const diff = Diff.diffWords(
      originalVersion.content.replace(/<[^>]+>/g, ''),
      revisedContent.replace(/<[^>]+>/g, '')
    );
    
    return (
      <div className="font-mono text-sm whitespace-pre-wrap">
        {diff.map((part, i) => (
          <span
            key={i}
            className={cn(
              part.added && 'bg-green-100 text-green-800',
              part.removed && 'bg-red-100 text-red-800 line-through'
            )}
          >
            {part.value}
          </span>
        ))}
      </div>
    );
  };
  
  // Context content
  const contextContent = (
    <>
      <ContextSection title="Revision Progress">
        <div className="space-y-2 text-sm">
          <p><strong>Pending:</strong> {pendingCount} chapters</p>
          <p><strong>Completed:</strong> {chapters.length - pendingCount} chapters</p>
        </div>
      </ContextSection>
      
      {selectedChapter && (
        <ContextSection title="Chapter Issues">
          <div className="space-y-2">
            {chapterIssues.map((issue) => (
              <div key={issue.id} className="text-sm p-2 bg-[var(--muted)] rounded">
                <Badge variant="warning" className="mb-1">{issue.category}</Badge>
                <p className="text-[var(--foreground)]">{issue.description}</p>
              </div>
            ))}
            {chapterIssues.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)]">No open issues</p>
            )}
          </div>
        </ContextSection>
      )}
    </>
  );
  
  return (
    <StageLayout
      projectId={projectId}
      projectTitle={project.title}
      genre={project.genre}
      niche={project.niche}
      currentStage={project.currentStage}
      activeStage="revision"
      chapters={chapters}
      approvedChapterIds={approvedChapterIds}
      contextContent={contextContent}
    >
      {/* Error */}
      {(projectError || generateError) && (
        <div className="mb-6 p-4 bg-[rgba(139,38,53,0.1)] border border-[var(--destructive)] rounded-lg">
          <p className="text-sm text-[var(--destructive)]">{projectError || generateError}</p>
        </div>
      )}
      
      {/* Revision queue */}
      {!selectedChapterId && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Revision Queue</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[var(--muted-foreground)] mb-4">
                Select a chapter to review and apply revisions based on editorial feedback.
              </p>
              
              <div className="space-y-2">
                {chapters.map((chapter) => {
                  const issues = editorialIssues.filter(
                    (i) => i.chapterNumber === chapter.chapterNumber && i.status === 'open'
                  );
                  const hasIssues = issues.length > 0;
                  
                  return (
                    <button
                      key={chapter.id}
                      onClick={() => setSelectedChapterId(chapter.id)}
                      className={cn(
                        'w-full flex items-center justify-between p-4 rounded-lg transition-all text-left',
                        hasIssues
                          ? 'bg-[rgba(212,160,58,0.1)] hover:bg-[rgba(212,160,58,0.2)]'
                          : 'bg-[rgba(92,124,92,0.1)] hover:bg-[rgba(92,124,92,0.2)]'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                          hasIssues
                            ? 'bg-[var(--status-in-progress)] text-white'
                            : 'bg-[var(--status-approved)] text-white'
                        )}>
                          {chapter.chapterNumber}
                        </div>
                        <div>
                          <p className="font-medium text-[var(--foreground)]">{chapter.title}</p>
                          <p className="text-sm text-[var(--muted-foreground)]">
                            {issues.length} open issue{issues.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <Badge variant={hasIssues ? 'warning' : 'success'}>
                        {hasIssues ? 'Needs Revision' : 'Complete'}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          
          {pendingCount === 0 && (
            <Card className="bg-[rgba(92,124,92,0.1)] border-[var(--status-approved)]">
              <CardContent className="py-8 text-center">
                <svg className="w-16 h-16 mx-auto text-[var(--status-approved)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                  All Revisions Complete!
                </h3>
                <p className="text-[var(--muted-foreground)] mb-4">
                  Your manuscript has been revised. You can now export the final version.
                </p>
                <Link href={`/projects/${projectId}/stage/compilation`}>
                  <Button>
                    Go to Export
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </>
      )}
      
      {/* Revision workspace */}
      {selectedChapterId && selectedChapter && (
        <>
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" onClick={() => setSelectedChapterId(null)}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Queue
            </Button>
            <h2 className="text-lg font-semibold">
              Chapter {selectedChapter.chapterNumber}: {selectedChapter.title}
            </h2>
          </div>
          
          {/* Issues checklist */}
          {chapterIssues.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Issues to Address</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {chapterIssues.map((issue) => (
                    <div key={issue.id} className="flex items-start gap-3 p-3 bg-[var(--muted)] rounded">
                      <Badge variant="warning">{issue.category}</Badge>
                      <div className="flex-1">
                        <p className="text-sm text-[var(--foreground)]">{issue.description}</p>
                        <p className="text-xs text-[var(--muted-foreground)] mt-1">
                          Recommended: {issue.recommendedFix}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Generate revision */}
          {!revisedContent && (
            <Card className="text-center py-12">
              <CardContent>
                <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                  Generate Revised Chapter
                </h3>
                <p className="text-[var(--muted-foreground)] mb-6 max-w-md mx-auto">
                  AI will revise this chapter based on the editorial feedback while preserving your voice and style.
                </p>
                <Button onClick={handleGenerateRevision} loading={isGenerating} size="lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate Revision
                </Button>
              </CardContent>
            </Card>
          )}
          
          {/* Diff view */}
          {revisedContent && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant={showDiff ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setShowDiff(true)}
                  >
                    Diff View
                  </Button>
                  <Button
                    variant={!showDiff ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setShowDiff(false)}
                  >
                    Side by Side
                  </Button>
                </div>
              </div>
              
              {showDiff ? (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Changes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[500px] overflow-y-auto p-4 bg-[var(--background)] rounded">
                      {renderDiff()}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Original</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-[500px] overflow-y-auto text-sm">
                        <div dangerouslySetInnerHTML={{ __html: originalVersion?.content || '' }} />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Revised</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-[500px] overflow-y-auto text-sm">
                        <div dangerouslySetInnerHTML={{ __html: revisedContent }} />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
              
              {/* Actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="secondary" onClick={handleGenerateRevision} disabled={isGenerating}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Regenerate
                  </Button>
                  <Button variant="ghost" onClick={() => setRevisedContent('')}>
                    Reject
                  </Button>
                </div>
                
                <Button onClick={handleApproveRevision}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Approve Revision
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </StageLayout>
  );
}
