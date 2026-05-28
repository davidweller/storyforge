import { NextRequest, NextResponse } from 'next/server';
import * as dbq from '@/lib/db/queries';
import { parseSerialMarkdown, buildStructuralDiff } from '@/lib/serial/parser';

function buildCompiledManuscript(
  chapters: Awaited<ReturnType<typeof dbq.getProjectChapters>>,
  approvedVersions: Awaited<ReturnType<typeof dbq.getApprovedChapterVersions>>
): string {
  const versionsByChapter = new Map(approvedVersions.map((v) => [v.chapterId, v]));
  return chapters
    .map((chapter) => {
      const version = versionsByChapter.get(chapter.id);
      if (!version) return '';
      return `# Chapter ${chapter.chapterNumber}: ${chapter.title}\n\n${version.content.trim()}`;
    })
    .filter(Boolean)
    .join('\n\n***\n\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { projectId?: string; markdown?: string };
    if (!body.projectId || !body.markdown?.trim()) {
      return NextResponse.json(
        { error: 'projectId and markdown are required' },
        { status: 400 }
      );
    }

    const chapters = await dbq.getProjectChapters(body.projectId);
    const approvedVersions = await dbq.getApprovedChapterVersions(body.projectId);
    const compiled = buildCompiledManuscript(chapters, approvedVersions);
    const baseline = parseSerialMarkdown(compiled);
    const candidate = parseSerialMarkdown(body.markdown);
    const diff = buildStructuralDiff(baseline, candidate);

    const stagedDocId = await dbq.createDocument({
      projectId: body.projectId,
      type: 'source-manuscript',
      content: body.markdown,
      version: 1,
      approved: false,
    });

    return NextResponse.json({
      stagedDocId,
      baseline,
      candidate,
      diff,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload source manuscript' },
      { status: 500 }
    );
  }
}
