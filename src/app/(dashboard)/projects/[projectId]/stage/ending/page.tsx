'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProject } from '@/hooks/useProject';
import { useGenerate } from '@/hooks/useGenerate';
import { useProjectStore } from '@/stores/projectStore';
import { StageLayout, StageActions, ContentDisplay, LoadingContent, EmptyContent } from '@/components/stages';
import { ContextSection } from '@/components/layout';
import { Button, Card, CardContent } from '@/components/ui';
import { getNextStage, cn } from '@/lib/utils';
import type { WorkflowStage } from '@/types';

interface EndingPageProps {
  params: Promise<{ projectId: string }>;
}

interface EndingConcept {
  id: string;
  title: string;
  summary: string;
  emotionalPayoff: string;
  characterResolution: string;
  thematicStatement: string;
}

// Parse ending concepts from generated content
function parseEndingConcepts(content: string): EndingConcept[] {
  const concepts: EndingConcept[] = [];
  
  // Split by numbered sections (1., 2., etc.)
  const sections = content.split(/(?=\d+\.\s+\*\*)/);
  
  for (const section of sections) {
    if (!section.trim()) continue;
    
    const titleMatch = section.match(/\*\*([^*]+)\*\*/);
    const summaryMatch = section.match(/Summary[:\s]*([^\n]+(?:\n(?!\d+\.\s|\*\*)[^\n]+)*)/i);
    const emotionalMatch = section.match(/Emotional[^:]*[:\s]*([^\n]+)/i);
    const characterMatch = section.match(/Character[^:]*[:\s]*([^\n]+)/i);
    const thematicMatch = section.match(/Thematic[^:]*[:\s]*([^\n]+)/i);
    
    if (titleMatch) {
      concepts.push({
        id: `ending-${concepts.length + 1}`,
        title: titleMatch[1].trim(),
        summary: summaryMatch?.[1]?.trim() || section.slice(0, 200),
        emotionalPayoff: emotionalMatch?.[1]?.trim() || '',
        characterResolution: characterMatch?.[1]?.trim() || '',
        thematicStatement: thematicMatch?.[1]?.trim() || '',
      });
    }
  }
  
  return concepts;
}

