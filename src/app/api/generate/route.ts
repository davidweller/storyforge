import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateForStage } from '@/lib/llm';
import { resolveAnthropicCachedPrompt } from '@/lib/llm/anthropicPromptFromStage';
import {
  getModelById,
  getDefaultModelForStage,
  ALL_MODELS,
  ENDING_CONCEPTS_DEFAULT_MODEL_ID,
  ENDING_EXPANSION_DEFAULT_MODEL_ID,
  EDITORIAL_REPORT_DEFAULT_MODEL_ID,
  EDITORIAL_QUEUE_DEFAULT_MODEL_ID,
} from '@/lib/data/models';
import { TARGET_MANUSCRIPT_WORDS, CHAPTER_SCENE_EVAL_OUTPUT_TOKEN_BUDGET } from '@/lib/constants';
import type { WorkflowStage, EditorialPass, GenerationUsageSource } from '@/types';
import * as dbq from '@/lib/db/queries';

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
  EDITORIAL_SYSTEM,
  buildEditorialPrompt,
  buildEditorialIssuesQueuePrompt,
  buildRevisionQueuePrompt,
  REVISION_VERIFY_SYSTEM, buildRevisionVerificationPrompt,
  BLURB_SYSTEM, buildBlurbPrompt,
  AMAZON_DESCRIPTION_SYSTEM, buildAmazonDescriptionPrompt,
  STORY_BIBLE_SYSTEM, buildStoryBiblePrompt, buildCreativeBriefPrompt,
  CHAPTER_SCENE_PLAN_SYSTEM, buildChapterScenePlanPrompt,
  CHAPTER_SCENE_PROSE_SYSTEM, buildChapterSceneProsePrompt,
  CHAPTER_POLISH_SYSTEM, buildChapterPolishPrompt,
  CHAPTER_SCENE_EVAL_SYSTEM, buildChapterSceneEvalPrompt,
} from '@/lib/prompts';
import {
  parseChapterOutlines,
  parseChapterSummary,
  parseCreativeBrief,
  parseEndingConcepts,
  parseRevisionQueue,
  parseStoryBible,
  parseTitleOptions,
  parseChapterScenePlan,
  parseChapterSceneProseOutput,
  parseChapterEvaluation,
  parseRevisionVerification,
  ChapterOutlineSchema,
  SceneCardSchema,
} from '@/lib/generation/schemas';
import { structuredOutputCountWarnings } from '@/lib/generation/outputCountWarnings';
import { strictCardinalityViolation } from '@/lib/generation/cardinalityGate';
import { gateEditorialManuscriptContext } from '@/lib/editorial/manuscriptModelGate';

/** Long editorials need headroom on Vercel and similar hosts (local dev usually ignores this). */
export const maxDuration = 800;

const WORKFLOW_STAGES = [
  'setup', 'genre-research', 'niche', 'ending', 'characters', 'structure',
  'title', 'chapter-outlines', 'chapter-summary',
  'chapter-scene-plan', 'chapter-scenes-prose', 'chapter-polish', 'chapter-scene-eval',
  'story-bible', 'creative-brief', 'chapters', 'compilation', 'export-draft',
  'editorial', 'editorial-issues', 'revision', 'revision-verify', 'export-final', 'blurb', 'amazon-description',
] as const;

const USAGE_SOURCE_VALUES = [
  'manual-stage',
  'full-auto',
  'chapter-editor',
  'editorial',
  'revision',
] as const satisfies readonly GenerationUsageSource[];

const GenerateBodySchema = z.object({
  stage: z.enum(WORKFLOW_STAGES),
  data: z.record(z.string(), z.unknown()),
  model: z.string().optional().refine(
    (m) => !m || ALL_MODELS.some((lm) => lm.id === m),
    { message: 'Unknown model ID' }
  ),
  projectId: z.string().optional(),
  runId: z.string().optional(),
  usageSource: z.enum(USAGE_SOURCE_VALUES).optional(),
  strictCardinality: z.boolean().optional(),
});

type D = Record<string, unknown>;

