import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import * as q from '@/lib/db/queries';
import { slugify } from '@/lib/utils';
import type { CoverImagePayload } from '@/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId')?.trim();
  const fmt = searchParams.get('format') ?? 'kdp-back';

  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
  }

  const project = await q.getProject(projectId);
  if (!project?.approvedBackCoverImageId) {
    return NextResponse.json({ error: 'No approved back cover yet' }, { status: 400 });
  }

  const doc = await q.getDocument(project.approvedBackCoverImageId);
  if (!doc?.content) {
    return NextResponse.json({ error: 'Back cover document not found' }, { status: 404 });
  }

  let payload: CoverImagePayload;
  try {
    payload = JSON.parse(doc.content) as CoverImagePayload;
  } catch {
    return NextResponse.json({ error: 'Invalid cover document JSON' }, { status: 500 });
  }
  if (payload.surface !== 'back') {
    return NextResponse.json({ error: 'Approved asset is not a back cover image' }, { status: 400 });
  }

  const baseBuf = Buffer.from(payload.imageData, 'base64');
  const hint = payload.archetypeId ?? 'back';

  let out: Buffer;
  if (fmt === 'kdp-back') {
    out = await sharp(baseBuf)
      .resize(2560, 1600, { fit: 'cover', position: sharp.strategy.attention })
      .png()
      .toBuffer();
  } else if (fmt === 'social-square') {
    out = await sharp(baseBuf).resize(1400, 1400, { fit: 'cover', position: 'centre' }).png().toBuffer();
  } else {
    return NextResponse.json({ error: 'Unknown format' }, { status: 400 });
  }

  const slug = slugify(project.title ?? project.genre ?? 'novel');
  const filename =
    fmt === 'kdp-back'
      ? `${slug}-back-${hint}-v${payload.version}.png`
      : `${slug}-back-${hint}-social-v${payload.version}.png`;

  return new NextResponse(new Uint8Array(out), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
