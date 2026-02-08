import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase/admin';
import { generateForStage } from '@/lib/llm';
import { getModelById, getDefaultModelForStage } from '@/lib/data/models';
import { MAX_MANUSCRIPT_TOKENS, TARGET_MANUSCRIPT_WORDS } from '@/lib/constants';
import type { WorkflowStage } from '@/types';
import {
  GENRE_RESEARCH_SYSTEM,
  buildGenreResearchPrompt,
  NICHE_SYSTEM,
  buildNichePrompt,
  ENDING_SYSTEM,
  buildEndingConceptsPrompt,
  buildEndingExpansionPrompt,
  CHARACTERS_SYSTEM,
  buildCharactersPrompt,
  STRUCTURE_SYSTEM,
  buildStructurePrompt,
  TITLE_IDEAS_SYSTEM,
  buildTitleIdeasPrompt,
  CHAPTER_OUTLINES_SYSTEM,
  buildChapterOutlinesPrompt,
  CHAPTERS_SYSTEM,
  buildChapterPrompt,
  buildChapterRevisionPrompt,
  EDITORIAL_SYSTEM,
  buildEditorialPrompt,
  buildRevisionQueuePrompt,
  BLURB_SYSTEM,
  buildBlurbPrompt,
  AMAZON_DESCRIPTION_SYSTEM,
  buildAmazonDescriptionPrompt,
} from '@/lib/prompts';

// Bypass auth in development mode
const DEV_MODE_BYPASS_AUTH = process.env.NODE_ENV === 'development';
const DEV_USER_ID = 'dev-user-123';