type StructuredOutputKind =
  | 'ending-concepts'
  | 'title'
  | 'chapter-outlines'
  | 'chapter-summary'
  | 'story-bible'
  | 'creative-brief'
  | 'revision-queue'
  | 'chapter-scene-plan'
  | 'chapter-scenes-prose'
  | 'chapter-scene-eval'
  | 'revision-verify';

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
const StoryBibleSourceRefSchema = z.object({
  documentType: z.string(),
  documentId: z.string(),
  version: z.number().int().positive(),
  updatedAt: z.string(),
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
    assembledContext: optionalString,
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
  'story-bible': ProjectContextSchema.extend({
    title: optionalString,
    niche: optionalString,
    derivedFrom: z.array(StoryBibleSourceRefSchema).min(1),
    genreResearch: optionalString,
    nicheReference: optionalString,
    endingReference: optionalString,
    endingChoice: optionalString,
    charactersReference: optionalString,
    structureReference: optionalString,
    chapterOutlinesReference: requiredString,
  }).passthrough().superRefine((val, ctx) => {
    const outlineChapters = parseChapterOutlines(val.chapterOutlinesReference as string);
    if (outlineChapters.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['chapterOutlinesReference'],
        message:
          'Story Bible runs after outlines: chapterOutlinesReference must parse to at least one chapter.',
      });
    }
    const refs = val.derivedFrom as { documentType: string }[];
    if (!refs.some((r) => r.documentType === 'chapter-outlines')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['derivedFrom'],
        message: 'derivedFrom must include the approved chapter-outlines document.',
      });
    }
  }),
  'creative-brief': z.object({
    storyBibleContent: requiredString,
    storyBibleDocumentId: requiredString,
    storyBibleVersion: z.number().int().positive(),
    storyBibleUpdatedAt: requiredString,
  }).passthrough(),
  'chapter-scene-plan': z.object({
    genre: requiredString,
    chapterNumber: z.number().int().positive(),
    outlinesSourceJson: requiredString,
    outlineSliceJson: optionalString,
    assembledContext: optionalString,
  }).passthrough(),
  'chapter-scenes-prose': z.object({
    genre: requiredString,
    chapterNumber: z.number(),
    chapterTitle: requiredString,
    sceneCard: z.record(z.string(), z.unknown()),
    assembledContext: optionalString,
    neighborSummaryBefore: optionalString,
    neighborSummaryAfter: optionalString,
    wordTarget: z.number().optional(),
  }).passthrough(),
  'chapter-polish': z.object({
    genre: requiredString,
    chapterNumber: z.number(),
    chapterTitle: requiredString,
    concatenatedDraft: requiredString,
    assembledContext: optionalString,
  }).passthrough(),
  'chapter-scene-eval': z.object({
    genre: requiredString,
    chapterNumber: z.number(),
    chapterTitle: requiredString,
    scenePlanJson: requiredString,
    chapterText: requiredString,
    compactCanon: optionalString,
    chunkLabel: optionalString,
    evaluationMode: z.enum(['lite', 'standard', 'deep']).optional(),
  }).passthrough(),
  chapters: z.object({
    genre: requiredString,
    chapterNumber: z.number(),
    chapterTitle: requiredString,
    beatReference: z.string(),
    sceneGoal: z.string(),
    pov: optionalString,
    assembledContext: optionalString,
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
      assembledContext: optionalString,
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
  'editorial-issues': z.object({
    manuscript: requiredString,
    genre: requiredString,
    chapterCount: z.number().int().positive(),
    assembledContext: optionalString,
    nicheReference: optionalString,
    charactersReference: optionalString,
    endingReference: optionalString,
    structureReference: optionalString,
    editorialPass: EditorialPassSchema.optional(),
    intendedAudience: optionalString,
    premise: optionalString,
    research: optionalString,
  }).passthrough(),
  revision: z.object({
    originalContent: requiredString,
    revisionInstructions: optionalString,
    acceptanceCriteria: z.array(z.string()).optional(),
    assembledContext: optionalString,
    charactersReference: z.string().optional(),
    endingReference: z.string().optional(),
    structureReference: optionalString,
    nicheReference: optionalString,
    previousChapterContext: optionalString,
    nextChapterContext: optionalString,
    editorialPass: EditorialPassSchema.optional(),
    sceneRevisionSceneId: optionalString,
  }).passthrough(),
  'revision-verify': z.object({
    revisedContent: requiredString,
    instructions: requiredString,
    issueDescriptions: z.array(z.string()),
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

function getStructuredOutputKind(stage: WorkflowStage, data: D): StructuredOutputKind | null {
  if (stage === 'ending') {
    const hasEndingExpansion =
      typeof data.selectedEnding === 'string' && data.selectedEnding.trim().length > 0;
    if (!hasEndingExpansion) return 'ending-concepts';
  }
  if (stage === 'title') return 'title';
  if (stage === 'chapter-outlines') return 'chapter-outlines';
  if (stage === 'chapter-summary') return 'chapter-summary';
  if (stage === 'story-bible') return 'story-bible';
  if (stage === 'creative-brief') return 'creative-brief';
  if (stage === 'editorial' && data.createQueue) return 'revision-queue';
  if (stage === 'editorial-issues') return 'revision-queue';
  if (stage === 'chapter-scene-plan') return 'chapter-scene-plan';
  if (stage === 'chapter-scenes-prose') return 'chapter-scenes-prose';
  if (stage === 'chapter-scene-eval') return 'chapter-scene-eval';
  if (stage === 'revision-verify') return 'revision-verify';
  return null;
}

function normalizeStructuredOutput(kind: StructuredOutputKind, content: string): string {
  if (kind === 'ending-concepts') {
    const endings = parseEndingConcepts(content);
    if (endings.length === 0) throw new Error('No ending concepts found in structured output.');
    return JSON.stringify({ endings }, null, 2);
  }
  if (kind === 'title') {
    const titles = parseTitleOptions(content);
    if (titles.length === 0) throw new Error('No title options found in structured output.');
    return JSON.stringify({ titles }, null, 2);
  }
  if (kind === 'chapter-outlines') {
    const chapters = parseChapterOutlines(content);
    if (chapters.length === 0) throw new Error('No chapter outlines found in structured output.');
    return JSON.stringify({ chapters }, null, 2);
  }
  if (kind === 'chapter-summary') {
    const summary = parseChapterSummary(content);
    if (!summary) throw new Error('No chapter summary found in structured output.');
    return summary;
  }
  if (kind === 'story-bible') {
    return JSON.stringify(parseStoryBible(content), null, 2);
  }
  if (kind === 'creative-brief') {
    return JSON.stringify(parseCreativeBrief(content), null, 2);
  }
  if (kind === 'chapter-scene-plan') {
    return JSON.stringify(parseChapterScenePlan(content), null, 2);
  }
  if (kind === 'chapter-scenes-prose') {
    return JSON.stringify(parseChapterSceneProseOutput(content), null, 2);
  }
  if (kind === 'chapter-scene-eval') {
    return JSON.stringify(parseChapterEvaluation(content), null, 2);
  }
  if (kind === 'revision-verify') {
    return JSON.stringify(parseRevisionVerification(content), null, 2);
  }
  const queue = parseRevisionQueue(content);
  return JSON.stringify(queue, null, 2);
}

function buildRepairPrompt(kind: StructuredOutputKind, originalPrompt: string, invalidContent: string, error: string): string {
  return `Repair the generated output so it matches the required JSON contract for "${kind}".

Validation error:
${error}

Original task prompt:
${originalPrompt}

Invalid output:
${invalidContent}

Return only the corrected JSON object. Do not include markdown fences or commentary.`;
}

/** Lookup map for stages whose prompt building requires no branching logic.
 *  Stages with conditional data (ending, editorial, revision) stay in the switch. */
const SIMPLE_STAGE_HANDLERS: Partial<Record<WorkflowStage, (d: D) => { system: string; prompt: string }>> = {
  'genre-research': (d) => ({ system: GENRE_RESEARCH_SYSTEM, prompt: buildGenreResearchPrompt({ premise: d.premise as string | undefined, genre: d.genre as string, research: d.research as string | undefined }) }),
  'niche': (d) => ({ system: NICHE_SYSTEM, prompt: buildNichePrompt({ premise: d.premise as string | undefined, genre: d.genre as string, genreResearch: d.genreResearch as string }) }),
  'characters': (d) => ({ system: CHARACTERS_SYSTEM, prompt: buildCharactersPrompt({ premise: d.premise as string | undefined, genre: d.genre as string, nicheReference: d.nicheReference as string, endingReference: d.endingReference as string }) }),
  'structure': (d) => ({ system: STRUCTURE_SYSTEM, prompt: buildStructurePrompt({ premise: d.premise as string | undefined, genre: d.genre as string, nicheReference: d.nicheReference as string, endingReference: d.endingReference as string, charactersReference: d.charactersReference as string, maxTotalWords: TARGET_MANUSCRIPT_WORDS }) }),
  'title': (d) => ({
    system: TITLE_IDEAS_SYSTEM,
    prompt: buildTitleIdeasPrompt({
      genre: d.genre as string,
      premise: d.premise as string | undefined,
      assembledContext: d.assembledContext as string | undefined,
      nicheReference: d.nicheReference as string | undefined,
      structureReference: d.structureReference as string | undefined,
      endingReference: d.endingReference as string | undefined,
      charactersReference: d.charactersReference as string | undefined,
      titleCount:
        typeof d.titleCount === 'number' && d.titleCount > 0 ? (d.titleCount as number) : undefined,
    }),
  }),
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
  'story-bible': (d) => ({ system: STORY_BIBLE_SYSTEM, prompt: buildStoryBiblePrompt({ title: d.title as string | undefined, premise: d.premise as string | undefined, genre: d.genre as string, niche: d.niche as string | undefined, research: d.research as string | undefined, genreResearch: d.genreResearch as string | undefined, nicheReference: d.nicheReference as string | undefined, endingReference: d.endingReference as string | undefined, endingChoice: d.endingChoice as string | undefined, charactersReference: d.charactersReference as string | undefined, structureReference: d.structureReference as string | undefined, chapterOutlinesReference: d.chapterOutlinesReference as string | undefined, derivedFrom: d.derivedFrom as import('@/types').StoryBibleSourceRef[] }) }),
  'creative-brief': (d) => ({ system: STORY_BIBLE_SYSTEM, prompt: buildCreativeBriefPrompt({ storyBibleContent: d.storyBibleContent as string, storyBibleDocumentId: d.storyBibleDocumentId as string, storyBibleVersion: d.storyBibleVersion as number, storyBibleUpdatedAt: d.storyBibleUpdatedAt as string }) }),
  'chapters': (d) => ({ system: CHAPTERS_SYSTEM, prompt: buildChapterPrompt({ genre: d.genre as string, chapterNumber: d.chapterNumber as number, chapterTitle: d.chapterTitle as string, beatReference: d.beatReference as string, sceneGoal: d.sceneGoal as string, pov: d.pov as string | undefined, assembledContext: d.assembledContext as string | undefined, charactersReference: d.charactersReference as string, endingReference: d.endingReference as string, previousChapterSummaries: d.previousChapterSummaries as Array<{ chapterNumber: number; title: string; summary: string }> | undefined, structureContext: d.structureContext as string, genreResearch: d.genreResearch as string | undefined, nicheReference: d.nicheReference as string | undefined, wordTarget: d.wordTarget as number | undefined }) }),
  'blurb': (d) => ({ system: BLURB_SYSTEM, prompt: buildBlurbPrompt({ genre: d.genre as string, niche: d.niche as string | undefined, title: d.title as string | undefined, premise: d.premise as string | undefined, marketAnalysis: d.marketAnalysis as string | undefined, readerTargeting: d.readerTargeting as string | undefined, plotBlueprint: d.plotBlueprint as string | undefined }) }),
  'amazon-description': (d) => ({ system: AMAZON_DESCRIPTION_SYSTEM, prompt: buildAmazonDescriptionPrompt({ genre: d.genre as string, niche: d.niche as string | undefined, title: d.title as string | undefined, premise: d.premise as string | undefined, marketAnalysis: d.marketAnalysis as string | undefined, readerTargeting: d.readerTargeting as string | undefined, plotBlueprint: d.plotBlueprint as string | undefined }) }),
  'chapter-scene-plan': (d) => {
    let outlineChapter: import('@/lib/generation/schemas').ChapterOutline | undefined;
    const slice = d.outlineSliceJson as string | undefined;
    if (slice?.trim()) {
      try {
        outlineChapter = ChapterOutlineSchema.parse(JSON.parse(slice));
      } catch {
        outlineChapter = undefined;
      }
    }
    return {
      system: CHAPTER_SCENE_PLAN_SYSTEM,
      prompt: buildChapterScenePlanPrompt({
        genre: d.genre as string,
        chapterNumber: d.chapterNumber as number,
        outlineChapter,
        assembledContext: d.assembledContext as string | undefined,
        outlinesSourceJson: d.outlinesSourceJson as string,
      }),
    };
  },
  'chapter-scenes-prose': (d) => {
    const sceneCard = SceneCardSchema.parse(d.sceneCard);
    return {
      system: CHAPTER_SCENE_PROSE_SYSTEM,
      prompt: buildChapterSceneProsePrompt({
        genre: d.genre as string,
        chapterNumber: d.chapterNumber as number,
        chapterTitle: d.chapterTitle as string,
        sceneCard,
        neighborSummaryBefore: d.neighborSummaryBefore as string | undefined,
        neighborSummaryAfter: d.neighborSummaryAfter as string | undefined,
        assembledContext: d.assembledContext as string | undefined,
        wordTarget: d.wordTarget as number | undefined,
      }),
    };
  },
  'chapter-polish': (d) => ({
    system: CHAPTER_POLISH_SYSTEM,
    prompt: buildChapterPolishPrompt({
      genre: d.genre as string,
      chapterNumber: d.chapterNumber as number,
      chapterTitle: d.chapterTitle as string,
      concatenatedDraft: d.concatenatedDraft as string,
      assembledContext: d.assembledContext as string | undefined,
    }),
  }),
  'chapter-scene-eval': (d) => ({
    system: CHAPTER_SCENE_EVAL_SYSTEM,
    prompt: buildChapterSceneEvalPrompt({
      genre: d.genre as string,
      chapterNumber: d.chapterNumber as number,
      chapterTitle: d.chapterTitle as string,
      scenePlanJson: d.scenePlanJson as string,
      chapterText: d.chapterText as string,
      compactCanon: (d.compactCanon as string | undefined) ?? '',
      chunkLabel: d.chunkLabel as string | undefined,
      evaluationMode:
        d.evaluationMode === 'lite' || d.evaluationMode === 'standard' || d.evaluationMode === 'deep'
          ? d.evaluationMode
          : undefined,
    }),
  }),
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
    const {
      stage,
      model: requestedModel,
      projectId: bodyProjectId,
      runId: bodyRunId,
      usageSource: bodyUsageSource,
      strictCardinality: bodyStrictCardinality,
    } = parsed.data;
    let data = parsed.data.data as Record<string, unknown>;
    if (typeof bodyStrictCardinality === 'boolean') {
      data = { ...data, strictCardinality: bodyStrictCardinality };
    }
    
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

    if (!model && stage === 'ending') {
      const isExpansion =
        typeof data.selectedEnding === 'string' && data.selectedEnding.trim().length > 0;
      model = isExpansion ? ENDING_EXPANSION_DEFAULT_MODEL_ID : ENDING_CONCEPTS_DEFAULT_MODEL_ID;
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
        const isEndingExpansion =
          typeof data.selectedEnding === 'string' && data.selectedEnding.trim().length > 0;
        if (isEndingExpansion) {
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
            conceptCountExact:
              typeof data.endingConceptCount === 'number' && data.endingConceptCount > 0
                ? (data.endingConceptCount as number)
                : undefined,
            conceptCountMin:
              typeof data.endingConceptCountMin === 'number' && data.endingConceptCountMin > 0
                ? (data.endingConceptCountMin as number)
                : undefined,
            conceptCountMax:
              typeof data.endingConceptCountMax === 'number' && data.endingConceptCountMax > 0
                ? (data.endingConceptCountMax as number)
                : undefined,
          });
        }
        break;
        
      case 'editorial':
        systemPrompt = EDITORIAL_SYSTEM;
        
        // Report: Opus 4.7 High; createQueue: Sonnet Medium (docs/model_recommendations.md)
        let selectedModel =
          model ||
          (data.createQueue ? EDITORIAL_QUEUE_DEFAULT_MODEL_ID : EDITORIAL_REPORT_DEFAULT_MODEL_ID);
        // modelSwitched and switchMessage are already declared at function scope
        
        if (data.createQueue) {
          prompt = buildRevisionQueuePrompt({
            editorialReport: data.editorialReport as string,
            chapterCount: data.chapterCount as number,
            editorialPass: parseEditorialPass(data.editorialPass),
          });
        } else {
          const manuscript = data.manuscript as string;
          const gate = gateEditorialManuscriptContext({
            requestedModelId: selectedModel,
            defaultStageModelId: EDITORIAL_REPORT_DEFAULT_MODEL_ID,
            manuscript,
            nicheReference: data.nicheReference,
            charactersReference: data.charactersReference,
            endingReference: data.endingReference,
            structureReference: data.structureReference,
          });
          if (!gate.ok) {
            return NextResponse.json({ error: gate.error }, { status: gate.status });
          }
          selectedModel = gate.modelId;
          modelSwitched = gate.modelSwitched;
          switchMessage = gate.switchMessage;

          console.log('[API] Building editorial prompt:', {
            model: selectedModel,
            modelSwitched,
            manuscriptLength: manuscript.length,
            genre: data.genre,
            hasNiche: !!data.nicheReference,
            hasCharacters: !!data.charactersReference,
            hasEnding: !!data.endingReference,
            hasStructure: !!data.structureReference,
          });

          prompt = buildEditorialPrompt({
            manuscript,
            genre: data.genre as string,
            assembledContext: data.assembledContext as string | undefined,
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
        model = selectedModel;
        break;
        
      case 'editorial-issues':
        systemPrompt = EDITORIAL_SYSTEM;
        {
          let selectedModel = model || getDefaultModelForStage('editorial-issues').id;
          const manuscript = data.manuscript as string;
          const gate = gateEditorialManuscriptContext({
            requestedModelId: selectedModel,
            defaultStageModelId: getDefaultModelForStage('editorial-issues').id,
            manuscript,
            nicheReference: data.nicheReference,
            charactersReference: data.charactersReference,
            endingReference: data.endingReference,
            structureReference: data.structureReference,
          });
          if (!gate.ok) {
            return NextResponse.json({ error: gate.error }, { status: gate.status });
          }
          selectedModel = gate.modelId;
          modelSwitched = gate.modelSwitched;
          switchMessage = gate.switchMessage;
          model = selectedModel;

          prompt = buildEditorialIssuesQueuePrompt({
            manuscript,
            genre: data.genre as string,
            chapterCount: data.chapterCount as number,
            editorialPass: parseEditorialPass(data.editorialPass),
            assembledContext: data.assembledContext as string | undefined,
            nicheReference: data.nicheReference as string | undefined,
            charactersReference: data.charactersReference as string | undefined,
            endingReference: data.endingReference as string | undefined,
            structureReference: data.structureReference as string | undefined,
            intendedAudience:
              typeof data.intendedAudience === 'string' ? data.intendedAudience : undefined,
            premise: typeof data.premise === 'string' ? data.premise : undefined,
            research: typeof data.research === 'string' ? data.research : undefined,
          });
        }
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
          assembledContext: data.assembledContext as string | undefined,
          charactersReference: data.charactersReference as string || '',
          endingReference: data.endingReference as string || '',
          structureReference: data.structureReference as string | undefined,
          nicheReference: data.nicheReference as string | undefined,
          previousChapterContext: data.previousChapterContext as string | undefined,
          nextChapterContext: data.nextChapterContext as string | undefined,
          editorialPass: parseEditorialPass(data.editorialPass),
          sceneScoped:
            typeof data.sceneRevisionSceneId === 'string' && data.sceneRevisionSceneId.trim()
              ? { sceneId: data.sceneRevisionSceneId as string }
              : undefined,
        });
        break;

      case 'revision-verify':
        systemPrompt = REVISION_VERIFY_SYSTEM;
        prompt = buildRevisionVerificationPrompt(
          data.revisedContent as string,
          data.instructions as string,
          Array.isArray(data.issueDescriptions) ? (data.issueDescriptions as string[]) : [],
        );
        break;

      default:
        return NextResponse.json({ error: 'Invalid stage' }, { status: 400 });
    }
    
    const modelIdForRequest = model ?? getDefaultModelForStage(stage).id;

    const cachedPrompt = resolveAnthropicCachedPrompt(
      stage,
      modelIdForRequest,
      data,
      systemPrompt,
      prompt,
    );
    if (cachedPrompt.anthropicSystem) {
      prompt = cachedPrompt.prompt;
      console.log('[API] Anthropic prompt caching: using cached system blocks', { stage });
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
    
    const structuredOutputKind = getStructuredOutputKind(stage, data);
    const useJsonMode = !!structuredOutputKind;
    const sceneEvalMaxTokens = stage === 'chapter-scene-eval' ? CHAPTER_SCENE_EVAL_OUTPUT_TOKEN_BUDGET : undefined;

    const result = await generateForStage(stage, prompt, {
      systemPrompt,
      anthropicSystem: cachedPrompt.anthropicSystem,
      temperature: data.temperature as number | undefined,
      model, // Pass model override if provided (may have been switched for editorial)
      jsonMode: useJsonMode,
      ...(sceneEvalMaxTokens ? { maxTokens: sceneEvalMaxTokens } : {}),
    });

    if (structuredOutputKind) {
      try {
        result.content = normalizeStructuredOutput(structuredOutputKind, result.content);
      } catch (validationError) {
        const repairPrompt = buildRepairPrompt(
          structuredOutputKind,
          prompt,
          result.content,
          validationError instanceof Error ? validationError.message : 'Structured output validation failed.'
        );
        const repairResult = await generateForStage(stage, repairPrompt, {
          systemPrompt: 'You repair malformed JSON outputs. Return only valid JSON that satisfies the requested schema.',
          temperature: 0,
          model,
          jsonMode: true,
          anthropicSystem: undefined,
          ...(sceneEvalMaxTokens ? { maxTokens: sceneEvalMaxTokens } : {}),
        });
        result.content = normalizeStructuredOutput(structuredOutputKind, repairResult.content);
        result.tokensUsed += repairResult.tokensUsed;
      }
    }

    const cardinalityError =
      structuredOutputKind != null ? strictCardinalityViolation(stage, data, result.content) : null;
    if (cardinalityError) {
      return NextResponse.json({ error: cardinalityError }, { status: 422 });
    }

    const structuredWarnings =
      structuredOutputKind != null
        ? structuredOutputCountWarnings({
            kind: structuredOutputKind,
            stage,
            data,
            content: result.content,
          })
        : [];
    if (structuredWarnings.length > 0) {
      console.warn('[API] Structured output count warnings:', { stage, messages: structuredWarnings });
    }

    let responseWarnings = [...structuredWarnings];

    const pid = typeof bodyProjectId === 'string' ? bodyProjectId.trim() : '';
    if (pid) {
      const persisted = await dbq.recordGenerationUsage({
        projectId: pid,
        stage,
        model: result.model,
        provider: result.provider,
        totalTokens: result.tokensUsed,
        runId: typeof bodyRunId === 'string' && bodyRunId.trim() ? bodyRunId.trim() : null,
        source: bodyUsageSource ?? 'manual-stage',
      });
      if (!persisted) {
        responseWarnings.push(
          'Token usage was not saved to the local database (see /api/health/db and server logs). Costs in the UI may read low.'
        );
      }
    }

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
      modelSwitched:
        stage === 'editorial' || stage === 'editorial-issues' ? modelSwitched : false,
    });

    // Return response with model switch message if applicable
    const response: import('@/types').GenerateApiResponse = {
      content: result.content,
      model: result.model,
      provider: result.provider,
      ...(result.providerRoute ? { providerRoute: result.providerRoute } : {}),
      tokensUsed: result.tokensUsed,
      ...(responseWarnings.length > 0 ? { warnings: responseWarnings } : {}),
      ...((stage === 'editorial' || stage === 'editorial-issues') && modelSwitched && switchMessage
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
