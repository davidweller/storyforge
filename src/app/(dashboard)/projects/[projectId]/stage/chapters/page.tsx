'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useProject } from '@/hooks/useProject';
import { useProjectStore } from '@/stores/projectStore';
import { StageLayout } from '@/components/stages';
import { ContextSection } from '@/components/layout';
import { Button, Card, CardContent, Badge, Input, Textarea } from '@/components/ui';
import { cn, countWords } from '@/lib/utils';

interface ChaptersPageProps {
  params: Promise<{ projectId: string }>;
}

export default function ChaptersPage({ params }: ChaptersPageProps) {
  const { projectId } = use(params);
  
  const {
    project,
    documents,
    chapters,
    loading,
    error,
    getDocumentByType,
    getApprovedChapterVersion,
    getTotalWordCount,
    getApprovedChaptersCount,
  } = useProject(projectId);
  
  const { createChapter } = useProjectStore();
  
  const [showNewChapter, setShowNewChapter] = useState(false);
  const [newChapter, setNewChapter] = useState({
    title: '',
    beatReference: '',
    sceneGoal: '',
    pov: '',
  });
  
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
  
  const handleCreateChapter = async () => {
    if (!newChapter.title || !newChapter.beatReference || !newChapter.sceneGoal) return;
    
    try {
      await createChapter({
        projectId,
        chapterNumber: chapters.length + 1,
        title: newChapter.title,
        beatReference: newChapter.beatReference,
        sceneGoal: newChapter.sceneGoal,
        pov: newChapter.pov || undefined,
      });
      
      setNewChapter({ title: '', beatReference: '', sceneGoal: '', pov: '' });
      setShowNewChapter(false);
    } catch (err) {
      // Handle error
    }
  };
  
  // Context content
  const contextContent = (
    <>
      <ContextSection title="Progress">
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Chapters</span>
              <span>{approvedCount}/{chapters.length}</span>
            </div>
            <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--status-approved)]"
                style={{ width: `${chapters.length > 0 ? (approvedCount / chapters.length) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div className="text-sm">
            <span className="text-[var(--muted-foreground)]">Total words: </span>
            <span className="font-medium">{totalWordCount.toLocaleString()}</span>
          </div>
        </div>
      </ContextSection>
      
      {getDocumentByType('structure') && (
        <ContextSection title="Story Structure" defaultExpanded={false}>
          <p className="text-sm text-[var(--muted-foreground)] line-clamp-10">
            {getDocumentByType('structure')?.content.slice(0, 800)}...
          </p>
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
      activeStage="chapters"
      chapters={chapters}
      approvedChapterIds={approvedChapterIds}
      contextContent={contextContent}
    >
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-[var(--foreground)]">{chapters.length}</div>
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
      
      {/* Chapters list */}
      <div className="space-y-3 mb-6">
        {chapters.map((chapter) => {
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
                        <h3 className="font-semibold text-[var(--foreground)]">
                          {chapter.title}
                        </h3>
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
      
      {/* Add chapter */}
      {showNewChapter ? (
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold text-[var(--foreground)] mb-4">Add New Chapter</h3>
            <div className="space-y-4">
              <Input
                label="Chapter Title"
                placeholder="e.g., The Discovery"
                value={newChapter.title}
                onChange={(e) => setNewChapter({ ...newChapter, title: e.target.value })}
              />
              <Input
                label="Story Beat"
                placeholder="e.g., Catalyst - The inciting incident"
                value={newChapter.beatReference}
                onChange={(e) => setNewChapter({ ...newChapter, beatReference: e.target.value })}
              />
              <Textarea
                label="Scene Goal"
                placeholder="What should happen in this chapter? What's the purpose?"
                value={newChapter.sceneGoal}
                onChange={(e) => setNewChapter({ ...newChapter, sceneGoal: e.target.value })}
                rows={3}
              />
              <Input
                label="POV Character (optional)"
                placeholder="e.g., Sarah"
                value={newChapter.pov}
                onChange={(e) => setNewChapter({ ...newChapter, pov: e.target.value })}
              />
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowNewChapter(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateChapter}>
                  Add Chapter
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          variant="secondary"
          onClick={() => setShowNewChapter(true)}
          className="w-full"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Chapter
        </Button>
      )}
      
      {/* Continue to compilation */}
      {approvedCount > 0 && (
        <div className="mt-8 pt-8 border-t border-[var(--border)]">
          <Link href={`/projects/${projectId}/stage/compilation`}>
            <Button className="w-full" size="lg">
              Continue to Compilation
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          </Link>
        </div>
      )}
    </StageLayout>
  );
}
