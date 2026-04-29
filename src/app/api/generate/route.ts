import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateForStage } from '@/lib/llm';
import { getModelById, getDefaultModelForStage, ALL_MODELS } from '@/lib/data/models';
import { MAX_MANUSCRIPT_TOKENS, TARGET_MANUSCRIPT_WORDS } from '@/lib/constants';
import type { WorkflowStage, EditorialPass } from '@/types';

const EDITORIAL_PASS_VALUES: EditorialPass[] = [
  'structural',
  'line',
  'copy',
  'proofread',
  'final_report',
];

function parseEditorialPass(value: unknown): EditorialPass {
  if (typeof value === 'string' && EDITORIAL_PASS_VALUES.includes(value as EditorialPass)) {
    return value as EditorialPass;
  }
  return 'structural';
}
import {
  GENRE_RESEARCH_SYSTEM, buildGenreResearchPrompt,
  NICHE_SYSTEM, buildNichePrompt,
  ENDING_SYSTEM, buildEndingConceptsPrompt, buildEndingExpansionPrompt,
  CHARACTERS_SYSTEM, buildCharactersPrompt,
  STRUCTURE_SYSTEM, buildStructurePrompt,
  TITLE_IDEAS_SYSTEM, buildTitleIdeasPrompt,
  CHAPTER_OUTLINES_SYSTEM, buildChapterOutlinesPrompt,
  buildChapterSummaryPrompt,
  CHAPTERS_SYSTEM, buildChapterPrompt, buildChapterRevisionPrompt,
  EDITORIAL_SYSTEM, buildEditorialPrompt, buildRevisionQueuePrompt,
  BLURB_SYSTEM, buildBlurbPrompt,
  AMAZON_DESCRIPTION_SYSTEM, buildAmazonDescriptionPrompt,
} from '@/lib/prompts';

/** Long editorials need headroom on Vercel and similar hosts (local dev usually ignores this). */
export const maxDuration = 800;

const WORKFLOW_STAGES = [
  'setup', 'genre-research', 'niche', 'ending', 'characters', 'structure',
  'title', 'chapter-outlines', 'chapter-summary', 'chapters', 'compilation', 'export-draft',
  'editorial', 'revision', 'export-final', 'blurb', 'amazon-description',
] as const;

const GenerateBodySchema = z.object({
  stage: z.enum(WORKFLOW_STAGES),
  data: z.record(z.string(), z.unknown()),
  model: z.string().optional().refine(
    (m) => !m || ALL_MODELS.some((lm) => lm.id === m),
    { message: 'Unknown model ID' }
  ),
});

type D = Record<string, unknown>;

const EditorialPassSchema = z.enum(['structural', 'line', 'copy', 'proofread', 'final_report']);
const optionalString = z.string().optional();
const requiredString = z.string().min(1);
const ProjectContextSchema = z.object({
  premise: optionalString,
  genre: requiredString,
  research: optionalString,
}).passthrough();
const ChapterContinuitySummarySchema = z.object({
  chapterNumber: z.number(),
  title: z.string(),
  summary: z.string(),
});

