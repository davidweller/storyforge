import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import * as q from '@/lib/db/queries';
import { slugify } from '@/lib/utils';
import type { CoverImagePayload } from '@/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId')?.trim();
  const fmt = searchParams.get('format') ?? 'kdp-ebook';

  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
  }

  const project = await q.getProject(projectId);
  if (!project?.approvedCoverImageId) {
    return NextResponse.json({ error: 'No approved front cover yet' }, { status: 400 });
  }

  const doc = await q.getDocument(project.approvedCoverImageId);
  if (!doc?.content) {
    return NextResponse.json({ error: 'Cover document not found' }, { status: 404 });
  }

  let payload: CoverImagePayload;
  try {
    payload = JSON.parse(doc.content) as CoverImagePayload;
  } catch {
    return NextResponse.json({ error: 'Invalid cover document JSON' }, { status: 500 });
  }
  if (payload.surface !== 'front') {
    return NextResponse.json({ error: 'Approved asset is not a front cover image' }, { status: 400 });
  }

  const baseBuf = Buffer.from(payload.imageData, 'base64');
  const hint = payload.archetypeId ?? 'cover';

  let out: Buffer;
  if (fmt === 'kdp-ebook') {
    out = await sharp(baseBuf)
      .resize(1600, 2560, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();
  } else if (fmt === 'kindle-thumb') {
    out = await sharp(baseBuf).resize(1000, 1563, { fit: 'cover', position: sharp.strategy.attention }).png().toBuffer();
  } else if (fmt === 'social-square') {
    out = await sharp(baseBuf).resize(1400, 1400, { fit: 'cover', position: 'centre' }).png().toBuffer();
  } else {
    return NextResponse.json({ error: 'Unknown format' }, { status: 400 });
  }

  const slug = slugify(project.title ?? project.genre ?? 'novel');
  const filenames: Record<string, string> = {
    'kdp-ebook': `${slug}-cover-${hint}-kdp-v${payload.version}.png`,
    'kindle-thumb': `${slug}-cover-${hint}-thumb-v${payload.version}.png`,
    'social-square': `${slug}-cover-${hint}-social-v${payload.version}.png`,
  };

  const filename = filenames[fmt] ?? 'cover-export.png';

  return new NextResponse(new Uint8Array(out), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
