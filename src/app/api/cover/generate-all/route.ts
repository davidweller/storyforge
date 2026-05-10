import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DEFAULT_KDP_TRIM_SIZE_ID, getKdpTrimSizeById } from '@/lib/cover/kdpTrimSizes';
import { processCoverGenerationJob } from '@/lib/cover/generateAllJob';
import { runCoverJobOnce } from '@/lib/cover/inFlightJobs';
import * as dbq from '@/lib/db/queries';
import { COVER_ARCHETYPES } from '@/lib/prompts/covers';

export const maxDuration = 300;

const TemplateUploadSchema = z.object({
  mimeType: z.string().trim().min(1),
  base64Data: z.string().trim().min(32),
});

const BodySchema = z.object({
  projectId: z.string().trim().min(1),
  archetypeId: z.string().trim().min(1),
  authorName: z.string().trim().min(1).max(120),
  trimSizeId: z.string().trim().min(1).optional().default(DEFAULT_KDP_TRIM_SIZE_ID),
  templateUpload: TemplateUploadSchema.optional(),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const { projectId, archetypeId, authorName, templateUpload, trimSizeId } = parsed.data;
    const project = await dbq.getProject(projectId);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (!project.title?.trim()) return NextResponse.json({ error: 'Project title is required before cover generation.' }, { status: 400 });
    if (!project.amazonDescription?.trim()) {
      return NextResponse.json(
        { error: 'Amazon description is missing. Generate or write it in Marketing > Amazon Description first.' },
        { status: 400 }
      );
    }
    if (!project.blurb?.trim()) {
      return NextResponse.json(
        { error: 'Back-cover blurb is missing. Finish Marketing > Blurb for back of book first (exact text appears on the back cover).' },
        { status: 400 }
      );
    }

    const archetype = COVER_ARCHETYPES.find((a) => a.id === archetypeId);
    if (!archetype) return NextResponse.json({ error: 'Unknown archetype selected.' }, { status: 400 });
    const trim = getKdpTrimSizeById(trimSizeId);
    if (!trim) return NextResponse.json({ error: 'Invalid trim size selected.' }, { status: 400 });

    const jobId = await dbq.createCoverGenerationJob({
      projectId,
      status: 'queued',
      progressStage: 'queued',
      input: {
        archetypeId: archetype.id,
        authorName,
        trimSizeId: trim.id,
        trimWidthIn: trim.widthIn,
        trimHeightIn: trim.heightIn,
        templateUpload: templateUpload
          ? { mimeType: templateUpload.mimeType, base64Data: templateUpload.base64Data }
          : undefined,
      },
    });
    runCoverJobOnce(jobId, () => processCoverGenerationJob(jobId));

    return NextResponse.json({ jobId, status: 'queued' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Generate-all failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
