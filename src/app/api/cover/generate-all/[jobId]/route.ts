import { NextRequest, NextResponse } from 'next/server';
import { processCoverGenerationJob } from '@/lib/cover/generateAllJob';
import { isCoverJobInFlight, runCoverJobOnce } from '@/lib/cover/inFlightJobs';
import * as dbq from '@/lib/db/queries';

const STALE_JOB_MS = 5 * 60 * 1000;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await context.params;
  let job = await dbq.getCoverGenerationJob(jobId);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const activeState =
    job.status === 'queued' ||
    job.status === 'running_front' ||
    job.status === 'running_back' ||
    job.status === 'running_wrap' ||
    job.status === 'finalizing';
  if (activeState) {
    const age = Date.now() - job.updatedAt.getTime();
    if (age > STALE_JOB_MS) {
      await dbq.updateCoverGenerationJob(jobId, {
        status: 'failed',
        progressStage: 'failed',
        error: 'Cover generation timed out. Please retry.',
      });
      job = await dbq.getCoverGenerationJob(jobId);
      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
  }

  if (job.status === 'queued' && !isCoverJobInFlight(jobId)) {
    runCoverJobOnce(jobId, () => processCoverGenerationJob(jobId));
  }

  return NextResponse.json({
    id: job.id,
    projectId: job.projectId,
    status: job.status,
    progressStage: job.progressStage,
    error: job.error ?? null,
    input: {
      archetypeId: job.input.archetypeId,
      authorName: job.input.authorName,
      trimSizeId: job.input.trimSizeId,
      trimWidthIn: job.input.trimWidthIn,
      trimHeightIn: job.input.trimHeightIn,
    },
    result: job.result ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  });
}
