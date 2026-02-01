import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase/admin';
import { generateForStage } from '@/lib/llm';
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
  CHAPTER_OUTLINES_SYSTEM,
  buildChapterOutlinesPrompt,
  CHAPTERS_SYSTEM,
  buildChapterPrompt,
  EDITORIAL_SYSTEM,
  buildEditorialPrompt,
  buildRevisionQueuePrompt,
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
    const { stage, data, model } = body as { 
      stage: WorkflowStage; 
      data: Record<string, unknown>;
      model?: string; // Optional model override
    };
    
    if (!stage || !data) {
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
        if (data.createQueue) {
          prompt = buildRevisionQueuePrompt({
            editorialReport: data.editorialReport as string,
            chapterCount: data.chapterCount as number,
          });
        } else {
          prompt = buildEditorialPrompt({
            manuscript: data.manuscript as string,
            genre: data.genre as string,
            nicheReference: data.nicheReference as string | undefined,
            charactersReference: data.charactersReference as string | undefined,
            endingReference: data.endingReference as string | undefined,
            structureReference: data.structureReference as string | undefined,
          });
        }
        break;
        
      default:
        return NextResponse.json({ error: 'Invalid stage' }, { status: 400 });
    }
    
    const result = await generateForStage(stage, prompt, {
      systemPrompt,
      temperature: data.temperature as number | undefined,
      model, // Pass model override if provided
    });
    
    return NextResponse.json({
      content: result.content,
      model: result.model,
      provider: result.provider,
      tokensUsed: result.tokensUsed,
    });
    
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