export default function EndingPage({ params }: EndingPageProps) {
  const { projectId } = use(params);
  const router = useRouter();
  
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
  
  const [phase, setPhase] = useState<'concepts' | 'expanded'>('concepts');
  const [conceptsContent, setConceptsContent] = useState('');
  const [expandedContent, setExpandedContent] = useState('');
  const [selectedConcept, setSelectedConcept] = useState<EndingConcept | null>(null);
  const [concepts, setConcepts] = useState<EndingConcept[]>([]);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Load existing content
  useEffect(() => {
    if (documents.length > 0) {
      const doc = getLatestDocumentByType('ending');
      if (doc) {
        // Check if it's expanded content (longer) or concepts
        if (doc.content.length > 3000) {
          setPhase('expanded');
          setExpandedContent(doc.content);
        } else {
          setPhase('concepts');
          setConceptsContent(doc.content);
          setConcepts(parseEndingConcepts(doc.content));
        }
        setCurrentDocId(doc.id);
      }
    }
  }, [documents, getLatestDocumentByType]);
  
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
  
  const approvedDoc = getDocumentByType('ending');
  const isApproved = !!approvedDoc;
  
  // Generate ending concepts
  const handleGenerateConcepts = async () => {
    clearError();
    
    try {
      const nicheDoc = getDocumentByType('niche');
      
      const result = await generate('ending', {
        premise: project.premise,
        genre: project.genre,
        nicheReference: nicheDoc?.content || '',
      });
      
      setConceptsContent(result.content);
      setConcepts(parseEndingConcepts(result.content));
      setPhase('concepts');
      
      // Save the document
      if (currentDocId) {
        await updateDocument(currentDocId, {
          content: result.content,
          version: (getLatestDocumentByType('ending')?.version || 0) + 1,
        });
      } else {
        const newDocId = await createDocument({
          projectId,
          type: 'ending',
          content: result.content,
          version: 1,
          approved: false,
        });
        setCurrentDocId(newDocId);
      }
    } catch (err) {
      // Error handled by hook
    }
  };
  
  // Expand selected ending
  const handleExpandEnding = async () => {
    if (!selectedConcept) return;
    clearError();
    
    try {
      const nicheDoc = getDocumentByType('niche');
      
      const result = await generate('ending', {
        premise: project.premise,
        genre: project.genre,
        nicheReference: nicheDoc?.content || '',
        selectedEnding: `${selectedConcept.title}\n\n${selectedConcept.summary}\n\nEmotional Payoff: ${selectedConcept.emotionalPayoff}\nCharacter Resolution: ${selectedConcept.characterResolution}\nThematic Statement: ${selectedConcept.thematicStatement}`,
      });
      
      setExpandedContent(result.content);
      setPhase('expanded');
      
      // Update the document with expanded content
      if (currentDocId) {
        await updateDocument(currentDocId, {
          content: result.content,
          version: (getLatestDocumentByType('ending')?.version || 0) + 1,
        });
      }
    } catch (err) {
      // Error handled by hook
    }
  };
  
  // Handle approval
  const handleApprove = async () => {
    if (!currentDocId) return;
    
    try {
      await approveDocument(currentDocId);
      
      const nextStage = getNextStage('ending');
      if (nextStage && project.currentStage === 'ending') {
        await advanceStage(projectId, nextStage as WorkflowStage);
      }
      
      if (nextStage) {
        router.push(`/projects/${projectId}/stage/${nextStage}`);
      } else {
        router.push(`/projects/${projectId}`);
      }
    } catch (err) {
      // Handle error
    }
  };
  
  // Build context content
  const contextContent = (
    <>
      <ContextSection title="Project Info">
        <div className="space-y-2 text-sm">
          <p><strong>Genre:</strong> {project.genre}</p>
          <p><strong>Premise:</strong> {project.premise}</p>
        </div>
      </ContextSection>
      
      {getDocumentByType('niche') && (
        <ContextSection title="Niche Positioning" defaultExpanded={false}>
          <p className="text-sm text-[var(--muted-foreground)] line-clamp-6">
            {getDocumentByType('niche')?.content.slice(0, 500)}...
          </p>
        </ContextSection>
      )}
      
      {selectedConcept && phase === 'concepts' && (
        <ContextSection title="Selected Ending">
          <div className="space-y-2 text-sm">
            <p><strong>{selectedConcept.title}</strong></p>
            <p className="text-[var(--muted-foreground)]">{selectedConcept.summary}</p>
          </div>
        </ContextSection>
      )}
    </>
  );
  
  return (
    <StageLayout
      projectId={projectId}
      projectTitle={project.title}
      currentStage={project.currentStage}
      activeStage="ending"
      chapters={chapters}
      contextContent={contextContent}
    >
      {/* Error display */}
      {(projectError || generateError) && (
        <div className="mb-6 p-4 bg-[rgba(139,38,53,0.1)] border border-[var(--destructive)] rounded-lg">
          <p className="text-sm text-[var(--destructive)]">{projectError || generateError}</p>
        </div>
      )}
      
      {/* Loading state */}
      {isGenerating && (
        <LoadingContent 
          message={phase === 'concepts' ? 'Generating ending concepts...' : 'Expanding your chosen ending...'} 
        />
      )}
      
      {/* Concepts phase */}
      {!isGenerating && phase === 'concepts' && concepts.length === 0 && (
        <EmptyContent
          title="Generate Ending Concepts"
          description="We'll generate 8-10 potential endings for your story. You'll then select one to develop further."
          actionLabel="Generate Endings"
          onAction={handleGenerateConcepts}
          isLoading={isGenerating}
        />
      )}
      
      {!isGenerating && phase === 'concepts' && concepts.length > 0 && !isApproved && (
        <>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
              Select Your Ending
            </h2>
            <p className="text-[var(--muted-foreground)]">
              Choose the ending concept that resonates most with your vision. We&apos;ll then expand it into a detailed blueprint.
            </p>
          </div>
          
          <div className="grid gap-4 mb-6">
            {concepts.map((concept) => (
              <Card
                key={concept.id}
                className={cn(
                  'cursor-pointer transition-all duration-200',
                  selectedConcept?.id === concept.id
                    ? 'ring-2 ring-[var(--ring)] bg-[var(--muted)]'
                    : 'hover:border-[var(--ring)]'
                )}
                onClick={() => setSelectedConcept(concept)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1',
                      selectedConcept?.id === concept.id
                        ? 'border-[var(--accent)] bg-[var(--accent)]'
                        : 'border-[var(--border)]'
                    )}>
                      {selectedConcept?.id === concept.id && (
                        <svg className="w-4 h-4 text-[var(--primary-foreground)]" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-[var(--foreground)] mb-2">{concept.title}</h3>
                      <p className="text-sm text-[var(--muted-foreground)] mb-3">{concept.summary}</p>
                      {concept.emotionalPayoff && (
                        <p className="text-xs text-[var(--muted-foreground)]">
                          <strong>Emotional Payoff:</strong> {concept.emotionalPayoff}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="flex items-center justify-between">
            <Button variant="secondary" onClick={handleGenerateConcepts} disabled={isGenerating}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Regenerate Concepts
            </Button>
            
            <Button onClick={handleExpandEnding} disabled={!selectedConcept || isGenerating}>
              Expand Selected Ending
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          </div>
        </>
      )}
      
      {/* Expanded phase */}
      {!isGenerating && phase === 'expanded' && expandedContent && (
        <>
          <ContentDisplay
            content={expandedContent}
            isEditing={isEditing && !isApproved}
            onContentChange={setExpandedContent}
          />
          <StageActions
            onApprove={handleApprove}
            onRegenerate={handleExpandEnding}
            onEdit={() => setIsEditing(!isEditing)}
            isApproved={isApproved}
            isGenerating={isGenerating}
            canApprove={!!expandedContent && !isApproved}
            showEdit={!isApproved}
          />
        </>
      )}
      
      {/* Approved state */}
      {isApproved && (
        <ContentDisplay content={approvedDoc?.content || expandedContent} />
      )}
      {isApproved && (
        <StageActions
          onApprove={() => {}}
          onRegenerate={() => {}}
          isApproved={true}
          isGenerating={false}
        />
      )}
    </StageLayout>
  );
}
