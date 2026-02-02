'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProject } from '@/hooks/useProject';
import { useGenerate } from '@/hooks/useGenerate';
import { useProjectStore } from '@/stores/projectStore';
import { StageLayout, StageActions, ContentDisplay, LoadingContent, EmptyContent } from '@/components/stages';
import { getNextStage, isStageAccessible } from '@/lib/utils';
import type { WorkflowStage, DocumentType } from '@/types';

interface StagePageProps {
  params: Promise<{ projectId: string; stageId: string }>;
}

// Map stage IDs to document types
const stageToDocType: Record<string, DocumentType> = {
  'genre-research': 'genre',
  'niche': 'niche',
  'ending': 'ending',
  'characters': 'characters',
  'structure': 'structure',
  'chapter-outlines': 'chapter-outlines',
};

export default function StagePage({ params }: StagePageProps) {
  const { projectId, stageId } = use(params);
  const router = useRouter();
  const stage = stageId as WorkflowStage;
  
  const {
    project,
    documents,
    chapters,
    loading: projectLoading,
    error: projectError,
    getDocumentByType,
    getLatestDocumentByType,
  } = useProject(projectId);
  
  const { createDocument, updateDocument, approveDocument, advanceStage } = useProjectStore();
  const { generate, isGenerating, error: generateError, clearError } = useGenerate();
  
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  
  // Get the document type for this stage
  const docType = stageToDocType[stage];
  
  // Load existing content
  useEffect(() => {
    if (docType && documents.length > 0) {
      const doc = getLatestDocumentByType(docType);
      if (doc) {
        setContent(doc.content);
        setCurrentDocId(doc.id);
      }
    }
  }, [docType, documents, getLatestDocumentByType]);
  
  // Check if stage is accessible
  useEffect(() => {
    if (project && !isStageAccessible(project.currentStage, stage)) {
      router.push(`/projects/${projectId}`);
    }
  }, [project, stage, projectId, router]);
  
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
  
  // Check if this stage's document is approved
  const approvedDoc = docType ? getDocumentByType(docType) : null;
  const isApproved = !!approvedDoc;
  
  // Handle generation
  const handleGenerate = async () => {
    clearError();
    
    try {
      // Build the data payload based on stage
      const data: Record<string, unknown> = {
        premise: project.premise,
        genre: project.genre,
        research: project.research,
      };
      
      // Add references from previous stages
      if (stage === 'niche') {
        const genreDoc = getDocumentByType('genre');
        if (genreDoc) {
          data.genreResearch = genreDoc.content;
        }
      } else if (stage === 'ending') {
        const nicheDoc = getDocumentByType('niche');
        if (nicheDoc) {
          data.nicheReference = nicheDoc.content;
        }
      } else if (stage === 'characters') {
        const nicheDoc = getDocumentByType('niche');
        const endingDoc = getDocumentByType('ending');
        if (nicheDoc) data.nicheReference = nicheDoc.content;
        if (endingDoc) data.endingReference = endingDoc.content;
      } else if (stage === 'structure') {
        const nicheDoc = getDocumentByType('niche');
        const endingDoc = getDocumentByType('ending');
        const charsDoc = getDocumentByType('characters');
        if (nicheDoc) data.nicheReference = nicheDoc.content;
        if (endingDoc) data.endingReference = endingDoc.content;
        if (charsDoc) data.charactersReference = charsDoc.content;
      } else if (stage === 'chapter-outlines') {
        const structureDoc = getDocumentByType('structure');
        const nicheDoc = getDocumentByType('niche');
        const endingDoc = getDocumentByType('ending');
        const charsDoc = getDocumentByType('characters');
        const genreDoc = getDocumentByType('genre');
        if (structureDoc) data.structureReference = structureDoc.content;
        if (nicheDoc) data.nicheReference = nicheDoc.content;
        if (endingDoc) data.endingReference = endingDoc.content;
        if (charsDoc) data.charactersReference = charsDoc.content;
        if (genreDoc) data.genreResearch = genreDoc.content;
      }
      
      const result = await generate(stage, data);
      setContent(result.content);
      
      // Save the document
      if (currentDocId) {
        await updateDocument(currentDocId, {
          content: result.content,
          version: (getLatestDocumentByType(docType!)?.version || 0) + 1,
        });
      } else if (docType) {
        const newDocId = await createDocument({
          projectId,
          type: docType,
          content: result.content,
          version: 1,
          approved: false,
        });
        setCurrentDocId(newDocId);
      }
    } catch (err) {
      // Error is handled by the hook
    }
  };
  
  // Handle approval
  const handleApprove = async () => {
    if (!currentDocId || !docType) return;
    
    try {
      await approveDocument(currentDocId);
      
      // Advance to next stage if this is the current stage
      const nextStage = getNextStage(stage);
      if (nextStage && project.currentStage === stage) {
        await advanceStage(projectId, nextStage as WorkflowStage);
      }
      
      // Navigate to next stage
      if (nextStage) {
        router.push(`/projects/${projectId}/stage/${nextStage}`);
      } else {
        router.push(`/projects/${projectId}`);
      }
    } catch (err) {
      // Handle error
    }
  };
  
  // Handle edit toggle
  const handleEdit = () => {
    setIsEditing(!isEditing);
  };
  
  // Handle content change during editing
  const handleContentChange = async (newContent: string) => {
    setContent(newContent);
    
    // Auto-save after a delay
    if (currentDocId) {
      await updateDocument(currentDocId, { content: newContent });
    }
  };
  
  return (
    <StageLayout
      projectId={projectId}
      projectTitle={project.title}
      genre={project.genre}
      niche={project.niche}
      currentStage={project.currentStage}
      activeStage={stage}
      chapters={chapters}
    >
      {/* Error display */}
      {(projectError || generateError) && (
        <div className="mb-6 p-4 bg-[rgba(139,38,53,0.1)] border border-[var(--destructive)] rounded-lg">
          <p className="text-sm text-[var(--destructive)]">{projectError || generateError}</p>
        </div>
      )}
      
      {/* Content area */}
      {isGenerating ? (
        <LoadingContent message={`Generating ${stage.replace('-', ' ')} analysis...`} />
      ) : content ? (
        <>
          <ContentDisplay
            content={content}
            isEditing={isEditing && !isApproved}
            onContentChange={handleContentChange}
          />
          <StageActions
            onApprove={handleApprove}
            onRegenerate={handleGenerate}
            onEdit={handleEdit}
            isApproved={isApproved}
            isGenerating={isGenerating}
            canApprove={!!content && !isApproved}
            showEdit={!isApproved}
          />
        </>
      ) : (
        <EmptyContent
          title={`Generate ${stage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`}
          description={`Click below to generate AI-powered ${stage.replace('-', ' ')} for your novel.`}
          actionLabel="Generate"
          onAction={handleGenerate}
          isLoading={isGenerating}
        />
      )}
    </StageLayout>
  );
}
