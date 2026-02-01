'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProject } from '@/hooks/useProject';
import { useGenerate } from '@/hooks/useGenerate';
import { useProjectStore } from '@/stores/projectStore';
import { TipTapEditor } from '@/components/editor';
import { WorkflowSidebar, ContextDrawer, ContextSection } from '@/components/layout';
import { Button, Badge } from '@/components/ui';
import { countWords } from '@/lib/utils';
import type { ChapterVersion } from '@/types';

interface ChapterPageProps {
  params: Promise<{ projectId: string; chapterId: string }>;
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

export default function ChapterPage({ params }: ChapterPageProps) {
  const { projectId, chapterId } = use(params);
  const router = useRouter();
  
  const {
    project,
    documents,
    chapters,
    chapterVersions,
    loading: projectLoading,
    error: projectError,
    getDocumentByType,
    getChapterVersions,
    getLatestChapterVersion,
    getApprovedChapterVersion,
  } = useProject(projectId);
  
  const { loadChapterVersions, createChapterVersion, approveChapterVersion, error: storeError } = useProjectStore();
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
  
  // Load version content - prefer approved, fallback to latest
  useEffect(() => {
    if (!chapterId) return;
    
    // Get versions for this chapter
    const versions = getChapterVersions(chapterId);
    
    if (versions.length > 0) {
      // Prefer approved version, otherwise use latest (first in array, already sorted desc)
      const approvedVersion = versions.find(v => v.approved);
      const versionToUse = approvedVersion || versions[0];
      
      if (versionToUse) {
        setContent(versionToUse.content);
        setCurrentVersionId(versionToUse.id);
        setNotes(versionToUse.notes || '');
      }
    } else {
      // No versions yet - clear content to show generate screen
      setContent('');
      setCurrentVersionId(null);
      setNotes('');
    }
  }, [chapterId, getChapterVersions, chapterVersions]);
  
  if (projectLoading || !project || !chapter) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '3rem', height: '3rem', border: '4px solid #e5e5e5', borderTopColor: '#3b82f6', borderRadius: '9999px', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#737373' }}>Loading chapter...</p>
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
      const genreDoc = getDocumentByType('genre');
      const nicheDoc = getDocumentByType('niche');
      const outlinesDoc = getDocumentByType('chapter-outlines');
      
      // Try to get chapter details from outlines first, fall back to chapter record
      let chapterTitle = chapter.title;
      let beatReference = chapter.beatReference;
      let sceneGoal = chapter.sceneGoal;
      let pov = chapter.pov;
      let wordTarget = 3000;
      
      if (outlinesDoc) {
        const outlines = parseChapterOutlines(outlinesDoc.content);
        const outline = outlines.find(o => o.chapterNumber === chapter.chapterNumber);
        if (outline) {
          chapterTitle = outline.title || chapterTitle;
          beatReference = outline.beatReference || beatReference;
          sceneGoal = outline.sceneGoal || sceneGoal;
          pov = outline.pov || pov;
          wordTarget = outline.wordTarget || wordTarget;
        }
      }
      
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
        chapterTitle,
        beatReference,
        sceneGoal,
        pov,
        charactersReference: charactersDoc?.content || '',
        endingReference: endingDoc?.content || '',
        previousChapterSummary,
        structureContext: structureDoc?.content || '',
        genreResearch: genreDoc?.content || '',
        nicheReference: nicheDoc?.content || '',
        wordTarget,
      });
      
      setContent(result.content);
      
      // Create new version
      const latestVersion = getLatestChapterVersion(chapterId);
      const newVersion = (latestVersion?.version || 0) + 1;
      
      const versionData: Omit<ChapterVersion, 'id' | 'createdAt'> = {
        chapterId,
        projectId,
        chapterNumber: chapter.chapterNumber,
        version: newVersion,
        content: result.content,
        wordCount: countWords(result.content),
        approved: false,
      };
      
      // Only include parentVersionId if it exists (Firestore doesn't allow undefined)
      if (latestVersion?.id) {
        versionData.parentVersionId = latestVersion.id;
      }
      
      const versionId = await createChapterVersion(versionData);
      
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
          <p><strong>Beat:</strong> {chapter.beatReference}</p>
          <p><strong>Scene Goal:</strong> {chapter.sceneGoal}</p>
          {chapter.pov && <p><strong>POV:</strong> {chapter.pov}</p>}
        </div>
      </ContextSection>
      
      {getDocumentByType('characters') && (
        <ContextSection title="Characters" defaultExpanded={false}>
          <p style={{ fontSize: '0.875rem', color: '#737373', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 10, WebkitBoxOrient: 'vertical' }}>
            {getDocumentByType('characters')?.content.slice(0, 800)}...
          </p>
        </ContextSection>
      )}
      
      {getDocumentByType('ending') && (
        <ContextSection title="Ending Reminder" defaultExpanded={false}>
          <p style={{ fontSize: '0.875rem', color: '#737373', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical' }}>
            {getDocumentByType('ending')?.content.slice(0, 500)}...
          </p>
        </ContextSection>
      )}
      
      <ContextSection title="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes for this chapter..."
          style={{
            width: '100%',
            padding: '0.5rem',
            fontSize: '0.875rem',
            backgroundColor: '#fafafa',
            border: '1px solid #e5e5e5',
            borderRadius: '4px',
            resize: 'vertical',
            minHeight: '100px',
            outline: 'none',
          }}
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
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
      {/* Sidebar */}
      <WorkflowSidebar
        projectId={projectId}
        projectTitle={project.title}
        currentStage={project.currentStage}
        chapters={chapters}
        approvedChapterIds={approvedChapterIds}
      />
      
      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ borderBottom: '1px solid #e5e5e5', backgroundColor: '#ffffff', padding: '1.5rem 3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#171717' }}>
                  Chapter {chapter.chapterNumber}: {chapter.title}
                </h1>
                <Badge variant={isApproved ? 'success' : 'default'}>
                  {isApproved ? 'Approved' : 'Draft'}
                </Badge>
                <Badge variant="info">Claude</Badge>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#737373' }}>
                {chapter.beatReference} • {wordCount.toLocaleString()} words
              </p>
            </div>
            
            {/* Chapter navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {prevChapter && (
                <Link href={`/projects/${projectId}/chapter/${prevChapter.id}`}>
                  <Button variant="ghost" size="sm">
                    <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
        
        {/* Error display */}
        {(projectError || generateError || storeError) && (
          <div style={{ margin: '1rem 3rem 0', padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px' }}>
            <p style={{ fontSize: '0.875rem', color: '#dc2626' }}>{projectError || generateError || storeError}</p>
          </div>
        )}
        
        {/* Editor */}
        <div style={{ flex: 1, padding: '2rem 3rem' }}>
          {isGenerating ? (
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e5e5', borderRadius: '12px', padding: '3rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                <div style={{ width: '3rem', height: '3rem', border: '4px solid #e5e5e5', borderTopColor: '#3b82f6', borderRadius: '9999px', animation: 'spin 1s linear infinite' }} />
                <p style={{ color: '#737373' }}>Writing chapter...</p>
                <p style={{ fontSize: '0.875rem', color: '#737373' }}>This may take a few minutes...</p>
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
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e5e5', borderRadius: '12px', padding: '4rem', textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '4rem', height: '4rem', backgroundColor: '#f5f5f5', borderRadius: '9999px', marginBottom: '1rem' }}>
                <svg style={{ width: '2rem', height: '2rem', color: '#737373' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#171717', marginBottom: '0.5rem' }}>
                Generate Chapter {chapter.chapterNumber}
              </h2>
              <p style={{ color: '#737373', marginBottom: '1.5rem', maxWidth: '28rem', marginLeft: 'auto', marginRight: 'auto' }}>
                Let AI write this chapter based on your story structure, characters, and ending.
              </p>
              <Button onClick={handleGenerate} size="lg">
                <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Chapter
              </Button>
            </div>
          )}
        </div>
        
        {/* Action bar */}
        {content && (
          <div style={{ borderTop: '1px solid #e5e5e5', backgroundColor: '#ffffff', padding: '1.5rem 3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Secondary actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Button
                  variant="secondary"
                  onClick={handleGenerate}
                  disabled={isGenerating || isApproved}
                >
                  <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowNotes(!showNotes)}
                  style={{ position: 'relative' }}
                >
                  <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  Notes
                  {notes.trim().length > 0 && (
                    <span style={{ position: 'absolute', top: '-0.25rem', right: '-0.25rem', width: '0.625rem', height: '0.625rem', backgroundColor: '#3b82f6', borderRadius: '9999px' }} />
                  )}
                </Button>
              </div>
              
              {/* Visual separator */}
              <div style={{ height: '2rem', width: '1px', backgroundColor: '#e5e5e5', margin: '0 1rem' }} />
              
              {/* Primary action */}
              {isApproved ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981' }}>
                  <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span style={{ fontWeight: 500 }}>Approved</span>
                </div>
              ) : (
                <Button onClick={handleApprove} disabled={isGenerating || !content} size="lg">
                  <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
