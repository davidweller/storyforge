import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { appendHighClickToStoredPrompt } from '@/lib/prompts/covers';
import { generateOpenAICoverImages } from '@/lib/cover/openaiCoverImages';
import * as dbq from '@/lib/db/queries';
import type { CoverImagePayload } from '@/types';

export const maxDuration = 300;

const ArchetypeSchema = z.object({
  archetypeId: z.string().min(1),
  prompt: z.string().min(16).max(32_000),
  highClickEnabled: z.boolean(),
});

const BodySchema = z.object({
  projectId: z.string().uuid(),
  runId: z.string().min(8),
  coverSide: z.enum(['front', 'back']),
  archetypes: z.array(ArchetypeSchema).min(1).max(6),
  n: z.number().int().min(1).max(10).optional().default(4),
  quality: z.enum(['standard', 'high']).optional().default('high'),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }
    const { projectId, runId, coverSide, archetypes, n, quality } = parsed.data;

    const project = await dbq.getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const results: Array<{
      archetypeId: string;
      documentIds: string[];
      images: string[];
      error?: string;
    }> = [];

    await Promise.all(
      archetypes.map(async (entry) => {
        let prompt = entry.prompt.trim();
        if (entry.highClickEnabled) {
          prompt = appendHighClickToStoredPrompt(prompt);
        }
        try {
          const { b64List, model } = await generateOpenAICoverImages({ prompt, n, quality });
          const documentIds: string[] = [];
          let variantIndex = 0;
          for (const b64 of b64List) {
            const payload: CoverImagePayload = {
              schemaVersion: 1,
              runId,
              archetypeId: entry.archetypeId,
              highClickEnabled: entry.highClickEnabled,
              promptUsed: prompt,
              variantIndex,
              parentImageId: null,
              refinementRequest: null,
              version: 1,
              surface: coverSide,
              status: 'candidate',
              imageData: b64,
              generatedAt: new Date().toISOString(),
              refinementHistory: [],
            };
            const id = await dbq.createDocument({
              projectId,
              type: 'cover-image',
              content: JSON.stringify(payload),
              version: 1,
              approved: false,
            });
            documentIds.push(id);
            variantIndex += 1;
          }
          results.push({ archetypeId: entry.archetypeId, documentIds, images: b64List, error: undefined });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Image generation failed';
          const policy =
            /content policy|safety|blocked|declined|400/i.test(msg) ?
              'The image model declined this prompt. Try adjusting the character description or scene elements.'
            : msg;
          results.push({
            archetypeId: entry.archetypeId,
            documentIds: [],
            images: [],
            error: policy,
          });
        }
      })
    );

    return NextResponse.json({ results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Cover generate failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
