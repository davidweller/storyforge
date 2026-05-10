import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateOpenAICoverImages } from '@/lib/cover/openaiCoverImages';
import * as dbq from '@/lib/db/queries';
import type { APlusImagePayload } from '@/types';

export const maxDuration = 300;

const BodySchema = z.object({
  projectId: z.string().uuid(),
  parentImageId: z.string().uuid(),
  originalPrompt: z.string().min(16).max(32_000),
  refinementRequest: z.string().min(3).max(8_000),
  n: z.number().int().min(1).max(10).optional().default(2),
  quality: z.enum(['standard', 'high']).optional().default('high'),
});

function maxAPlusVersionForModule(
  documents: Awaited<ReturnType<typeof dbq.getProjectDocuments>>,
  moduleType: APlusImagePayload['moduleType']
): number {
  let maxVersion = 0;
  for (const doc of documents) {
    if (doc.type !== 'a-plus-module') continue;
    try {
      const payload = JSON.parse(doc.content) as APlusImagePayload;
      if (payload.moduleType === moduleType) {
        maxVersion = Math.max(maxVersion, payload.version ?? 1);
      }
    } catch {
      // skip bad row
    }
  }
  return maxVersion;
}

export async function POST(request: NextRequest) {
  try {
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }
    const { projectId, parentImageId, originalPrompt, refinementRequest, n, quality } = parsed.data;

    const parentDoc = await dbq.getDocument(parentImageId);
    if (!parentDoc || parentDoc.projectId !== projectId || parentDoc.type !== 'a-plus-module') {
      return NextResponse.json({ error: 'Parent A+ image not found' }, { status: 404 });
    }

    let parentPayload: APlusImagePayload;
    try {
      parentPayload = JSON.parse(parentDoc.content) as APlusImagePayload;
    } catch {
      return NextResponse.json({ error: 'Invalid parent A+ JSON' }, { status: 400 });
    }

    const allDocs = await dbq.getProjectDocuments(projectId);
    const baseVersion = maxAPlusVersionForModule(allDocs, parentPayload.moduleType);
    const version = Math.max(baseVersion, parentPayload.version ?? 1) + 1;
    const refinedPrompt = `${originalPrompt.trim()}\n\nRefinement: ${refinementRequest.trim()}. Keep brand style consistent with prior approved/front-cover-informed direction.`;

    try {
      const { b64List } = await generateOpenAICoverImages({ prompt: refinedPrompt, n, quality });
      const history = [...(parentPayload.refinementHistory ?? []), refinementRequest.trim()];
      const runId = randomUUID();
      const documentIds: string[] = [];
      let variantIndex = 0;
      for (const b64 of b64List) {
        const payload: APlusImagePayload = {
          ...parentPayload,
          runId,
          promptUsed: refinedPrompt,
          promptOverridden: true,
          variantIndex,
          parentImageId,
          refinementRequest: refinementRequest.trim(),
          version,
          status: 'candidate',
          imageData: b64,
          generatedAt: new Date().toISOString(),
          refinementHistory: history,
        };
        const id = await dbq.createDocument({
          projectId,
          type: 'a-plus-module',
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
        /content policy|safety|blocked|declined|400/i.test(msg)
          ? 'The image model declined this prompt. Try reducing text complexity or revising visual constraints.'
          : msg;
      return NextResponse.json({ error: friendly }, { status: 500 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'A+ refine failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
