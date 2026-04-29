'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useProject } from '@/hooks/useProject';
import { useGenerate } from '@/hooks/useGenerate';
import { useProjectStore } from '@/stores/projectStore';
import { StageLayout, StageActions, ContentDisplay, LoadingContent, EmptyContent } from '@/components/stages';
import { Button, Card, CardContent, useToast } from '@/components/ui';
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

type ExpansionStatus = 'idle' | 'running' | 'complete' | 'error';

function firstTwoSentences(text: string): string {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const matches = cleaned.match(/[^.!?]+[.!?]+/g);
  if (!matches || matches.length === 0) {
    return cleaned;
  }
  return matches.slice(0, 2).join(' ').trim();
}

function parseSavedEndingChoice(content: string): EndingConcept | null {
  if (!content?.trim()) return null;
  try {
    const parsed = JSON.parse(content) as Partial<EndingConcept>;
    if (!parsed.title || !parsed.summary) return null;
    return {
      id: parsed.id || 'ending-choice',
      title: parsed.title,
      summary: parsed.summary,
      emotionalPayoff: parsed.emotionalPayoff || '',
      characterResolution: parsed.characterResolution || '',
      thematicStatement: parsed.thematicStatement || '',
    };
  } catch {
    return null;
  }
}

// Parse ending concepts from generated content (primary: numbered + bold title; fallback: numbered sections)
function parseEndingConcepts(content: string): EndingConcept[] {
  const concepts: EndingConcept[] = [];
  // Split by numbered sections: "1. **Title**" or fallback "1. Title"
  const sections = content.split(/(?=\d+\.\s)/).filter((s) => s.trim());
  if (sections.length <= 1) return concepts;

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed || !/^\d+\.\s/.test(trimmed)) continue;

    const titleMatch = trimmed.match(/\*\*([^*]+)\*\*/);
    const firstLine = trimmed.split(/\n/)[0]?.replace(/^\d+\.\s*/, '').trim() || '';
    const title = titleMatch ? titleMatch[1].trim() : (firstLine || trimmed.slice(0, 80));
    if (!title) continue;

    const summaryMatch = trimmed.match(/Summary[:\s]*([^\n]+(?:\n(?!\d+\.\s|\*\*)[^\n]+)*)/i);
    const emotionalMatch = trimmed.match(/Emotional[^:]*[:\s]*([^\n]+)/i);
    const characterMatch = trimmed.match(/Character[^:]*[:\s]*([^\n]+)/i);
    const thematicMatch = trimmed.match(/Thematic[^:]*[:\s]*([^\n]+)/i);

    concepts.push({
      id: `ending-${concepts.length + 1}`,
      title,
      summary: summaryMatch?.[1]?.trim() || trimmed.slice(title.length, 200 + title.length).trim() || trimmed.slice(0, 200),
      emotionalPayoff: emotionalMatch?.[1]?.trim() || '',
      characterResolution: characterMatch?.[1]?.trim() || '',
      thematicStatement: thematicMatch?.[1]?.trim() || '',
    });
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
  const { addToast } = useToast();
  
  const [phase, setPhase] = useState<'concepts' | 'expanded'>('concepts');
  const [conceptsContent, setConceptsContent] = useState('');
  const [expandedContent, setExpandedContent] = useState('');
  const [selectedConcept, setSelectedConcept] = useState<EndingConcept | null>(null);
  const [concepts, setConcepts] = useState<EndingConcept[]>([]);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [expansionStatus, setExpansionStatus] = useState<ExpansionStatus>('idle');
  const [expansionError, setExpansionError] = useState<string | null>(null);

  const initializedRef = useRef(false);
  const autoResumeTriggered = useRef(false);

  // Effect 1: One-shot hydration from DB on mount.
  // Only runs once so it never overwrites state set by user actions (handleChooseConcept etc.).
  useEffect(() => {
    if (initializedRef.current || documents.length === 0) return;
    initializedRef.current = true;

    const doc = getLatestDocumentByType('ending');
    const choiceDoc = getLatestDocumentByType('ending-choice');

    if (doc) {
      const parsed = parseEndingConcepts(doc.content);
      if (parsed.length >= 2) {
        setPhase('concepts');
        setConceptsContent(doc.content);
        setConcepts(parsed);
      } else if (parsed.length <= 1 && doc.content.length > 3000) {
        setPhase('expanded');
        setExpandedContent(doc.content);
        setExpansionStatus('complete');
      } else {
        setPhase('concepts');
        setConceptsContent(doc.content);
        setConcepts(parsed);
      }
      setCurrentDocId(doc.id);
    }

    if (choiceDoc) {
      const savedChoice = parseSavedEndingChoice(choiceDoc.content);
      if (savedChoice) {
        setSelectedConcept(savedChoice);
      }
    }
  }, [documents, getLatestDocumentByType]);

  useEffect(() => {
    if (expansionStatus !== 'running') return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [expansionStatus]);

  // Effect 2: Auto-resume interrupted expansion on reload.
  // If the user picked an ending (ending-choice saved) but expansion never finished
  // (ending doc still contains concept list), restart expansion automatically.
  useEffect(() => {
    if (!initializedRef.current) return;
    if (autoResumeTriggered.current) return;
    if (expansionStatus !== 'idle') return;
    if (!selectedConcept) return;
    const endingDoc = getLatestDocumentByType('ending');
    if (endingDoc && parseEndingConcepts(endingDoc.content).length >= 2) {
      autoResumeTriggered.current = true;
      void handleExpandEndingInBackground(selectedConcept);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expansionStatus, selectedConcept]);
  
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
    setExpansionError(null);
    setExpansionStatus('idle');
    autoResumeTriggered.current = false;
    
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
      setSelectedConcept(null);
      
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

  const saveEndingChoice = async (concept: EndingConcept): Promise<void> => {
    const choicePayload = JSON.stringify({
      id: concept.id,
      title: concept.title,
      summary: firstTwoSentences(concept.summary),
      emotionalPayoff: concept.emotionalPayoff,
      characterResolution: concept.characterResolution,
      thematicStatement: concept.thematicStatement,
    });
    const latestChoice = getLatestDocumentByType('ending-choice');
    if (latestChoice) {
      await updateDocument(latestChoice.id, {
        content: choicePayload,
        version: (latestChoice.version || 0) + 1,
        approved: true,
      });
      return;
    }
    await createDocument({
      projectId,
      type: 'ending-choice',
      content: choicePayload,
      version: 1,
      approved: true,
    });
  };
  
  // Expand selected ending in-session while user stays on page.
  const handleExpandEndingInBackground = async (conceptOverride?: EndingConcept) => {
    const conceptToExpand = conceptOverride || selectedConcept;
    if (!conceptToExpand) return;
    clearError();
    setExpansionError(null);
    setExpansionStatus('running');
    setPhase('expanded');
    addToast({
      type: 'info',
      message: 'Expanding your selected ending now. Please stay on this page until it finishes.',
      duration: 7000,
    });
    
    try {
      await saveEndingChoice(conceptToExpand);
      const nicheDoc = getDocumentByType('niche');
      
      const result = await generate('ending', {
        premise: project.premise,
        genre: project.genre,
        nicheReference: nicheDoc?.content || '',
        selectedEnding: `${conceptToExpand.title}\n\n${conceptToExpand.summary}\n\nEmotional Payoff: ${conceptToExpand.emotionalPayoff}\nCharacter Resolution: ${conceptToExpand.characterResolution}\nThematic Statement: ${conceptToExpand.thematicStatement}`,
      });
      
      setExpandedContent(result.content);
      setPhase('expanded');
      setExpansionStatus('complete');
      
      // Update the document with expanded content
      if (currentDocId) {
        await updateDocument(currentDocId, {
          content: result.content,
          version: (getLatestDocumentByType('ending')?.version || 0) + 1,
        });
      }
    } catch (err) {
      setExpansionStatus('error');
      const message = err instanceof Error ? err.message : 'Ending expansion failed.';
      setExpansionError(message);
      addToast({ type: 'error', message: 'Ending expansion failed. Please try again.' });
    }
  };

  const handleChooseConcept = (concept: EndingConcept) => {
    if (expansionStatus === 'running') return;
    setSelectedConcept(concept);
    void handleExpandEndingInBackground(concept);
  };
  
  const handleApproveClick = () => {
    void handleApprove();
  };
  
  // Approve expanded ending and continue to title stage
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
  
  return (
    <StageLayout
      projectId={projectId}
      projectTitle={project.title}
      genre={project.genre}
      niche={project.niche}
      currentStage={project.currentStage}
      activeStage="ending"
      chapters={chapters}
      blurbFilled={!!project.blurb?.trim()}
      amazonDescriptionFilled={!!project.amazonDescription?.trim()}
    >
      {/* Error display */}
      {(projectError || generateError) && (
        <div className="mb-6 p-4 bg-[rgba(139,38,53,0.1)] border border-[var(--destructive)] rounded-lg">
          <p className="text-sm text-[var(--destructive)]">{projectError || generateError}</p>
        </div>
      )}
      
      {/* Loading state */}
      {isGenerating && phase === 'concepts' && (
        <LoadingContent 
          message={'Generating ending concepts...'} 
        />
      )}
      
      {/* Concepts phase: empty state */}
      {!isGenerating && phase === 'concepts' && concepts.length === 0 && !conceptsContent && (
        <EmptyContent
          title="Generate Ending Concepts"
          description="We'll generate 8-10 potential endings for your story. You'll then select one to develop further."
          actionLabel="Generate Endings"
          onAction={handleGenerateConcepts}
          isLoading={isGenerating}
        />
      )}

      {/* Concepts phase: parsing failed but we have content — show read-only + Regenerate */}
      {!isGenerating && phase === 'concepts' && concepts.length === 0 && conceptsContent && !isApproved && (
        <>
          <div className="mb-6 p-4 rounded-lg bg-[var(--muted)] border border-[var(--border)]">
            <p className="text-sm text-[var(--muted-foreground)]">
              We couldn&apos;t split this into selectable cards. Regenerate to get clear ending options you can choose from.
            </p>
          </div>
          <ContentDisplay content={conceptsContent} className="mb-6" />
          <div className="flex justify-end">
            <Button variant="secondary" onClick={handleGenerateConcepts} disabled={isGenerating}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Regenerate Concepts
            </Button>
          </div>
        </>
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
            <p className="text-sm text-[var(--muted-foreground)] mt-2">
              Selecting a card starts expansion automatically.
            </p>
          </div>
          
          <div className="w-full flex flex-col gap-4 mb-6">
            {concepts.map((concept) => (
              <Card
                key={concept.id}
                className={cn(
                  'w-full cursor-pointer transition-all duration-200',
                  selectedConcept?.id === concept.id
                    ? 'ring-2 ring-[var(--ring)] bg-[var(--muted)]'
                    : 'hover:border-[var(--ring)]'
                )}
                onClick={() => handleChooseConcept(concept)}
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
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[var(--foreground)] mb-2">{concept.title}</h3>
                      <p className="text-sm text-[var(--muted-foreground)] mb-3">{firstTwoSentences(concept.summary)}</p>
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
          
          <div className="flex items-center justify-start">
            <Button variant="secondary" onClick={handleGenerateConcepts} disabled={isGenerating}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Regenerate Concepts
            </Button>
          </div>
        </>
      )}
      
      {/* Expanded phase */}
      {phase === 'expanded' && (
        <>
          {expansionStatus === 'running' && (
            <div className="mb-6 p-4 rounded-lg border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]">
              <p className="text-sm text-[var(--foreground)] font-medium mb-1">
                We&apos;re expanding your selected ending in the background.
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">
                Please stay on this page. Navigating away may interrupt generation.
              </p>
              <div className="mt-4">
                <LoadingContent message="Expanding your selected ending..." />
              </div>
            </div>
          )}
          {expansionStatus === 'error' && (
            <div className="mb-6 p-4 rounded-lg border border-[var(--destructive)] bg-[rgba(139,38,53,0.1)]">
              <p className="text-sm text-[var(--destructive)]">
                {expansionError || 'Expansion failed. Please try again.'}
              </p>
            </div>
          )}
          {!!expandedContent && (
          <ContentDisplay
            content={expandedContent}
            isEditing={isEditing && !isApproved}
            onContentChange={setExpandedContent}
          />
          )}
          <StageActions
            onApprove={handleApproveClick}
            onRegenerate={handleExpandEndingInBackground}
            onEdit={() => setIsEditing(!isEditing)}
            isApproved={isApproved}
            isGenerating={isGenerating || expansionStatus === 'running'}
            canApprove={!!expandedContent && expansionStatus === 'complete' && !isApproved}
            showEdit={!isApproved}
            approveLabel="Continue to Cast of Characters"
          />
          {expansionStatus !== 'complete' && !isApproved && (
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">
              Continue unlocks when ending expansion finishes.
            </p>
          )}
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