// Verify Firebase auth token
async function verifyToken(request: NextRequest): Promise<string | null> {
  // In dev mode, return a mock user ID
  if (DEV_MODE_BYPASS_AUTH) {
    return DEV_USER_ID;
  }
  
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.split('Bearer ')[1];
  try {
    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken.uid;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  // Authentication disabled for testing
  // const userId = await verifyToken(request);
  // if (!userId) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }
  
  try {
    const body = await request.json();
    const { stage, data, model: requestedModel } = body as { 
      stage: WorkflowStage; 
      data: Record<string, unknown>;
      model?: string; // Optional model override
    };
    
    // Variables for model switching (used in editorial stage)
    let model = requestedModel;
    let modelSwitched = false;
    let switchMessage = '';
    
    console.log('[API] Generate request received:', { stage, model, hasData: !!data });
    
    if (!stage || !data) {
      console.error('[API] Missing stage or data:', { stage, hasData: !!data });
      return NextResponse.json({ error: 'Missing stage or data' }, { status: 400 });
    }
    
    let prompt: string;
    let systemPrompt: string;
    
    switch (stage) {
      case 'genre-research':
        systemPrompt = GENRE_RESEARCH_SYSTEM;
        prompt = buildGenreResearchPrompt({
          premise: data.premise as string | undefined,
          genre: data.genre as string,
          research: data.research as string | undefined,
        });
        break;
        
      case 'niche':
        systemPrompt = NICHE_SYSTEM;
        prompt = buildNichePrompt({
          premise: data.premise as string | undefined,
          genre: data.genre as string,
          genreResearch: data.genreResearch as string,
        });
        break;
        
      case 'ending':
        systemPrompt = ENDING_SYSTEM;
        if (data.selectedEnding) {
          prompt = buildEndingExpansionPrompt({
            premise: data.premise as string | undefined,
            genre: data.genre as string,
            nicheReference: data.nicheReference as string,
            selectedEnding: data.selectedEnding as string,
          });
        } else {
          prompt = buildEndingConceptsPrompt({
            premise: data.premise as string | undefined,
            genre: data.genre as string,
            nicheReference: data.nicheReference as string,
          });
        }
        break;
        
      case 'characters':
        systemPrompt = CHARACTERS_SYSTEM;
        prompt = buildCharactersPrompt({
          premise: data.premise as string | undefined,
          genre: data.genre as string,
          nicheReference: data.nicheReference as string,
          endingReference: data.endingReference as string,
        });
        break;
        
      case 'structure':
        systemPrompt = STRUCTURE_SYSTEM;
        prompt = buildStructurePrompt({
          premise: data.premise as string | undefined,
          genre: data.genre as string,
          nicheReference: data.nicheReference as string,
          endingReference: data.endingReference as string,
          charactersReference: data.charactersReference as string,
          maxTotalWords: TARGET_MANUSCRIPT_WORDS,
        });
        break;
        
      case 'title':
        systemPrompt = TITLE_IDEAS_SYSTEM;
        prompt = buildTitleIdeasPrompt({
          genre: data.genre as string,
          premise: data.premise as string | undefined,
          nicheReference: data.nicheReference as string | undefined,
          structureReference: data.structureReference as string | undefined,
          endingReference: data.endingReference as string | undefined,
          charactersReference: data.charactersReference as string | undefined,
        });
        break;
        
      case 'chapter-outlines':
        systemPrompt = CHAPTER_OUTLINES_SYSTEM;
        prompt = buildChapterOutlinesPrompt({
          premise: data.premise as string | undefined,
          genre: data.genre as string,
          structureReference: data.structureReference as string,
          charactersReference: data.charactersReference as string,
          endingReference: data.endingReference as string,
          genreResearch: data.genreResearch as string | undefined,
          nicheReference: data.nicheReference as string | undefined,
          maxTotalWords: TARGET_MANUSCRIPT_WORDS,
        });
        break;
        
      case 'chapters':
        systemPrompt = CHAPTERS_SYSTEM;
        prompt = buildChapterPrompt({
          genre: data.genre as string,
          chapterNumber: data.chapterNumber as number,
          chapterTitle: data.chapterTitle as string,
          beatReference: data.beatReference as string,
          sceneGoal: data.sceneGoal as string,
          pov: data.pov as string | undefined,
          charactersReference: data.charactersReference as string,
          endingReference: data.endingReference as string,
          previousChapterSummary: data.previousChapterSummary as string | undefined,
          structureContext: data.structureContext as string,
          genreResearch: data.genreResearch as string | undefined,
          nicheReference: data.nicheReference as string | undefined,
          wordTarget: data.wordTarget as number | undefined,
        });
        break;
        
      case 'editorial':
        systemPrompt = EDITORIAL_SYSTEM;
        
        // Use requested model or stage default (e.g. Claude Opus 4.5)
        let selectedModel = model || getDefaultModelForStage('editorial').id;
        // modelSwitched and switchMessage are already declared at function scope
        
        if (data.createQueue) {
          prompt = buildRevisionQueuePrompt({
            editorialReport: data.editorialReport as string,
            chapterCount: data.chapterCount as number,
          });
        } else {
          // Validate manuscript is provided
          const manuscript = data.manuscript as string;
          if (!manuscript || typeof manuscript !== 'string' || manuscript.trim().length === 0) {
            console.error('[API] Editorial request missing manuscript:', {
              hasManuscript: !!data.manuscript,
              manuscriptType: typeof data.manuscript,
              manuscriptLength: manuscript?.length || 0,
            });
            return NextResponse.json({ 
              error: 'Manuscript content is required for editorial review. Please ensure you have approved chapters with content.' 
            }, { status: 400 });
          }
          
          // Estimate token count (rough approximation: 1 token ≈ 4 characters)
          const estimatedManuscriptTokens = Math.ceil(manuscript.length / 4);
          const referenceDocsLength = [
            data.nicheReference,
            data.charactersReference,
            data.endingReference,
            data.structureReference,
          ].filter(Boolean).reduce((sum: number, doc) => sum + (doc as string).length, 0);
          const estimatedReferenceTokens = Math.ceil(referenceDocsLength / 4);
          const estimatedPromptOverhead = 2000; // System prompt + instructions
          const estimatedTotalTokens = estimatedManuscriptTokens + estimatedReferenceTokens + estimatedPromptOverhead;
          
          // Get selected model context limit; use fallback (Claude Sonnet 4.5, 200k) if manuscript exceeds it
          const selectedModelConfig = getModelById(selectedModel);
          const selectedMaxContext = selectedModelConfig?.maxContextTokens || 128000;
          const fallbackModelId = 'claude-sonnet-4-5';
          const fallbackModelConfig = getModelById(fallbackModelId);
          const fallbackMaxContext = fallbackModelConfig?.maxContextTokens || 200000;
          
          if (estimatedTotalTokens > selectedMaxContext && fallbackMaxContext > selectedMaxContext && estimatedTotalTokens <= fallbackMaxContext) {
            const selectedName = selectedModelConfig?.name || selectedModel;
            const fallbackName = fallbackModelConfig?.name || fallbackModelId;
            selectedModel = fallbackModelId;
            modelSwitched = true;
            const manuscriptWordCount = Math.ceil(manuscript.length / 5);
            switchMessage = `Your manuscript (approximately ${manuscriptWordCount.toLocaleString()} words, ${estimatedTotalTokens.toLocaleString()} tokens) exceeds ${selectedName}'s context limit (${selectedMaxContext.toLocaleString()} tokens). We've automatically switched to ${fallbackName}, which supports up to ${fallbackMaxContext.toLocaleString()} tokens, to complete the editorial review.`;
            
            console.log('[API] Switching to fallback model due to manuscript size:', {
              estimatedTotalTokens,
              selectedMaxContext,
              fallbackMaxContext,
              modelSwitched: true,
            });
          }
          
          // Use app cap (190k) so editorial always fits; never exceed model context
          const currentModelConfig = getModelById(selectedModel);
          const modelContextTokens = currentModelConfig?.maxContextTokens || 128000;
          const effectiveMaxTokens = Math.min(modelContextTokens, MAX_MANUSCRIPT_TOKENS);
          const warningThreshold = effectiveMaxTokens * 0.8;
          
          // Final check - if still too large, return error
          if (estimatedTotalTokens > effectiveMaxTokens) {
            const manuscriptWordCount = Math.ceil(manuscript.length / 5);
            const maxWordsSupported = Math.floor((effectiveMaxTokens - estimatedReferenceTokens - estimatedPromptOverhead) * (4 / 5));
            return NextResponse.json({ 
              error: `Manuscript is too long for editorial review.\n\n` +
                     `• Your manuscript: ~${manuscriptWordCount.toLocaleString()} words (${estimatedTotalTokens.toLocaleString()} tokens)\n` +
                     `• Maximum supported: ~${maxWordsSupported.toLocaleString()} words (${effectiveMaxTokens.toLocaleString()} tokens)\n\n` +
                     `Please keep your manuscript within the limit when planning chapters (e.g. Structure and Chapter Outlines stages), or consider reviewing in batches or focusing on specific sections.`
            }, { status: 400 });
          }
          
          if (estimatedTotalTokens > warningThreshold) {
            console.warn('[API] Manuscript approaching context limit:', {
              estimatedTotalTokens,
              warningThreshold,
              effectiveMaxTokens,
              percentage: ((estimatedTotalTokens / effectiveMaxTokens) * 100).toFixed(1) + '%',
              model: selectedModel,
            });
          }
          
          console.log('[API] Building editorial prompt:', {
            model: selectedModel,
            modelSwitched,
            manuscriptLength: manuscript.length,
            estimatedManuscriptTokens,
            estimatedReferenceTokens,
            estimatedTotalTokens,
            effectiveMaxTokens,
            genre: data.genre,
            hasNiche: !!data.nicheReference,
            hasCharacters: !!data.charactersReference,
            hasEnding: !!data.endingReference,
            hasStructure: !!data.structureReference,
          });
          
          prompt = buildEditorialPrompt({
            manuscript,
            genre: data.genre as string,
            nicheReference: data.nicheReference as string | undefined,
            charactersReference: data.charactersReference as string | undefined,
            endingReference: data.endingReference as string | undefined,
            structureReference: data.structureReference as string | undefined,
          });
          
          console.log('[API] Editorial prompt built:', {
            promptLength: prompt.length,
            estimatedPromptTokens: Math.ceil(prompt.length / 4),
            manuscriptIncluded: prompt.includes(manuscript.substring(0, 100)),
            model: selectedModel,
          });
        }
        
        // Override model for this generation (update the function-scope variable)
        model = selectedModel;
        break;
        
      case 'revision':
        systemPrompt = CHAPTERS_SYSTEM; // Reuse chapter system prompt for revisions
        
        // Validate required data
        if (!data.originalContent || typeof data.originalContent !== 'string') {
          return NextResponse.json({ error: 'Missing or invalid originalContent' }, { status: 400 });
        }
        
        console.log('Processing revision request:', {
          hasOriginalContent: !!data.originalContent,
          originalContentLength: (data.originalContent as string).length,
          hasInstructions: !!data.revisionInstructions,
          instructionsLength: (data.revisionInstructions as string)?.length || 0,
          acceptanceCriteriaCount: Array.isArray(data.acceptanceCriteria) ? data.acceptanceCriteria.length : 0,
        });
        
        prompt = buildChapterRevisionPrompt({
          originalChapter: data.originalContent as string,
          revisionInstructions: data.revisionInstructions as string || 'Review and improve the chapter.',
          acceptanceCriteria: Array.isArray(data.acceptanceCriteria) 
            ? data.acceptanceCriteria as string[]
            : [],
          charactersReference: data.charactersReference as string || '',
          endingReference: data.endingReference as string || '',
          structureReference: data.structureReference as string | undefined,
          nicheReference: data.nicheReference as string | undefined,
        });
        break;

      case 'blurb':
        systemPrompt = BLURB_SYSTEM;
        prompt = buildBlurbPrompt({
          genre: data.genre as string,
          niche: data.niche as string | undefined,
          title: data.title as string | undefined,
          premise: data.premise as string | undefined,
          marketAnalysis: data.marketAnalysis as string | undefined,
          readerTargeting: data.readerTargeting as string | undefined,
          plotBlueprint: data.plotBlueprint as string | undefined,
        });
        break;

      case 'amazon-description':
        systemPrompt = AMAZON_DESCRIPTION_SYSTEM;
        prompt = buildAmazonDescriptionPrompt({
          genre: data.genre as string,
          niche: data.niche as string | undefined,
          title: data.title as string | undefined,
          premise: data.premise as string | undefined,
          marketAnalysis: data.marketAnalysis as string | undefined,
          readerTargeting: data.readerTargeting as string | undefined,
          plotBlueprint: data.plotBlueprint as string | undefined,
        });
        break;
        
      default:
        return NextResponse.json({ error: 'Invalid stage' }, { status: 400 });
    }
    
    // Get model info for logging
    const modelInfo = model ? getModelById(model) : null;
    const modelDisplayName = modelInfo?.name || model || 'default';
    
    console.log('[API] Calling generateForStage:', { 
      stage, 
      promptLength: prompt.length, 
      systemPromptLength: systemPrompt?.length || 0,
      model: modelDisplayName,
      modelId: model || 'default',
    });
    
    // Use JSON mode for revision queue generation
    const useJsonMode = stage === 'editorial' && !!data.createQueue;
    
    const result = await generateForStage(stage, prompt, {
      systemPrompt,
      temperature: data.temperature as number | undefined,
      model, // Pass model override if provided (may have been switched for editorial)
      jsonMode: useJsonMode, // Enable JSON mode for revision queue
    });
    
    // Get result model info for logging
    const resultModelInfo = getModelById(result.model);
    const resultModelDisplayName = resultModelInfo?.name || result.model;
    
    console.log('[API] Generation complete:', {
      stage,
      contentLength: result.content?.length || 0,
      model: resultModelDisplayName,
      modelId: result.model,
      provider: result.provider,
      tokensUsed: result.tokensUsed,
      modelSwitched: stage === 'editorial' ? modelSwitched : false,
    });
    
    // Return response with model switch message if applicable
    const response: any = {
      content: result.content,
      model: result.model,
      provider: result.provider,
      tokensUsed: result.tokensUsed,
    };
    
    if (stage === 'editorial' && modelSwitched && switchMessage) {
      response.modelSwitched = true;
      response.switchMessage = switchMessage;
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
