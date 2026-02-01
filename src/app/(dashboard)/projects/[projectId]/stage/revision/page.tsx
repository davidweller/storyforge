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
import type { ChapterVersion } from '@/types';

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
    getDocumentByType,
  } = useProject(projectId);
  
  const { loadRevisionTasks, createChapterVersion, approveChapterVersion, updateRevisionTask, loadChapterVersions } = useProjectStore();
  const { generate, isGenerating, error: generateError, clearError } = useGenerate();
  
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [revisedContent, setRevisedContent] = useState('');
  const [showDiff, setShowDiff] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // Load revision tasks
  useEffect(() => {
    if (projectId) {
      loadRevisionTasks(projectId);
    }
  }, [projectId, loadRevisionTasks]);
  
  // Load chapter versions when chapters are available
  useEffect(() => {
    if (chapters.length > 0) {
      chapters.forEach(ch => {
        loadChapterVersions(ch.id);
      });
    }
  }, [chapters, loadChapterVersions]);
  
  // Load chapter versions when a chapter is selected
  useEffect(() => {
    if (selectedChapterId) {
      loadChapterVersions(selectedChapterId);
    }
  }, [selectedChapterId, loadChapterVersions]);
  
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
  const selectedTask = selectedTaskId 
    ? revisionTasks.find((t) => t.id === selectedTaskId)
    : selectedChapter
    ? revisionTasks.find((t) => t.chapterNumber === selectedChapter.chapterNumber)
    : null;
  
  // Get revision tasks grouped by chapter
  const tasksByChapter = new Map<number, typeof revisionTasks>();
  for (const task of revisionTasks) {
    if (!tasksByChapter.has(task.chapterNumber)) {
      tasksByChapter.set(task.chapterNumber, []);
    }
    tasksByChapter.get(task.chapterNumber)!.push(task);
  }
  
  // Handle Apply button click - show confirmation
  const handleApplyClick = (task: typeof revisionTasks[0]) => {
    const chapter = chapters.find((c) => c.chapterNumber === task.chapterNumber);
    if (!chapter) return;
    
    setSelectedTaskId(task.id);
    setSelectedChapterId(chapter.id);
    setShowConfirmDialog(true);
  };
  
  // Handle confirmed Apply - generate revision
  const handleConfirmApply = async () => {
    console.log('[Revision] handleConfirmApply called:', {
      selectedChapterId,
      selectedTaskId,
      hasSelectedChapter: !!selectedChapter,
      hasOriginalVersion: !!originalVersion,
      hasSelectedTask: !!selectedTask,
    });
    
    if (!selectedChapter) {
      console.error('[Revision] No chapter selected');
      throw new Error('No chapter selected. Please select a chapter first.');
    }
    
    if (!originalVersion) {
      console.error('[Revision] No approved version found for chapter:', selectedChapter.chapterNumber);
      throw new Error(`No approved version found for Chapter ${selectedChapter.chapterNumber}. Please approve a chapter version first.`);
    }
    
    if (!selectedTask) {
      console.error('[Revision] No revision task selected');
      throw new Error('No revision task selected. Please select a task first.');
    }
    
    setShowConfirmDialog(false);
    clearError();
    
    try {
      // Update task status to in_progress
      await updateRevisionTask(selectedTask.id, { status: 'in_progress' });
      
      // Get document references
      const charactersDoc = getDocumentByType('characters');
      const endingDoc = getDocumentByType('ending');
      const structureDoc = getDocumentByType('structure');
      const nicheDoc = getDocumentByType('niche');
      
      console.log('[Revision] Generating revision for chapter', selectedChapter.chapterNumber, {
        taskId: selectedTask.id,
        hasInstructions: selectedTask.instructions.length > 0,
        acceptanceCriteriaCount: selectedTask.acceptanceCriteria.length,
        hasCharacters: !!charactersDoc,
        hasEnding: !!endingDoc,
        hasStructure: !!structureDoc,
        hasNiche: !!nicheDoc,
      });
      
      // Validate original content
      if (!originalVersion.content || originalVersion.content.trim().length === 0) {
        throw new Error('Original chapter content is empty. Cannot generate revision.');
      }
      
      console.log('[Revision] Calling generate API with Sonnet 4.5:', {
        stage: 'revision',
        model: 'claude-sonnet-4-5',
        originalContentLength: originalVersion.content.length,
        instructionsLength: selectedTask.instructions.length,
      });
      
      const result = await generate('revision', {
        genre: project.genre,
        chapterNumber: selectedChapter.chapterNumber,
        chapterTitle: selectedChapter.title,
        originalContent: originalVersion.content,
        revisionInstructions: selectedTask.instructions || 'Review the chapter for overall quality and consistency.',
        acceptanceCriteria: selectedTask.acceptanceCriteria.length > 0
          ? selectedTask.acceptanceCriteria
          : ['The chapter should maintain consistency with established canon and character voices.'],
        charactersReference: charactersDoc?.content || '',
        endingReference: endingDoc?.content || '',
        structureReference: structureDoc?.content || '',
        nicheReference: nicheDoc?.content || '',
      }, {
        model: 'claude-sonnet-4-5', // Explicitly use Sonnet 4.5
      });
      
      console.log('[Revision] API response received:', {
        hasContent: !!result.content,
        contentLength: result.content?.length || 0,
        model: result.model,
        provider: result.provider,
        tokensUsed: result.tokensUsed,
        isSonnet45: result.model === 'claude-sonnet-4-5',
      });
      
      if (!result || !result.content) {
        throw new Error('API returned invalid response: missing content field');
      }
      
      if (result.content.trim().length === 0) {
        throw new Error('API returned empty content. This may indicate an error with the LLM call.');
      }
      
      // Verify Sonnet 4.5 was used
      if (result.model !== 'claude-sonnet-4-5') {
        console.warn('[Revision] Warning: Expected Sonnet 4.5 but got', result.model);
      }
      
      // Check if content is suspiciously similar to original (might indicate no actual revision)
      const originalLength = originalVersion.content.length;
      const revisedLength = result.content.length;
      const lengthDiff = Math.abs(originalLength - revisedLength);
      const lengthSimilarity = lengthDiff / Math.max(originalLength, revisedLength);
      
      console.log('[Revision] Content comparison:', {
        originalLength,
        revisedLength,
        lengthDiff,
        lengthSimilarity: (lengthSimilarity * 100).toFixed(2) + '%',
      });
      
      setRevisedContent(result.content);
    } catch (err) {
      console.error('[Revision] Error generating revision:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('[Revision] Error details:', {
        message: errorMessage,
        error: err,
        stack: err instanceof Error ? err.stack : undefined,
        selectedChapterId,
        selectedTaskId,
        hasSelectedChapter: !!selectedChapter,
        hasOriginalVersion: !!originalVersion,
        hasSelectedTask: !!selectedTask,
      });
      
      // Re-open the dialog if it was a validation error (so user can try again)
      if (errorMessage.includes('No chapter selected') || 
          errorMessage.includes('No approved version') || 
          errorMessage.includes('No revision task')) {
        setShowConfirmDialog(true);
      }
      
      // Error is also handled by hook, but we ensure it's logged
      // The error state will be set by the useGenerate hook
      // Re-throw to ensure the hook's error handling is triggered
      throw err;
    }
  };
  
  // Handle approval of revision
  const handleApproveRevision = async () => {
    if (!selectedChapter || !revisedContent || !selectedTask) return;
    
    try {
      // Create new version
      const latestVersion = getLatestChapterVersion(selectedChapter.id);
      const newVersion = (latestVersion?.version || 0) + 1;
      
      const versionData: Omit<ChapterVersion, 'id' | 'createdAt'> = {
        chapterId: selectedChapter.id,
        projectId,
        chapterNumber: selectedChapter.chapterNumber,
        version: newVersion,
        content: revisedContent,
        wordCount: revisedContent.split(/\s+/).length,
        approved: true,
      };
      
      // Only include parentVersionId if it exists (Firestore doesn't allow undefined)
      if (latestVersion?.id) {
        versionData.parentVersionId = latestVersion.id;
      }
      
      await createChapterVersion(versionData);
      
      // Mark revision task as done
      await updateRevisionTask(selectedTask.id, { status: 'done' });
      
      console.log('[Revision] Revision approved and task marked as done:', selectedTask.id);
      
      // Reset state
      setRevisedContent('');
      setSelectedChapterId(null);
      setSelectedTaskId(null);
    } catch (err) {
      console.error('[Revision] Error approving revision:', err);
      throw err;
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
          <p><strong>Completed:</strong> {revisionTasks.filter((t) => t.status === 'done').length} chapters</p>
          <p><strong>In Progress:</strong> {revisionTasks.filter((t) => t.status === 'in_progress').length} chapters</p>
        </div>
      </ContextSection>
      
      {selectedTask && (
        <ContextSection title="Revision Task">
          <div className="space-y-2 text-sm">
            <p className="text-[var(--foreground)]">
              <strong>Status:</strong> {selectedTask.status === 'queued' ? 'Queued' : selectedTask.status === 'in_progress' ? 'In Progress' : 'Complete'}
            </p>
            {selectedTask.acceptanceCriteria.length > 0 && (
              <div>
                <p className="font-medium text-[var(--foreground)] mb-1">Acceptance Criteria:</p>
                <ul className="list-disc list-inside space-y-1 text-xs text-[var(--muted-foreground)]">
                  {selectedTask.acceptanceCriteria.slice(0, 3).map((criterion, idx) => (
                    <li key={idx}>{criterion}</li>
                  ))}
                  {selectedTask.acceptanceCriteria.length > 3 && (
                    <li className="text-[var(--muted-foreground)]">
                      +{selectedTask.acceptanceCriteria.length - 3} more
                    </li>
                  )}
                </ul>
              </div>
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
                Review and apply revisions by chapter. Click "Apply" to generate revisions using Sonnet 4.5.
              </p>
              
              {revisionTasks.length === 0 ? (
                <div className="text-center py-8 text-[var(--muted-foreground)]">
                  <p>No revision tasks found. Please create a revision queue from the editorial page.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Array.from(tasksByChapter.entries())
                    .sort(([a], [b]) => a - b)
                    .map(([chapterNumber, tasks]) => {
                      const chapter = chapters.find((c) => c.chapterNumber === chapterNumber);
                      if (!chapter) return null;
                      
                      const queuedTask = tasks.find((t) => t.status === 'queued');
                      const inProgressTask = tasks.find((t) => t.status === 'in_progress');
                      const doneTask = tasks.find((t) => t.status === 'done');
                      const activeTask = inProgressTask || queuedTask;
                      const isComplete = !queuedTask && !inProgressTask && doneTask;
                      
                      return (
                        <div
                          key={chapterNumber}
                          className={cn(
                            'p-4 rounded-lg border',
                            isComplete
                              ? 'bg-[rgba(92,124,92,0.1)] border-[var(--status-approved)]'
                              : 'bg-[rgba(212,160,58,0.1)] border-[var(--status-in-progress)]'
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              <div className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
                                isComplete
                                  ? 'bg-[var(--status-approved)] text-white'
                                  : 'bg-[var(--status-in-progress)] text-white'
                              )}>
                                {chapterNumber}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-[var(--foreground)]">{chapter.title}</p>
                                {activeTask && (
                                  <div className="mt-2 space-y-1">
                                    <p className="text-sm text-[var(--muted-foreground)]">
                                      {activeTask.instructions.substring(0, 200)}
                                      {activeTask.instructions.length > 200 ? '...' : ''}
                                    </p>
                                    {activeTask.acceptanceCriteria.length > 0 && (
                                      <p className="text-xs text-[var(--muted-foreground)]">
                                        {activeTask.acceptanceCriteria.length} acceptance criteria
                                      </p>
                                    )}
                                  </div>
                                )}
                                {isComplete && (
                                  <p className="text-sm text-[var(--muted-foreground)] mt-1">
                                    Revision completed
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {activeTask && activeTask.status === 'queued' && (
                                <Button
                                  onClick={() => handleApplyClick(activeTask)}
                                  size="sm"
                                >
                                  Apply
                                </Button>
                              )}
                              {activeTask && activeTask.status === 'in_progress' && (
                                <Button
                                  onClick={() => {
                                    setSelectedTaskId(activeTask.id);
                                    setSelectedChapterId(chapter.id);
                                  }}
                                  variant="secondary"
                                  size="sm"
                                >
                                  View Progress
                                </Button>
                              )}
                              {isComplete && (
                                <Badge variant="success" className="px-3 py-1">
                                  Complete
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
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
          
          {/* Revision task details */}
          {selectedTask && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Revision Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)] mb-2">Instructions:</p>
                    <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">
                      {selectedTask.instructions}
                    </p>
                  </div>
                  {selectedTask.acceptanceCriteria.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground)] mb-2">Acceptance Criteria:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-[var(--foreground)]">
                        {selectedTask.acceptanceCriteria.map((criterion, idx) => (
                          <li key={idx}>{criterion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="pt-2 border-t border-[var(--border)]">
                    <Badge variant={selectedTask.status === 'queued' ? 'warning' : selectedTask.status === 'in_progress' ? 'info' : 'success'}>
                      {selectedTask.status === 'queued' ? 'Queued' : selectedTask.status === 'in_progress' ? 'In Progress' : 'Complete'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Confirmation dialog */}
          {showConfirmDialog && selectedTask && (
            <Card className="mb-6 border-[var(--accent)]">
              <CardHeader>
                <CardTitle>Confirm Apply Revision</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--foreground)] mb-4">
                  Generate revision for Chapter {selectedChapter?.chapterNumber}: {selectedChapter?.title} using Sonnet 4.5?
                </p>
                <p className="text-xs text-[var(--muted-foreground)] mb-4">
                  This will create a revised version of the chapter based on the revision instructions. You'll be able to review and approve the changes.
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleConfirmApply}
                    loading={isGenerating}
                    disabled={isGenerating}
                  >
                    Yes, Apply Revision
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowConfirmDialog(false);
                      setSelectedTaskId(null);
                      setSelectedChapterId(null);
                    }}
                    disabled={isGenerating}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Generate revision in progress */}
          {!showConfirmDialog && !revisedContent && selectedTask && selectedTask.status === 'in_progress' && (
            <Card className="text-center py-12">
              <CardContent>
                <div className="w-12 h-12 border-4 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                  Generating Revision...
                </h3>
                <p className="text-[var(--muted-foreground)] mb-6 max-w-md mx-auto">
                  Sonnet 4.5 is revising this chapter based on the revision instructions. This may take a minute.
                </p>
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
                  <Button 
                    variant="secondary" 
                    onClick={() => {
                      if (selectedTask) {
                        setShowConfirmDialog(true);
                      }
                    }} 
                    disabled={isGenerating || !selectedTask}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Regenerate
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      setRevisedContent('');
                      if (selectedTask) {
                        updateRevisionTask(selectedTask.id, { status: 'queued' });
                      }
                    }}
                  >
                    Reject
                  </Button>
                </div>
                
                <Button onClick={handleApproveRevision} disabled={!selectedTask}>
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
