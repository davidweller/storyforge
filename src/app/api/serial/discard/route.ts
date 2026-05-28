import { NextRequest, NextResponse } from 'next/server';
import * as dbq from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { projectId?: string; confirmationToken?: string };
    if (!body.projectId || !body.confirmationToken?.trim()) {
      return NextResponse.json(
        { error: 'projectId and confirmationToken are required' },
        { status: 400 }
      );
    }
    const project = await dbq.getProject(body.projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if ((project.title ?? '').trim() !== body.confirmationToken.trim()) {
      return NextResponse.json(
        { error: 'confirmationToken must match project title' },
        { status: 422 }
      );
    }
    await dbq.discardSerialisation(body.projectId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to discard serialisation' },
      { status: 500 }
    );
  }
}
