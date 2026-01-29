'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProject } from '@/hooks/useProject';
import { useGenerate } from '@/hooks/useGenerate';
import { useProjectStore } from '@/stores/projectStore';
import { StageLayout, ContentDisplay, LoadingContent, EmptyContent } from '@/components/stages';
import { ContextSection } from '@/components/layout';
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import { cn, getNextStage } from '@/lib/utils';
import type { WorkflowStage, EditorialCategory } from '@/types';

interface EditorialPageProps {
  params: Promise<{ projectId: string }>;
}

const categoryLabels: Record<EditorialCategory, string> = {
  continuity: 'Continuity',
  character: 'Character',
  pacing: 'Pacing',
  prose: 'Prose & Style',
  logic: 'Logic & Plot',
};

const categoryColors: Record<EditorialCategory, string> = {
  continuity: 'bg-blue-100 text-blue-800',
  character: 'bg-purple-100 text-purple-800',
  pacing: 'bg-yellow-100 text-yellow-800',
  prose: 'bg-green-100 text-green-800',
  logic: 'bg-red-100 text-red-800',
};

export default function EditorialPage({ params }: EditorialPageProps) {
  const { projectId } = use(params);
  const router = useRouter();
  
  const {
    project,
    documents,
    chapters,
    editorialIssues,
    loading: projectLoading,
    error: projectError,
    getDocumentByType,
    getLatestDocumentByType,
    getApprovedChapterVersion,
    getOpenIssuesCount,
  } = useProject(projectId);
  
  const { createDocument, updateDocument, approveDocument, loadEditorialIssues, createEditorialIssue, advanceStage } = useProjectStore();
  const { generate, isGenerating, error: generateError, clearError } = useGenerate();
  
  const [editorialContent, setEditorialContent] = useState('');
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<EditorialCategory | 'all'>('all');
  
  // Load existing editorial content
  useEffect(() => {
    if (documents.length > 0) {
      const doc = getLatestDocumentByType('editorial');
      if (doc) {
        setEditorialContent(doc.content);
        setCurrentDocId(doc.id);
      }
    }
  }, [documents, getLatestDocumentByType]);
  
  // Load editorial issues
  useEffect(() => {
    if (projectId) {
      loadEditorialIssues(projectId);
    }
  }, [projectId, loadEditorialIssues]);
  
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
  
  const approvedDoc = getDocumentByType('editorial');
  const isApproved = !!approvedDoc;
  const openIssuesCount = getOpenIssuesCount();
  
  // Get approved chapter IDs
  const approvedChapterIds = new Set<string>();
  for (const ch of chapters) {
    if (getApprovedChapterVersion(ch.id)) {
      approvedChapterIds.add(ch.id);
    }
  }
  
  // Compile manuscript for editorial review
  const compileManuscript = (): string => {
    let manuscript = '';
    
    for (const chapter of chapters) {
      const version = getApprovedChapterVersion(chapter.id);
      if (version) {
        manuscript += `\n\n## Chapter ${chapter.chapterNumber}: ${chapter.title}\n\n`;
        manuscript += version.content;
      }
    }
    
    return manuscript;
  };
  
  // Handle generation
  const handleGenerate = async () => {
    clearError();
    
    try {
      const manuscript = compileManuscript();
      const nicheDoc = getDocumentByType('niche');
      const charactersDoc = getDocumentByType('characters');
      const endingDoc = getDocumentByType('ending');
      const structureDoc = getDocumentByType('structure');
      
      const result = await generate('editorial', {
        manuscript,
        genre: project.genre,
        nicheReference: nicheDoc?.content,
        charactersReference: charactersDoc?.content,
        endingReference: endingDoc?.content,
        structureReference: structureDoc?.content,
      });
      
      setEditorialContent(result.content);
      
      // Save the document
      if (currentDocId) {
        await updateDocument(currentDocId, {
          content: result.content,
          version: (getLatestDocumentByType('editorial')?.version || 0) + 1,
        });
      } else {
        const newDocId = await createDocument({
          projectId,
          type: 'editorial',
          content: result.content,
          version: 1,
          approved: false,
        });
        setCurrentDocId(newDocId);
      }
      
      // Parse and create editorial issues (simplified - in production, use structured output)
      // This would normally parse the JSON response and create individual issues
      
    } catch (err) {
      // Error handled by hook
    }
  };
  
  // Handle continue to revision
  const handleContinueToRevision = async () => {
    try {
      if (currentDocId && !isApproved) {
        await approveDocument(currentDocId);
      }
      
      const nextStage = getNextStage('editorial');
      if (nextStage && project.currentStage === 'editorial') {
        await advanceStage(projectId, nextStage as WorkflowStage);
      }
      
      router.push(`/projects/${projectId}/stage/revision`);
    } catch (err) {
      // Handle error
    }
  };
  
  // Filter issues by category
  const filteredIssues = selectedCategory === 'all'
    ? editorialIssues
    : editorialIssues.filter((i) => i.category === selectedCategory);
  
  // Group issues by chapter
  const issuesByChapter = new Map<number | undefined, typeof editorialIssues>();
  for (const issue of filteredIssues) {
    const key = issue.chapterNumber;
    if (!issuesByChapter.has(key)) {
      issuesByChapter.set(key, []);
    }
    issuesByChapter.get(key)!.push(issue);
  }
  
  // Context content
  const contextContent = (
    <>
      <ContextSection title="Issue Summary">
        <div className="space-y-2 text-sm">
          <p><strong>Total Issues:</strong> {editorialIssues.length}</p>
          <p><strong>Open:</strong> {openIssuesCount}</p>
          <p><strong>Resolved:</strong> {editorialIssues.length - openIssuesCount}</p>
        </div>
      </ContextSection>
      
      <ContextSection title="By Category">
        <div className="space-y-1">
          {(Object.keys(categoryLabels) as EditorialCategory[]).map((cat) => {
            const count = editorialIssues.filter((i) => i.category === cat).length;
            return (
              <div key={cat} className="flex justify-between text-sm">
                <span>{categoryLabels[cat]}</span>
                <span className="font-medium">{count}</span>
              </div>
            );
          })}
        </div>
      </ContextSection>
    </>
  );
  
  return (
    <StageLayout
      projectId={projectId}
      projectTitle={project.title}
      genre={project.genre}
      niche={project.niche}
      currentStage={project.currentStage}
      activeStage="editorial"
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
      
      {/* Loading */}
      {isGenerating && (
        <LoadingContent message="Analyzing your manuscript... This may take several minutes." />
      )}
      
      {/* Empty state */}
      {!isGenerating && !editorialContent && (
        <EmptyContent
          title="Generate Editorial Review"
          description="Submit your manuscript for AI-powered editorial analysis. You'll receive detailed feedback on continuity, characters, pacing, prose, and plot logic."
          actionLabel="Start Editorial Review"
          onAction={handleGenerate}
          isLoading={isGenerating}
        />
      )}
      
      {/* Editorial content */}
      {!isGenerating && editorialContent && (
        <>
          {/* Summary card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Editorial Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4 mb-4">
                {(Object.keys(categoryLabels) as EditorialCategory[]).map((cat) => {
                  const count = editorialIssues.filter((i) => i.category === cat && i.status === 'open').length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(selectedCategory === cat ? 'all' : cat)}
                      className={cn(
                        'p-3 rounded-lg text-center transition-all',
                        selectedCategory === cat
                          ? 'ring-2 ring-[var(--ring)]'
                          : 'hover:bg-[var(--muted)]',
                        categoryColors[cat]
                      )}
                    >
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="text-xs">{categoryLabels[cat]}</div>
                    </button>
                  );
                })}
              </div>
              
              {selectedCategory !== 'all' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCategory('all')}
                >
                  Show All Issues
                </Button>
              )}
            </CardContent>
          </Card>
          
          {/* Full report */}
          <ContentDisplay content={editorialContent} className="mb-6" />
          
          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button variant="secondary" onClick={handleGenerate} disabled={isGenerating}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Re-analyze
            </Button>
            
            <Button onClick={handleContinueToRevision}>
              Create Revision Queue
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          </div>
        </>
      )}
    </StageLayout>
  );
}
