'use client';

import { use, useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProject } from '@/hooks/useProject';
import { useProjectStore } from '@/stores/projectStore';
import { StageLayout, EmptyContent } from '@/components/stages';
import { Button, Card, CardContent, Badge } from '@/components/ui';
import { cn, countWords } from '@/lib/utils';

interface ChaptersPageProps {
  params: Promise<{ projectId: string }>;
}

interface ChapterOutline {
  chapterNumber: number;
  title: string;
  beatReference: string;
  sceneGoal: string;
  pov?: string;
  wordTarget?: number;
}

// Parse chapter outlines from markdown table
function parseChapterOutlines(content: string): ChapterOutline[] {
  const outlines: ChapterOutline[] = [];
  const lines = content.split('\n');
  
  // Find the table section
  let inTable = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Look for table header
    if (line.includes('| Ch #') || line.includes('| Ch#') || line.includes('| Chapter')) {
      inTable = true;
      continue; // Skip header
    }
    
    // Skip separator line
    if (inTable && line.match(/^\|[\s\-:]+\|/)) {
      continue;
    }
    
    // Parse table rows
    if (inTable && line.startsWith('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c);
      
      if (cells.length >= 4) {
        const chapterNumber = parseInt(cells[0], 10);
        if (!isNaN(chapterNumber)) {
          const title = cells[1] || '';
          const beatReference = cells[2] || '';
          const sceneGoal = cells[3] || '';
          const pov = cells[4] || undefined;
          const wordTargetMatch = cells[5]?.match(/~?(\d+)/);
          const wordTarget = wordTargetMatch ? parseInt(wordTargetMatch[1], 10) : undefined;
          
          outlines.push({
            chapterNumber,
            title,
            beatReference,
            sceneGoal,
            pov,
            wordTarget,
          });
        }
      }
    }
    
    // Stop at end of table or start of narrative section
    if (inTable && (line.startsWith('##') || line.startsWith('**'))) {
      break;
    }
  }
  
  return outlines;
}

