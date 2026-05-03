import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as q from '@/lib/db/queries';
import { compositePaperbackFullWrap } from '@/lib/cover/fullWrapComposite';
import { slugify } from '@/lib/utils';
import type { CoverImagePayload, PaperbackSpecPayload } from '@/types';

const BodySchema = z.object({
  projectId: z.string().min(1),
});

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { projectId } = parsed.data;
  const project = await q.getProject(projectId);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  if (!project.approvedCoverImageId || !project.approvedBackCoverImageId) {
    return NextResponse.json({ error: 'Approved front and back cover images required' }, { status: 400 });
  }

  const docs = await q.getProjectDocuments(projectId);
  const specDoc = [...docs.filter((d) => d.type === 'paperback-spec')].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  )[0];
  if (!specDoc?.content) {
    return NextResponse.json({ error: 'Save a paperback spec first' }, { status: 400 });
  }

  let spec: PaperbackSpecPayload;
  try {
    spec = JSON.parse(specDoc.content) as PaperbackSpecPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid paperback spec JSON' }, { status: 500 });
  }

  const frontDoc = await q.getDocument(project.approvedCoverImageId);
  const backDoc = await q.getDocument(project.approvedBackCoverImageId);
  if (!frontDoc?.content || !backDoc?.content) {
    return NextResponse.json({ error: 'Missing cover documents' }, { status: 400 });
  }

  let front: CoverImagePayload;
  let back: CoverImagePayload;
  try {
    front = JSON.parse(frontDoc.content) as CoverImagePayload;
    back = JSON.parse(backDoc.content) as CoverImagePayload;
  } catch {
    return NextResponse.json({ error: 'Invalid cover image JSON' }, { status: 500 });
  }
  if (front.surface !== 'front' || back.surface !== 'back') {
    return NextResponse.json({ error: 'Surface mismatch on approved images' }, { status: 400 });
  }

  try {
    const buf = await compositePaperbackFullWrap({
      spec,
      frontB64: front.imageData,
      backB64: back.imageData,
    });
    const slug = slugify(project.title ?? project.genre ?? 'novel');
    const filename = `${slug}-paperback-fullwrap-${Date.now()}.png`;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Composite failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
