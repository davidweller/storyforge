'use client';

import { use, useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProject } from '@/hooks/useProject';
import { useProjectStore } from '@/stores/projectStore';
import { StageLayout, EmptyContent } from '@/components/stages';
import { Button, Card, CardContent, Badge } from '@/components/ui';
import { cn, countWords, capOutlineWordTargets } from '@/lib/utils';
import { TARGET_MANUSCRIPT_WORDS, FULL_AUTO_USE_SCENE_PIPELINE_DEFAULT } from '@/lib/constants';
import { parseChapterOutlines } from '@/lib/generation/schemas';
import { estimateFullAutoTokens, formatTokenRange } from '@/lib/cost/preflight';

interface ChaptersPageProps {
  params: Promise<{ projectId: string }>;
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
    updateProject,
  } = useProject(projectId);
  
  const { createChapter, loadChapterVersions } = useProjectStore();
  const [startingChapter1, setStartingChapter1] = useState(false);
  const [startingAutoMode, setStartingAutoMode] = useState(false);
  const faCkKey = `novel-full-auto-checkpoints-${projectId}`;
  const [faCheckpoints, setFaCheckpoints] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setFaCheckpoints(window.localStorage.getItem(faCkKey) === '1');
  }, [faCkKey]);

  // Load versions for all chapters when chapters are available
  useEffect(() => {
    if (chapters.length > 0) {
      chapters.forEach(ch => {
        loadChapterVersions(ch.id);
      });
    }
  }, [chapters, loadChapterVersions]);
  
  // Outlines doc: use latest by version (safe sort for undefined version)
  const outlinesDoc = getLatestDocumentByType('chapter-outlines');
  // Parse chapter outlines (use latest version, not just approved)
  const chapterOutlines = useMemo(() => {
    if (!outlinesDoc?.content) return [];
    const parsed = parseChapterOutlines(outlinesDoc.content);
    return capOutlineWordTargets(parsed, TARGET_MANUSCRIPT_WORDS);
  }, [outlinesDoc]);

  const fullAutoPreflight = useMemo(() => {
    const n = Math.max(1, chapterOutlines.length);
    const est = estimateFullAutoTokens({
      chapterCount: n,
      useScenePipelineForChapters: FULL_AUTO_USE_SCENE_PIPELINE_DEFAULT,
    });
    return formatTokenRange(est.low, est.high);
  }, [chapterOutlines.length]);
  
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
  
  // Handle writing next chapter (from parsed outline or placeholder for chapter 1)
  const handleWriteNextChapter = async () => {
    if (!nextChapter) return;
    
    try {
      // Check if chapter already exists (but not approved)
      const existingChapter = chapters.find(ch => ch.chapterNumber === nextChapter.chapterNumber);
      
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

  // Start writing chapter 1 when we have an outlines doc but parser returned no list (fallback so user can always write)
  const handleStartChapter1 = async () => {
    try {
      setStartingChapter1(true);
      const existing = chapters.find(ch => ch.chapterNumber === 1);
      if (existing) {
        router.push(`/projects/${projectId}/chapter/${existing.id}`);
        return;
      }
      const chapterId = await createChapter({
        projectId,
        chapterNumber: 1,
        title: 'Chapter 1',
        beatReference: '',
        sceneGoal: '',
        pov: undefined,
      });
      router.push(`/projects/${projectId}/chapter/${chapterId}`);
    } catch (err) {
      console.error('Error creating chapter:', err);
    } finally {
      setStartingChapter1(false);
    }
  };

  const handleStartAutoMode = async () => {
    try {
      setStartingAutoMode(true);
      if (!project.fullAutoMode) {
        await updateProject({ fullAutoMode: true });
      }
      router.push(`/projects/${projectId}/full-auto`);
    } catch (err) {
      console.error('Error starting auto mode:', err);
    } finally {
      setStartingAutoMode(false);
    }
  };
  
  // We have an outlines doc with content (even if parser returned 0)
  const hasOutlinesDoc = (outlinesDoc?.content?.trim()?.length ?? 0) > 0;
  // We have a parsed list of outlines for "next chapter" and counts
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
      blurbFilled={!!project.blurb?.trim()}
      amazonDescriptionFilled={!!project.amazonDescription?.trim()}
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
            <div className="text-3xl font-bold text-[var(--foreground)]">{totalWordCount.toLocaleString()} <span className="text-lg font-normal text-[var(--muted-foreground)]">/ {TARGET_MANUSCRIPT_WORDS.toLocaleString()}</span></div>
            <p className="text-sm text-[var(--muted-foreground)]">Words (manuscript budget)</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Write chapters: main CTA and where to find it */}
      <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Write chapters</h2>
      {hasOutlinesDoc && (
        <div className="mb-6 p-4 rounded-lg border border-[var(--border)] bg-[var(--card)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-semibold text-[var(--foreground)]">Auto mode</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Let StoryForge run chapters automatically from your current point.
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-2">
                Preflight estimate (includes prompt overhead, not exact):{' '}
                <strong className="text-[var(--foreground)]">{fullAutoPreflight}</strong>
              </p>
              <label className="mt-3 flex items-start gap-2 text-sm text-[var(--foreground)] cursor-pointer max-w-xl">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={faCheckpoints}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setFaCheckpoints(v);
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem(faCkKey, v ? '1' : '0');
                    }
                  }}
                />
                <span>
                  Step-through checkpoints — pause after ending, title, outlines, and the first written chapter so you
                  can review before the rest runs.
                </span>
              </label>
            </div>
            <Button
              variant="secondary"
              onClick={handleStartAutoMode}
              disabled={startingAutoMode}
            >
              {startingAutoMode
                ? 'Opening Auto Mode...'
                : (project.fullAutoMode ? 'Resume Auto Mode' : 'Start Auto Mode')}
            </Button>
          </div>
        </div>
      )}
      {hasOutlinesDoc ? (
        hasOutlines ? (
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
                You&apos;ve written all {totalChapters} chapters. Ready to compile your manuscript?
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
          <div className="mb-8 p-6 bg-[var(--card)] border border-[var(--border)] rounded-lg text-center">
            <h3 className="font-semibold text-[var(--foreground)] mb-2">Start writing</h3>
            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              Your chapter outlines are saved. Start with Chapter 1 to open the editor and write (or generate) your first chapter.
            </p>
            <Button onClick={handleStartChapter1} disabled={startingChapter1}>
              {startingChapter1 ? 'Opening…' : 'Write Chapter 1'}
            </Button>
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