export default function ChaptersPage({ params }: ChaptersPageProps) {
  const { projectId } = use(params);
  const router = useRouter();
  
  const {
    project,
    documents,
    chapters,
    loading,
    error,
    getDocumentByType,
    getLatestDocumentByType,
    getApprovedChapterVersion,
    getTotalWordCount,
    getApprovedChaptersCount,
  } = useProject(projectId);
  
  const { createChapter, loadChapterVersions } = useProjectStore();
  
  // Load versions for all chapters when chapters are available
  useEffect(() => {
    if (chapters.length > 0) {
      chapters.forEach(ch => {
        loadChapterVersions(ch.id);
      });
    }
  }, [chapters, loadChapterVersions]);
  
  // Parse chapter outlines (use latest version, not just approved)
  const chapterOutlines = useMemo(() => {
    const outlinesDoc = getLatestDocumentByType('chapter-outlines');
    if (!outlinesDoc) return [];
    return parseChapterOutlines(outlinesDoc.content);
  }, [documents, getLatestDocumentByType]);
  
  // Find next uncompleted chapter
  const nextChapter = useMemo(() => {
    if (chapterOutlines.length === 0) return null;
    
    // Get set of completed chapter numbers (chapters with approved versions)
    const completedNumbers = new Set<number>();
    for (const ch of chapters) {
      if (getApprovedChapterVersion(ch.id)) {
        completedNumbers.add(ch.chapterNumber);
      }
    }
    
    // Find first outline that doesn't have a completed chapter
    for (const outline of chapterOutlines) {
      if (!completedNumbers.has(outline.chapterNumber)) {
        return outline;
      }
    }
    
    return null;
  }, [chapterOutlines, chapters, getApprovedChapterVersion]);
  
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
  const totalChapters = chapterOutlines.length || chapters.length;
  
  // Get approved chapter IDs
  const approvedChapterIds = new Set<string>();
  for (const ch of chapters) {
    if (getApprovedChapterVersion(ch.id)) {
      approvedChapterIds.add(ch.id);
    }
  }
  
  // Handle writing next chapter
  const handleWriteNextChapter = async () => {
    if (!nextChapter) return;
    
    try {
      // Check if chapter already exists (but not approved)
      let existingChapter = chapters.find(ch => ch.chapterNumber === nextChapter.chapterNumber);
      
      if (!existingChapter) {
        // Create new chapter record
        const chapterId = await createChapter({
          projectId,
          chapterNumber: nextChapter.chapterNumber,
          title: nextChapter.title,
          beatReference: nextChapter.beatReference,
          sceneGoal: nextChapter.sceneGoal,
          pov: nextChapter.pov,
        });
        
        // Navigate to chapter page
        router.push(`/projects/${projectId}/chapter/${chapterId}`);
      } else {
        // Navigate to existing chapter
        router.push(`/projects/${projectId}/chapter/${existingChapter.id}`);
      }
    } catch (err) {
      console.error('Error creating chapter:', err);
    }
  };
  
  // Check if chapter outlines exist
  const hasOutlines = chapterOutlines.length > 0;
  
  return (
    <StageLayout
      projectId={projectId}
      projectTitle={project.title}
      genre={project.genre}
      niche={project.niche}
      currentStage={project.currentStage}
      activeStage="chapters"
      chapters={chapters}
      approvedChapterIds={approvedChapterIds}
    >
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-[var(--foreground)]">{totalChapters}</div>
            <p className="text-sm text-[var(--muted-foreground)]">Total Chapters</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-[var(--status-approved)]">{approvedCount}</div>
            <p className="text-sm text-[var(--muted-foreground)]">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-[var(--foreground)]">{totalWordCount.toLocaleString()}</div>
            <p className="text-sm text-[var(--muted-foreground)]">Words</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Write Next Chapter Button */}
      {hasOutlines ? (
        nextChapter ? (
          <div className="mb-8">
            <EmptyContent
              title={`Write Chapter ${nextChapter.chapterNumber}`}
              description={nextChapter.title ? `Next up: "${nextChapter.title}"` : `Ready to write the next chapter`}
              actionLabel={`Write Chapter ${nextChapter.chapterNumber}`}
              onAction={handleWriteNextChapter}
              isLoading={false}
            />
          </div>
        ) : (
          <div className="mb-8 p-6 bg-[rgba(16,185,129,0.1)] border border-[var(--status-approved)] rounded-lg text-center">
            <h3 className="font-semibold text-[var(--status-approved)] mb-2">All Chapters Complete!</h3>
            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              You've written all {totalChapters} chapters. Ready to compile your manuscript?
            </p>
            <Link href={`/projects/${projectId}/stage/compilation`}>
              <Button>
                Continue to Compilation
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            </Link>
          </div>
        )
      ) : (
        <div className="mb-8 p-6 bg-[rgba(245,158,11,0.1)] border border-[var(--status-in-progress)] rounded-lg text-center">
          <h3 className="font-semibold text-[var(--status-in-progress)] mb-2">Chapter Outlines Required</h3>
          <p className="text-sm text-[var(--muted-foreground)] mb-4">
            Please complete the Chapter Outlines stage first to generate chapter details.
          </p>
          <Link href={`/projects/${projectId}/stage/chapter-outlines`}>
            <Button variant="secondary">
              Go to Chapter Outlines
            </Button>
          </Link>
        </div>
      )}
      
      {/* Completed Chapters List */}
      {chapters.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-[var(--foreground)] mb-4">Written Chapters</h3>
          {chapters
            .sort((a, b) => a.chapterNumber - b.chapterNumber)
            .map((chapter) => {
              const isApproved = approvedChapterIds.has(chapter.id);
              const version = getApprovedChapterVersion(chapter.id);
              
              return (
                <Link
                  key={chapter.id}
                  href={`/projects/${projectId}/chapter/${chapter.id}`}
                  className="block"
                >
                  <Card className={cn(
                    'transition-all duration-200 hover:shadow-md hover:border-[var(--ring)]',
                    isApproved && 'border-l-4 border-l-[var(--status-approved)]'
                  )}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold',
                            isApproved
                              ? 'bg-[rgba(92,124,92,0.2)] text-[var(--status-approved)]'
                              : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                          )}>
                            {chapter.chapterNumber}
                          </div>
                          <div>
                            <h4 className="font-semibold text-[var(--foreground)]">
                              {chapter.title}
                            </h4>
                            <p className="text-sm text-[var(--muted-foreground)]">
                              {chapter.beatReference}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {version && (
                            <span className="text-sm text-[var(--muted-foreground)]">
                              {version.wordCount.toLocaleString()} words
                            </span>
                          )}
                          <Badge variant={isApproved ? 'success' : 'default'}>
                            {isApproved ? 'Approved' : 'Draft'}
                          </Badge>
                          <svg className="w-5 h-5 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
        </div>
      )}
    </StageLayout>
  );
}
