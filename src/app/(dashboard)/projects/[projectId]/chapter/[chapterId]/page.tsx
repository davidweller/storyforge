'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProject } from '@/hooks/useProject';
import { useGenerate } from '@/hooks/useGenerate';
import { useProjectStore } from '@/stores/projectStore';
import { TipTapEditor } from '@/components/editor';
import { WorkflowSidebar, ContextDrawer, ContextSection } from '@/components/layout';
import { Button, Badge, Card, CardContent } from '@/components/ui';
import { countWords, cn } from '@/lib/utils';

interface ChapterPageProps {
  params: Promise<{ projectId: string; chapterId: string }>;
}

export default function ChapterPage({ params }: ChapterPageProps) {
  const { projectId, chapterId } = use(params);
  const router = useRouter();
  
  const {
    project,
    documents,
    chapters,
    loading: projectLoading,
    error: projectError,
    getDocumentByType,
    getChapterVersions,
    getLatestChapterVersion,
    getApprovedChapterVersion,
  } = useProject(projectId);
  
  const { loadChapterVersions, createChapterVersion, approveChapterVersion } = useProjectStore();
  const { generate, isGenerating, error: generateError, clearError } = useGenerate();
  
  const [content, setContent] = useState('');
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  
  // Find the current chapter
  const chapter = chapters.find((c) => c.id === chapterId);
  
  // Load chapter versions
  useEffect(() => {
    if (chapterId) {
      loadChapterVersions(chapterId);
    }
  }, [chapterId, loadChapterVersions]);
  
  // Load latest version content
  useEffect(() => {
    const latestVersion = getLatestChapterVersion(chapterId);
    if (latestVersion) {
      setContent(latestVersion.content);
      setCurrentVersionId(latestVersion.id);
      setNotes(latestVersion.notes || '');
    }
  }, [chapterId, getLatestChapterVersion]);
  
  if (projectLoading || !project || !chapter) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height))]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
          <p className="text-[var(--muted-foreground)]">Loading chapter...</p>
        </div>
      </div>
    );
  }
  
  const approvedVersion = getApprovedChapterVersion(chapterId);
  const isApproved = !!approvedVersion;
  const wordCount = countWords(content);
  
  // Get adjacent chapters for navigation
  const currentIndex = chapters.findIndex((c) => c.id === chapterId);
  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;
  
  // Handle chapter generation
  const handleGenerate = async () => {
    clearError();
    
    try {
      const structureDoc = getDocumentByType('structure');
      const charactersDoc = getDocumentByType('characters');
      const endingDoc = getDocumentByType('ending');
      
      // Get previous chapter summary
      let previousChapterSummary: string | undefined;
      if (prevChapter) {
        const prevVersion = getApprovedChapterVersion(prevChapter.id);
        if (prevVersion) {
          previousChapterSummary = prevVersion.content.slice(0, 1000) + '...';
        }
      }
      
      const result = await generate('chapters', {
        genre: project.genre,
        chapterNumber: chapter.chapterNumber,
        chapterTitle: chapter.title,
        beatReference: chapter.beatReference,
        sceneGoal: chapter.sceneGoal,
        pov: chapter.pov,
        charactersReference: charactersDoc?.content || '',
        endingReference: endingDoc?.content || '',
        previousChapterSummary,
        structureContext: structureDoc?.content || '',
        wordTarget: 3000,
      });
      
      setContent(result.content);
      
      // Create new version
      const latestVersion = getLatestChapterVersion(chapterId);
      const newVersion = (latestVersion?.version || 0) + 1;
      
      const versionId = await createChapterVersion({
        chapterId,
        projectId,
        chapterNumber: chapter.chapterNumber,
        version: newVersion,
        content: result.content,
        wordCount: countWords(result.content),
        approved: false,
        parentVersionId: latestVersion?.id,
      });
      
      setCurrentVersionId(versionId);
    } catch (err) {
      // Error handled by hook
    }
  };
  
  // Handle approval
  const handleApprove = async () => {
    if (!currentVersionId) return;
    
    try {
      await approveChapterVersion(currentVersionId);
      
      // Navigate to next chapter or back to chapters list
      if (nextChapter) {
        router.push(`/projects/${projectId}/chapter/${nextChapter.id}`);
      } else {
        router.push(`/projects/${projectId}/stage/chapters`);
      }
    } catch (err) {
      // Handle error
    }
  };
  
  // Handle content change (auto-save)
  const handleContentChange = async (newContent: string) => {
    setContent(newContent);
    // In a real app, implement debounced auto-save here
  };
  
  // Build context content
  const contextContent = (
    <>
      <ContextSection title="Chapter Info">
        <div className="space-y-2 text-sm">
          <p><strong>Beat:</strong> {chapter.beatReference}</p>
          <p><strong>Scene Goal:</strong> {chapter.sceneGoal}</p>
          {chapter.pov && <p><strong>POV:</strong> {chapter.pov}</p>}
        </div>
      </ContextSection>
      
      {getDocumentByType('characters') && (
        <ContextSection title="Characters" defaultExpanded={false}>
          <p className="text-sm text-[var(--muted-foreground)] line-clamp-10">
            {getDocumentByType('characters')?.content.slice(0, 800)}...
          </p>
        </ContextSection>
      )}
      
      {getDocumentByType('ending') && (
        <ContextSection title="Ending Reminder" defaultExpanded={false}>
          <p className="text-sm text-[var(--muted-foreground)] line-clamp-6">
            {getDocumentByType('ending')?.content.slice(0, 500)}...
          </p>
        </ContextSection>
      )}
      
      <ContextSection title="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes for this chapter..."
          className="w-full p-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded resize-y min-h-[100px]"
        />
      </ContextSection>
    </>
  );
  
  // Get approved chapter IDs for sidebar
  const approvedChapterIds = new Set<string>();
  for (const ch of chapters) {
    if (getApprovedChapterVersion(ch.id)) {
      approvedChapterIds.add(ch.id);
    }
  }
  
  return (
    <div className="flex h-[calc(100vh-var(--header-height))]">
      {/* Sidebar */}
      <WorkflowSidebar
        projectId={projectId}
        projectTitle={project.title}
        currentStage={project.currentStage}
        chapters={chapters}
        approvedChapterIds={approvedChapterIds}
      />
      
      {/* Main content */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="border-b border-[var(--border)] bg-[var(--card)] px-8 py-6 lg:px-12 lg:py-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-bold text-[var(--foreground)]">
                  Chapter {chapter.chapterNumber}: {chapter.title}
                </h1>
                <Badge variant={isApproved ? 'success' : 'default'}>
                  {isApproved ? 'Approved' : 'Draft'}
                </Badge>
                <Badge variant="info">Claude</Badge>
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">
                {chapter.beatReference} • {wordCount.toLocaleString()} words
              </p>
            </div>
            
            {/* Chapter navigation */}
            <div className="flex items-center gap-2">
              {prevChapter && (
                <Link href={`/projects/${projectId}/chapter/${prevChapter.id}`}>
                  <Button variant="ghost" size="sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Prev
                  </Button>
                </Link>
              )}
              {nextChapter && (
                <Link href={`/projects/${projectId}/chapter/${nextChapter.id}`}>
                  <Button variant="ghost" size="sm">
                    Next
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
        
        {/* Error display */}
        {(projectError || generateError) && (
          <div className="mx-8 mt-4 p-4 bg-[rgba(139,38,53,0.1)] border border-[var(--destructive)] rounded-lg">
            <p className="text-sm text-[var(--destructive)]">{projectError || generateError}</p>
          </div>
        )}
        
        {/* Editor */}
        <div className="flex-1 p-8 lg:p-12">
          {isGenerating ? (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-12 lg:p-16">
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
                <p className="text-[var(--muted-foreground)]">Writing chapter...</p>
                <p className="text-sm text-[var(--muted-foreground)]">This may take a few minutes...</p>
              </div>
            </div>
          ) : content ? (
            <TipTapEditor
              content={content}
              onChange={handleContentChange}
              editable={!isApproved}
              placeholder="Start writing your chapter..."
            />
          ) : (
            <Card className="text-center py-16">
              <CardContent>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--muted)] rounded-full mb-4">
                  <svg className="w-8 h-8 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                  Generate Chapter {chapter.chapterNumber}
                </h2>
                <p className="text-[var(--muted-foreground)] mb-6 max-w-md mx-auto">
                  Let AI write this chapter based on your story structure, characters, and ending.
                </p>
                <Button onClick={handleGenerate} size="lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate Chapter
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
        
        {/* Action bar */}
        {content && (
          <div className="border-t border-[var(--border)] bg-[var(--card)] px-8 py-6 lg:px-12 lg:py-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={handleGenerate}
                  disabled={isGenerating || isApproved}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowNotes(!showNotes)}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  Notes
                </Button>
              </div>
              
              {isApproved ? (
                <div className="flex items-center gap-2 text-[var(--status-approved)]">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Approved</span>
                </div>
              ) : (
                <Button onClick={handleApprove} disabled={isGenerating || !content}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Approve Chapter
                </Button>
              )}
            </div>
          </div>
        )}
      </main>
      
      {/* Context drawer */}
      <ContextDrawer>
        {contextContent}
      </ContextDrawer>
    </div>
  );
}
