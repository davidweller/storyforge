'use client';

import { use, useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useProject } from '@/hooks/useProject';
import { useGenerate } from '@/hooks/useGenerate';
import { useProjectStore } from '@/stores/projectStore';
import { StageLayout, ContentDisplay, LoadingContent, EmptyContent } from '@/components/stages';
import { Button } from '@/components/ui';
import { getNextStage } from '@/lib/utils';
import {
  EDITORIAL_PASSES,
  EDITORIAL_PASS_LABELS,
  documentTypeForEditorialPass,
  latestEditorialDocContentForPass,
  approvedEditorialDocForPass,
  canStartEditorialPass,
  parseEditorialPass,
} from '@/lib/editorial/passes';
import type { WorkflowStage, EditorialPass } from '@/types';

interface EditorialPageProps {
  params: Promise<{ projectId: string }>;
}


export default function EditorialPage({ params }: EditorialPageProps) {
  const { projectId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const editorialPass: EditorialPass = parseEditorialPass(searchParams.get('pass')) ?? 'structural';

  const {
    project,
    documents,
    chapters,
    editorialIssues,
    revisionTasks,
    loading: projectLoading,
    error: projectError,
    getDocumentByType,
    getApprovedChapterVersion,
    getOpenIssuesCount,
  } = useProject(projectId);
  
  const {
    createDocument,
    updateDocument,
    approveDocument,
    loadEditorialIssues,
    advanceStage,
    loadChapterVersions,
    createRevisionTask,
    deleteRevisionTasksForProjectAndPass,
    loadRevisionTasks,
  } = useProjectStore();
  const { generate, isGenerating, error: generateError, clearError } = useGenerate();
  
  const [editorialContent, setEditorialContent] = useState('');
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [modelSwitchMessage, setModelSwitchMessage] = useState<string | null>(null);

  const docTypeForPass = useMemo(() => documentTypeForEditorialPass(editorialPass), [editorialPass]);

  const getApprovedStub = (chapterId: string) =>
    getApprovedChapterVersion(chapterId) ? { content: '' } : undefined;
  const canStartThisPass = canStartEditorialPass(
    editorialPass,
    chapters,
    getApprovedStub,
    revisionTasks
  );
  
  // Load versions for all chapters when chapters are available
  useEffect(() => {
    if (chapters.length > 0) {
      chapters.forEach(ch => {
        loadChapterVersions(ch.id);
      });
    }
  }, [chapters, loadChapterVersions]);
  
  useEffect(() => {
    if (projectId) loadRevisionTasks(projectId);
  }, [projectId, loadRevisionTasks]);

  // Load existing editorial content for this pass
  useEffect(() => {
    const loaded = latestEditorialDocContentForPass(documents, editorialPass);
    if (loaded) {
      setEditorialContent(loaded.content);
      const t = docTypeForPass;
      const match =
        documents
          .filter((d) => d.type === t)
          .sort((a, b) => b.version - a.version)[0] ||
        (editorialPass === 'structural'
          ? documents.filter((d) => d.type === 'editorial').sort((a, b) => b.version - a.version)[0]
          : undefined);
      setCurrentDocId(match?.id ?? null);
    } else {
      setEditorialContent('');
      setCurrentDocId(null);
    }
  }, [documents, editorialPass, docTypeForPass]);
  
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
  
  const isApproved = approvedEditorialDocForPass(documents, editorialPass);
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
    let chapterCount = 0;
    
    // Sort chapters by chapter number
    const sortedChapters = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber);
    
    for (const chapter of sortedChapters) {
      const version = getApprovedChapterVersion(chapter.id);
      if (version && version.content) {
        // Strip HTML tags if present
        const textContent = version.content.replace(/<[^>]+>/g, '').trim();
        
        if (textContent.length > 0) {
          manuscript += `\n\n## Chapter ${chapter.chapterNumber}: ${chapter.title}\n\n`;
          manuscript += textContent;
          chapterCount++;
        }
      }
    }
    
    console.log('Compiled manuscript:', {
      chapterCount,
      totalChapters: chapters.length,
      manuscriptLength: manuscript.length,
      hasContent: manuscript.trim().length > 0,
    });
    
    if (manuscript.trim().length === 0) {
      throw new Error('No approved chapter content found. Please approve at least one chapter before generating an editorial review.');
    }
    
    return manuscript.trim();
  };
  
  // Handle generation
  const handleGenerate = async () => {
    console.log('Re-analyze button clicked');
    clearError();

    if (!canStartThisPass) {
      throw new Error('Complete the previous editorial pass and its revisions before starting this pass.');
    }
    
    // Clear existing content when starting a new analysis
    setEditorialContent('');
    
    try {
      // Ensure all chapter versions are loaded before compiling
      console.log('Loading chapter versions...');
      await Promise.all(chapters.map(ch => loadChapterVersions(ch.id)));
      
      console.log('Starting editorial review generation...');
      const manuscript = compileManuscript();
      
      // Validate manuscript with detailed checks
      if (!manuscript || manuscript.trim().length === 0) {
        throw new Error('Cannot generate editorial review: No manuscript content available. Please ensure you have approved chapters with content.');
      }
      
      // Validate manuscript has substantial content (at least 1000 characters)
      if (manuscript.trim().length < 1000) {
        console.warn('Manuscript is very short:', manuscript.length, 'characters');
      }
      
      // Count chapters in manuscript
      const chapterMatches = manuscript.match(/## Chapter \d+:/g);
      const chapterCount = chapterMatches ? chapterMatches.length : 0;
      
      // Estimate token count (rough: 1 token ≈ 4 characters)
      const estimatedManuscriptTokens = Math.ceil(manuscript.length / 4);
      const referenceDocsLength = [
        getDocumentByType('niche')?.content,
        getDocumentByType('characters')?.content,
        getDocumentByType('ending')?.content,
        getDocumentByType('structure')?.content,
      ].filter(Boolean).reduce((sum, doc) => sum + (doc?.length || 0), 0);
      const estimatedReferenceTokens = Math.ceil(referenceDocsLength / 4);
      const estimatedPromptOverhead = 2000; // System prompt + instructions
      const estimatedTotalTokens = estimatedManuscriptTokens + estimatedReferenceTokens + estimatedPromptOverhead;
      
      // Model context limits (client-side hints; API enforces app cap via MAX_MANUSCRIPT_TOKENS)
      const gpt52ContextTokens = 128000; // GPT-5.2
      const openaiLargeContextTokens = 1_000_000; // GPT-5.4 etc.
      const claude46ContextTokens = 1_000_000; // Claude Sonnet 4.6 (fallback)
      
      console.log('[Editorial] Manuscript validation:', {
        totalLength: manuscript.length,
        trimmedLength: manuscript.trim().length,
        chapterCount,
        wordCount: manuscript.split(/\s+/).length,
        estimatedManuscriptTokens,
        estimatedReferenceTokens,
        estimatedTotalTokens,
        gpt52ContextTokens,
        openaiLargeContextTokens,
        claude46ContextTokens,
        willExceedGPT52: estimatedTotalTokens > gpt52ContextTokens,
        willExceedClaude46: estimatedTotalTokens > claude46ContextTokens,
        first100Chars: manuscript.substring(0, 100),
        last100Chars: manuscript.substring(Math.max(0, manuscript.length - 100)),
      });
      
      // Verify manuscript contains actual chapter content
      if (chapterCount === 0) {
        throw new Error('Manuscript does not contain any chapters. Please ensure chapters are properly formatted.');
      }
      
      if (estimatedTotalTokens > claude46ContextTokens) {
        const manuscriptWordCount = Math.ceil(manuscript.length / 5);
        const maxWords = Math.floor((claude46ContextTokens - estimatedReferenceTokens - estimatedPromptOverhead) * 0.8);
        throw new Error(
          `Manuscript is too long for editorial review.\n\n` +
          `• Your manuscript: ~${manuscriptWordCount.toLocaleString()} words (${estimatedTotalTokens.toLocaleString()} tokens)\n` +
          `• Maximum supported: ~${maxWords.toLocaleString()} words (${claude46ContextTokens.toLocaleString()} tokens)\n\n` +
          `Your manuscript exceeds the supported context window. Please consider reviewing in batches or focusing on specific sections.`
        );
      }
      
      if (estimatedTotalTokens > gpt52ContextTokens && estimatedTotalTokens <= openaiLargeContextTokens) {
        console.log('[Editorial] Manuscript exceeds GPT-5.2 context; API may switch to Claude Sonnet 4.6 if the selected model is GPT-5.2:', {
          estimatedTotalTokens,
          gpt52ContextTokens,
          claude46ContextTokens,
        });
      }
      
      if (estimatedTotalTokens > gpt52ContextTokens * 0.8 && estimatedTotalTokens <= gpt52ContextTokens) {
        console.warn('[Editorial] Manuscript approaching GPT-5.2 context limit:', {
          estimatedTotalTokens,
          gpt52ContextTokens,
          percentage: ((estimatedTotalTokens / gpt52ContextTokens) * 100).toFixed(1) + '%',
        });
      }
      
      if (estimatedTotalTokens > gpt52ContextTokens && estimatedTotalTokens > claude46ContextTokens * 0.8) {
        console.warn('[Editorial] Manuscript approaching Claude Sonnet 4.6 context limit:', {
          estimatedTotalTokens,
          claude46ContextTokens,
          percentage: ((estimatedTotalTokens / claude46ContextTokens) * 100).toFixed(1) + '%',
        });
      }
      
      const nicheDoc = getDocumentByType('niche');
      const charactersDoc = getDocumentByType('characters');
      const endingDoc = getDocumentByType('ending');
      const structureDoc = getDocumentByType('structure');
      
      console.log('[Editorial] Generating review with:', {
        manuscriptLength: manuscript.length,
        manuscriptWordCount: manuscript.split(/\s+/).length,
        chapterCount,
        hasNiche: !!nicheDoc,
        nicheLength: nicheDoc?.content?.length || 0,
        hasCharacters: !!charactersDoc,
        charactersLength: charactersDoc?.content?.length || 0,
        hasEnding: !!endingDoc,
        endingLength: endingDoc?.content?.length || 0,
        hasStructure: !!structureDoc,
        structureLength: structureDoc?.content?.length || 0,
        genre: project.genre,
      });
      
      // Log that manuscript will be included in prompt
      console.log('[Editorial] Manuscript will be included in prompt. First 200 chars:', manuscript.substring(0, 200));
      
      const result = await generate('editorial', {
        manuscript,
        genre: project.genre,
        nicheReference: nicheDoc?.content,
        charactersReference: charactersDoc?.content,
        endingReference: endingDoc?.content,
        structureReference: structureDoc?.content,
        editorialPass,
      });
      
      // Check if model was switched (the API will return this in the response)
      const resultWithSwitch = result as any;
      if (resultWithSwitch.modelSwitched && resultWithSwitch.switchMessage) {
        setModelSwitchMessage(resultWithSwitch.switchMessage);
      } else {
        setModelSwitchMessage(null);
      }
      
      setEditorialContent(result.content);
      
      const latestThisType = documents
        .filter((d) => d.type === docTypeForPass)
        .sort((a, b) => b.version - a.version)[0];
      const nextVersion = (latestThisType?.version ?? 0) + 1;

      if (currentDocId) {
        await updateDocument(currentDocId, {
          content: result.content,
          version: nextVersion,
        });
      } else {
        const newDocId = await createDocument({
          projectId,
          type: docTypeForPass,
          content: result.content,
          version: nextVersion,
          approved: false,
        });
        setCurrentDocId(newDocId);
      }
      
      // Parse and create editorial issues (simplified - in production, use structured output)
      // This would normally parse the JSON response and create individual issues
      
    } catch (err) {
      console.error('Error generating editorial review:', err);
      // Error is handled by hook and will be displayed in the error section
      // Re-throw to ensure error state is set
      if (err instanceof Error) {
        throw err;
      }
      throw new Error('Failed to generate editorial review');
    }
  };
  
  // Handle continue to revision
  const handleContinueToRevision = async () => {
    try {
      clearError();
      
      // Ensure editorial content exists
      if (!editorialContent || editorialContent.trim().length === 0) {
        throw new Error('No editorial review available. Please generate an editorial review first.');
      }
      
      // Approve editorial document if not already approved
      if (currentDocId && !isApproved) {
        await approveDocument(currentDocId);
      }
      
      console.log('[Editorial] Creating revision queue from editorial report...');

      await deleteRevisionTasksForProjectAndPass(projectId, editorialPass);
      
      // Generate revision queue from editorial report
      const result = await generate('editorial', {
        createQueue: true,
        editorialReport: editorialContent,
        chapterCount: chapters.length,
        editorialPass,
      });
      
      console.log('[Editorial] Revision queue response received:', {
        contentLength: result.content?.length || 0,
        hasContent: !!result.content,
      });
      
      // Parse JSON response
      let revisionQueueData: {
        revisionTasks: Array<{
          chapterNumber: number;
          issueCount: number;
          priority: string;
          summary: string;
          issues: Array<{
            category: string;
            description: string;
            location: string;
            fix: string;
          }>;
          acceptanceCriteria: string[];
          preserveElements: string[];
        }>;
      };
      
      try {
        // Extract JSON from markdown code blocks if present
        let jsonContent = result.content;
        const jsonMatch = jsonContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          jsonContent = jsonMatch[1];
        }
        
        revisionQueueData = JSON.parse(jsonContent);
      } catch (parseError) {
        console.error('[Editorial] Failed to parse revision queue JSON:', parseError);
        console.error('[Editorial] Raw response:', result.content);
        throw new Error('Failed to parse revision queue. The AI response was not in the expected format.');
      }
      
      if (!revisionQueueData.revisionTasks || !Array.isArray(revisionQueueData.revisionTasks)) {
        throw new Error('Invalid revision queue format. Expected revisionTasks array.');
      }
      
      console.log('[Editorial] Creating revision tasks:', {
        taskCount: revisionQueueData.revisionTasks.length,
      });
      
      // Create revision tasks in Firestore
      for (const taskData of revisionQueueData.revisionTasks) {
        // Build instructions from issues
        const instructions = taskData.issues
          .map((issue) => `${issue.category}: ${issue.description}\nLocation: ${issue.location}\nFix: ${issue.fix}`)
          .join('\n\n');
        
        // If no issues, use summary as instructions
        const finalInstructions = taskData.issueCount > 0 
          ? instructions 
          : taskData.summary || 'Review chapter for overall quality and consistency.';
        
        await createRevisionTask({
          projectId,
          chapterNumber: taskData.chapterNumber,
          editPass: editorialPass,
          issueIds: [],
          instructions: finalInstructions,
          acceptanceCriteria: taskData.acceptanceCriteria || [],
          status: taskData.issueCount > 0 ? 'queued' : 'done',
        });
        
        console.log('[Editorial] Created revision task for chapter', taskData.chapterNumber);
      }
      
      console.log('[Editorial] All revision tasks created successfully');
      
      // Advance to revision stage
      const nextStage = getNextStage('editorial');
      if (nextStage && project.currentStage === 'editorial') {
        await advanceStage(projectId, nextStage as WorkflowStage);
      }
      
      router.push(`/projects/${projectId}/stage/revision?pass=${editorialPass}`);
    } catch (err) {
      console.error('[Editorial] Error creating revision queue:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create revision queue';
      // Error will be displayed by the error handling in the component
      throw err;
    }
  };
  
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
      revisionTasks={revisionTasks}
      documents={documents}
      fourPassEditorial={!!project.fourPassEditorial}
      blurbFilled={!!project.blurb?.trim()}
      amazonDescriptionFilled={!!project.amazonDescription?.trim()}
    >
      <div className="flex flex-wrap gap-2 mb-6">
        {EDITORIAL_PASSES.map((p) => {
          const can = canStartEditorialPass(p, chapters, getApprovedStub, revisionTasks);
          const active = p === editorialPass;
          return (
            <Button
              key={p}
              variant={active ? 'primary' : 'secondary'}
              disabled={!can && !active}
              onClick={() => router.push(`/projects/${projectId}/stage/editorial?pass=${p}`)}
              className="text-sm"
            >
              {EDITORIAL_PASS_LABELS[p]}
            </Button>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Pass: <strong>{EDITORIAL_PASS_LABELS[editorialPass]}</strong>
        {!canStartThisPass && (
          <span className="block mt-1 text-amber-700">
            Complete the prior pass and approve all its chapter revisions before running this pass.
          </span>
        )}
      </p>
      {/* Error */}
      {(projectError || generateError) && (
        <div className="mb-6 p-4 bg-[rgba(139,38,53,0.1)] border border-[var(--destructive)] rounded-lg">
          <p className="text-sm text-[var(--destructive)]">{projectError || generateError}</p>
        </div>
      )}
      
      {/* Model Switch Message */}
      {modelSwitchMessage && (
        <div className="mb-6 p-4 bg-[rgba(59,130,246,0.1)] border border-blue-500 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-700 mb-1">Model Automatically Switched</p>
              <p className="text-sm text-blue-600 whitespace-pre-line">{modelSwitchMessage}</p>
            </div>
          </div>
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
          description="Submit your manuscript for AI-powered editorial analysis. You'll receive detailed feedback scoped to this pass (structural through proofread)."
          actionLabel="Start Editorial Review"
          onAction={handleGenerate}
          isLoading={isGenerating}
          disabled={!canStartThisPass}
        />
      )}
      
      {/* Editorial content */}
      {!isGenerating && editorialContent && (
        <>
          {/* Full report */}
          <ContentDisplay content={editorialContent} className="mb-6" />
          
          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button 
              variant="secondary" 
              onClick={handleGenerate} 
              disabled={isGenerating || !canStartThisPass}
              loading={isGenerating}
            >
              {!isGenerating && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
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
