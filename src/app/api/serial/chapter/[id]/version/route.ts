import { NextRequest, NextResponse } from 'next/server';
import * as dbq from '@/lib/db/queries';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      content?: string;
      preNote?: string | null;
      postNote?: string | null;
      parentVersionId?: string | null;
    };

    if (!body.content?.trim()) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const serialChapter = await dbq.getSerialChapter(id);
    if (!serialChapter) {
      return NextResponse.json({ error: 'Serial chapter not found' }, { status: 404 });
    }

    const latest = await dbq.getLatestSerialChapterVersion(id);
    const newVersion = (latest?.version ?? 0) + 1;
    const versionId = await dbq.createSerialChapterVersion({
      serialChapterId: id,
      version: newVersion,
      parentVersionId: body.parentVersionId ?? latest?.id ?? null,
      content: body.content.trim(),
      preNote: body.preNote ?? null,
      postNote: body.postNote ?? null,
    });

    return NextResponse.json({ id: versionId, version: newVersion });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create serial chapter version' },
      { status: 500 }
    );
  }
}