const STAGE_DATA_SCHEMAS: Partial<Record<WorkflowStage, z.ZodTypeAny>> = {
  'genre-research': ProjectContextSchema,
  niche: ProjectContextSchema.extend({
    genreResearch: z.string(),
  }).passthrough(),
  ending: ProjectContextSchema.extend({
    nicheReference: z.string(),
    selectedEnding: optionalString,
  }).passthrough(),
  characters: ProjectContextSchema.extend({
    nicheReference: z.string(),
    endingReference: z.string(),
  }).passthrough(),
  structure: ProjectContextSchema.extend({
    nicheReference: z.string(),
    endingReference: z.string(),
    charactersReference: z.string(),
  }).passthrough(),
  title: z.object({
    genre: requiredString,
    premise: optionalString,
    nicheReference: optionalString,
    structureReference: optionalString,
    endingReference: optionalString,
    charactersReference: optionalString,
  }).passthrough(),
  'chapter-outlines': ProjectContextSchema.extend({
    structureReference: z.string(),
    charactersReference: z.string(),
    endingReference: z.string(),
    genreResearch: optionalString,
    nicheReference: optionalString,
  }).passthrough(),
  'chapter-summary': z.object({
    genre: requiredString,
    chapterNumber: z.number(),
    chapterTitle: requiredString,
    chapterContent: requiredString,
  }).passthrough(),
  chapters: z.object({
    genre: requiredString,
    chapterNumber: z.number(),
    chapterTitle: requiredString,
    beatReference: z.string(),
    sceneGoal: z.string(),
    pov: optionalString,
    charactersReference: z.string(),
    endingReference: z.string(),
    previousChapterSummaries: z.array(ChapterContinuitySummarySchema).optional(),
    structureContext: z.string(),
    genreResearch: optionalString,
    nicheReference: optionalString,
    wordTarget: z.number().optional(),
  }).passthrough().superRefine((value, ctx) => {
    if ('previousChapterSummary' in value) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['previousChapterSummary'],
        message: 'Use previousChapterSummaries as an array of chapter continuity summaries.',
      });
    }
  }),
  editorial: z.union([
    z.object({
      createQueue: z.literal(true),
      editorialReport: requiredString,
      chapterCount: z.number(),
      editorialPass: EditorialPassSchema.optional(),
    }).passthrough(),
    z.object({
      manuscript: requiredString,
      genre: requiredString,
      nicheReference: optionalString,
      charactersReference: optionalString,
      endingReference: optionalString,
      structureReference: optionalString,
      editorialPass: EditorialPassSchema.optional(),
      intendedAudience: optionalString,
      premise: optionalString,
      research: optionalString,
    }).passthrough(),
  ]),
  revision: z.object({
    originalContent: requiredString,
    revisionInstructions: optionalString,
    acceptanceCriteria: z.array(z.string()).optional(),
    charactersReference: z.string().optional(),
    endingReference: z.string().optional(),
    structureReference: optionalString,
    nicheReference: optionalString,
    previousChapterContext: optionalString,
    nextChapterContext: optionalString,
    editorialPass: EditorialPassSchema.optional(),
  }).passthrough(),
  blurb: z.object({
    genre: requiredString,
    niche: optionalString,
    title: optionalString,
    premise: optionalString,
    marketAnalysis: optionalString,
    readerTargeting: optionalString,
    plotBlueprint: optionalString,
  }).passthrough(),
  'amazon-description': z.object({
    genre: requiredString,
    niche: optionalString,
    title: optionalString,
    premise: optionalString,
    marketAnalysis: optionalString,
    readerTargeting: optionalString,
    plotBlueprint: optionalString,
    blurb: optionalString,
  }).passthrough(),
};

/** Lookup map for stages whose prompt building requires no branching logic.
 *  Stages with conditional data (ending, editorial, revision) stay in the switch. */
const SIMPLE_STAGE_HANDLERS: Partial<Record<WorkflowStage, (d: D) => { system: string; prompt: string }>> = {
  'genre-research': (d) => ({ system: GENRE_RESEARCH_SYSTEM, prompt: buildGenreResearchPrompt({ premise: d.premise as string | undefined, genre: d.genre as string, research: d.research as string | undefined }) }),
  'niche': (d) => ({ system: NICHE_SYSTEM, prompt: buildNichePrompt({ premise: d.premise as string | undefined, genre: d.genre as string, genreResearch: d.genreResearch as string }) }),
  'characters': (d) => ({ system: CHARACTERS_SYSTEM, prompt: buildCharactersPrompt({ premise: d.premise as string | undefined, genre: d.genre as string, nicheReference: d.nicheReference as string, endingReference: d.endingReference as string }) }),
  'structure': (d) => ({ system: STRUCTURE_SYSTEM, prompt: buildStructurePrompt({ premise: d.premise as string | undefined, genre: d.genre as string, nicheReference: d.nicheReference as string, endingReference: d.endingReference as string, charactersReference: d.charactersReference as string, maxTotalWords: TARGET_MANUSCRIPT_WORDS }) }),
  'title': (d) => ({ system: TITLE_IDEAS_SYSTEM, prompt: buildTitleIdeasPrompt({ genre: d.genre as string, premise: d.premise as string | undefined, nicheReference: d.nicheReference as string | undefined, structureReference: d.structureReference as string | undefined, endingReference: d.endingReference as string | undefined, charactersReference: d.charactersReference as string | undefined }) }),
  'chapter-outlines': (d) => ({ system: CHAPTER_OUTLINES_SYSTEM, prompt: buildChapterOutlinesPrompt({ premise: d.premise as string | undefined, genre: d.genre as string, structureReference: d.structureReference as string, charactersReference: d.charactersReference as string, endingReference: d.endingReference as string, genreResearch: d.genreResearch as string | undefined, nicheReference: d.nicheReference as string | undefined, maxTotalWords: TARGET_MANUSCRIPT_WORDS }) }),
  'chapter-summary': (d) => ({
    system: CHAPTERS_SYSTEM,
    prompt: buildChapterSummaryPrompt({
      genre: d.genre as string,
      chapterNumber: d.chapterNumber as number,
      chapterTitle: d.chapterTitle as string,
      chapterContent: d.chapterContent as string,
    }),
  }),
  'chapters': (d) => ({ system: CHAPTERS_SYSTEM, prompt: buildChapterPrompt({ genre: d.genre as string, chapterNumber: d.chapterNumber as number, chapterTitle: d.chapterTitle as string, beatReference: d.beatReference as string, sceneGoal: d.sceneGoal as string, pov: d.pov as string | undefined, charactersReference: d.charactersReference as string, endingReference: d.endingReference as string, previousChapterSummaries: d.previousChapterSummaries as Array<{ chapterNumber: number; title: string; summary: string }> | undefined, structureContext: d.structureContext as string, genreResearch: d.genreResearch as string | undefined, nicheReference: d.nicheReference as string | undefined, wordTarget: d.wordTarget as number | undefined }) }),
  'blurb': (d) => ({ system: BLURB_SYSTEM, prompt: buildBlurbPrompt({ genre: d.genre as string, niche: d.niche as string | undefined, title: d.title as string | undefined, premise: d.premise as string | undefined, marketAnalysis: d.marketAnalysis as string | undefined, readerTargeting: d.readerTargeting as string | undefined, plotBlueprint: d.plotBlueprint as string | undefined }) }),
  'amazon-description': (d) => ({ system: AMAZON_DESCRIPTION_SYSTEM, prompt: buildAmazonDescriptionPrompt({ genre: d.genre as string, niche: d.niche as string | undefined, title: d.title as string | undefined, premise: d.premise as string | undefined, marketAnalysis: d.marketAnalysis as string | undefined, readerTargeting: d.readerTargeting as string | undefined, plotBlueprint: d.plotBlueprint as string | undefined }) }),
};

