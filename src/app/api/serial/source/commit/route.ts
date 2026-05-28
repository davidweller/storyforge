import { NextRequest, NextResponse } from 'next/server';
import * as dbq from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { projectId?: string; stagedDocId?: string };
    if (!body.projectId || !body.stagedDocId) {
      return NextResponse.json(
        { error: 'projectId and stagedDocId are required' },
        { status: 400 }
      );
    }

    const staged = await dbq.getDocument(body.stagedDocId);
    if (!staged || staged.projectId !== body.projectId || staged.type !== 'source-manuscript') {
      return NextResponse.json({ error: 'Staged source document not found' }, { status: 404 });
    }

    await dbq.updateDocument(body.stagedDocId, { approved: true });
    await dbq.updateProject(body.projectId, { serialSourceDocumentId: body.stagedDocId });
    return NextResponse.json({ ok: true, serialSourceDocumentId: body.stagedDocId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to commit source manuscript' },
      { status: 500 }
    );
  }
}
