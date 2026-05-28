import { NextRequest, NextResponse } from 'next/server';
import * as dbq from '@/lib/db/queries';
import { renderRoyalRoadMarkdown } from '@/lib/serial/export';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const serialChapter = await dbq.getSerialChapter(id);
    if (!serialChapter) {
      return NextResponse.json({ error: 'Serial chapter not found' }, { status: 404 });
    }
    const latest = await dbq.getLatestSerialChapterVersion(id);
    if (!latest) {
      return NextResponse.json({ error: 'No serial chapter version found' }, { status: 404 });
    }
    const markdown = renderRoyalRoadMarkdown({
      chapterContent: latest.content,
      preNote: latest.preNote,
      postNote: latest.postNote,
    });
    return NextResponse.json({ markdown, chapterId: id, version: latest.version });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export serial chapter' },
      { status: 500 }
    );
  }
}
