import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateOpenAICoverImages } from '@/lib/cover/openaiCoverImages';

const BodySchema = z.object({
  prompt: z.string().min(16).max(32_000),
  n: z.number().int().min(1).max(10).optional().default(4),
});

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = BodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return NextResponse.json({ error: 'Invalid request', details: body.error.flatten() }, { status: 400 });
    }
    const { b64List, model } = await generateOpenAICoverImages({
      prompt: body.data.prompt,
      n: body.data.n ?? 4,
    });
    return NextResponse.json({ images: b64List, model });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Image generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
