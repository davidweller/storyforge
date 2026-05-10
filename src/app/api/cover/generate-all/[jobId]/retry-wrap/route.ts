import { NextRequest, NextResponse } from 'next/server';
import { retryWrapForJob } from '@/lib/cover/generateAllJob';
import * as dbq from '@/lib/db/queries';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await context.params;
  const job = await dbq.getCoverGenerationJob(jobId);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  try {
    await retryWrapForJob(jobId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Wrap retry failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