export async function POST(request: NextRequest) {
  
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = GenerateBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { stage, model: requestedModel } = parsed.data as {
      stage: WorkflowStage;
      data: Record<string, unknown>;
      model?: string;
    };
    let data = parsed.data.data as Record<string, unknown>;
    
    // Variables for model switching (used in editorial stage)
    let model = requestedModel;
    let modelSwitched = false;
    let switchMessage = '';
    
    console.log('[API] Generate request received:', { stage, model, hasData: !!data });
    
    if (!stage || !data) {
      console.error('[API] Missing stage or data:', { stage, hasData: !!data });
      return NextResponse.json({ error: 'Missing stage or data' }, { status: 400 });
    }

    const stageDataSchema = STAGE_DATA_SCHEMAS[stage];
    if (stageDataSchema) {
      const parsedStageData = stageDataSchema.safeParse(data);
      if (!parsedStageData.success) {
        return NextResponse.json(
          {
            error: `Invalid data for ${stage} generation`,
            details: parsedStageData.error.flatten(),
          },
          { status: 400 }
        );
      }
      data = parsedStageData.data as Record<string, unknown>;
    }
    
    let prompt: string;
    let systemPrompt: string;

    // --- Simple stages (no branching) ---
    const simpleHandler = SIMPLE_STAGE_HANDLERS[stage];
    if (simpleHandler) {
      ({ system: systemPrompt, prompt } = simpleHandler(data));
    } else switch (stage) {
      // --- Stages with conditional prompt building ---

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
        
      case 'editorial':
        systemPrompt = EDITORIAL_SYSTEM;
        
        // Use requested model or stage default (e.g. Claude Sonnet 4.6 Thinking)
        let selectedModel = model || getDefaultModelForStage('editorial').id;
        // modelSwitched and switchMessage are already declared at function scope
        
        if (data.createQueue) {
          prompt = buildRevisionQueuePrompt({
            editorialReport: data.editorialReport as string,
            chapterCount: data.chapterCount as number,
            editorialPass: parseEditorialPass(data.editorialPass),
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
          
          // Get selected model context limit; use fallback (Claude Sonnet 4.6) if manuscript exceeds it
          const selectedModelConfig = getModelById(selectedModel);
          const selectedMaxContext = selectedModelConfig?.maxContextTokens || 128000;
          const fallbackModelId = 'claude-sonnet-4-6-thinking';
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
            editorialPass: parseEditorialPass(data.editorialPass),
            intendedAudience:
              typeof data.intendedAudience === 'string' ? data.intendedAudience : undefined,
            premise: typeof data.premise === 'string' ? data.premise : undefined,
            research: typeof data.research === 'string' ? data.research : undefined,
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
          previousChapterContext: data.previousChapterContext as string | undefined,
          nextChapterContext: data.nextChapterContext as string | undefined,
          editorialPass: parseEditorialPass(data.editorialPass),
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
      providerRoute: result.providerRoute || result.provider,
      tokensUsed: result.tokensUsed,
      modelSwitched: stage === 'editorial' ? modelSwitched : false,
    });
    
    // Return response with model switch message if applicable
    const response: import('@/types').GenerateApiResponse = {
      content: result.content,
      model: result.model,
      provider: result.provider,
      ...(result.providerRoute ? { providerRoute: result.providerRoute } : {}),
      tokensUsed: result.tokensUsed,
      ...(stage === 'editorial' && modelSwitched && switchMessage
        ? { modelSwitched: true, switchMessage }
        : {}),
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
