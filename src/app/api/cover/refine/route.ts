import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { buildCoverStandalonePromptAnchor } from '@/lib/cover/enrichStandaloneImagePrompt';
import { generateOpenAICoverImages } from '@/lib/cover/openaiCoverImages';
import * as dbq from '@/lib/db/queries';
import type { CoverImagePayload } from '@/types';

export const maxDuration = 300;

function maxCoverSurfaceVersion(documents: Awaited<ReturnType<typeof dbq.getProjectDocuments>>, surface: 'front' | 'back'): number {
  let m = 0;
  for (const d of documents) {
    if (d.type !== 'cover-image') continue;
    try {
      const p = JSON.parse(d.content) as CoverImagePayload;
      if (p.surface === surface) m = Math.max(m, p.version ?? 1);
    } catch {
      /* skip */
    }
  }
  return m;
}

const BodySchema = z.object({
  projectId: z.string().uuid(),
  coverSide: z.enum(['front', 'back']),
  parentImageId: z.string().uuid(),
  originalPrompt: z.string().min(16).max(32_000),
  refinementRequest: z.string().min(3).max(8_000),
  n: z.number().int().min(1).max(10).optional().default(2),
  quality: z.enum(['standard', 'high']).optional().default('high'),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }
    const { projectId, coverSide, parentImageId, originalPrompt, refinementRequest, n, quality } = parsed.data;

    const proj = await dbq.getProject(projectId);
    if (!proj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const parentDoc = await dbq.getDocument(parentImageId);
    if (!parentDoc || parentDoc.projectId !== projectId || parentDoc.type !== 'cover-image') {
      return NextResponse.json({ error: 'Parent cover image not found' }, { status: 404 });
    }

    let parentPayload: CoverImagePayload;
    try {
      parentPayload = JSON.parse(parentDoc.content) as CoverImagePayload;
    } catch {
      return NextResponse.json({ error: 'Invalid parent cover JSON' }, { status: 400 });
    }
    if (parentPayload.surface !== coverSide) {
      return NextResponse.json({ error: 'Parent image cover side mismatch' }, { status: 400 });
    }

    const allDocs = await dbq.getProjectDocuments(projectId);
    const baseVersion = maxCoverSurfaceVersion(allDocs, coverSide);
    const version = Math.max(baseVersion, parentPayload.version ?? 1) + 1;

    const promptAnchor = await buildCoverStandalonePromptAnchor(allDocs, proj);
    const refinedPrompt =
      `${originalPrompt.trim()}\n\nRefinement: ${refinementRequest.trim()}. Keep all other elements consistent with the above.` +
      (promptAnchor.trim() ? promptAnchor : '');

    try {
      const { b64List } = await generateOpenAICoverImages({ prompt: refinedPrompt, n, quality });
      const hist = [...(parentPayload.refinementHistory ?? []), refinementRequest.trim()];
      const documentIds: string[] = [];
      let variantIndex = 0;
      const runId = randomUUID();
      for (const b64 of b64List) {
        const payload: CoverImagePayload = {
          schemaVersion: 1,
          runId,
          archetypeId: parentPayload.archetypeId,
          highClickEnabled: parentPayload.highClickEnabled,
          promptUsed: refinedPrompt,
          variantIndex,
          parentImageId,
          refinementRequest: refinementRequest.trim(),
          version,
          surface: coverSide,
          status: 'candidate',
          imageData: b64,
          generatedAt: new Date().toISOString(),
          refinementHistory: hist,
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
      return NextResponse.json({ documentIds, images: b64List, version });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Refinement failed';
      const friendly =
        /content policy|safety|blocked|declined|400/i.test(msg) ?
          'The image model declined this prompt. Try adjusting the character description or scene elements.'
        : msg;
      return NextResponse.json({ error: friendly }, { status: 500 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Cover refine failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
