import { NextRequest, NextResponse } from 'next/server';
import * as dbq from '@/lib/db/queries';
import { validateSerialMapping, type SerialMappingChapterInput } from '@/lib/serial/mapping';

type Body = {
  projectId?: string;
  mapping?: {
    chapters: SerialMappingChapterInput[];
    targetMin?: number;
    targetMax?: number;
    hardMax?: number;
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    const projectId = body.projectId;
    const mapping = body.mapping;
    if (!projectId || !mapping) {
      return NextResponse.json({ error: 'projectId and mapping are required' }, { status: 400 });
    }

    const targetMin = mapping.targetMin ?? 2000;
    const targetMax = mapping.targetMax ?? 3500;
    const hardMax = mapping.hardMax ?? 4500;
    const validation = validateSerialMapping(mapping.chapters, targetMin, targetMax, hardMax);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid mapping', validationErrors: validation.validationErrors },
        { status: 422 }
      );
    }

    const existing = await dbq.getDocumentByType(projectId, 'serial-chapter-mapping');
    const mappingPayload = JSON.stringify(
      {
        targetMin,
        targetMax,
        hardMax,
        chapters: mapping.chapters,
      },
      null,
      2
    );

    let mappingId: string;
    if (existing) {
      await dbq.updateDocument(existing.id, {
        content: mappingPayload,
        version: existing.version + 1,
        approved: true,
      });
      mappingId = existing.id;
    } else {
      mappingId = await dbq.createDocument({
        projectId,
        type: 'serial-chapter-mapping',
        content: mappingPayload,
        version: 1,
        approved: true,
      });
    }

    await dbq.resetProjectSerialChapters(projectId);
    for (const chapter of mapping.chapters) {
      const serialChapterId = await dbq.createSerialChapter({
        projectId,
        ordinal: chapter.ordinal,
        title: chapter.title,
        mappingId,
        hookScore: chapter.boundaryHookScore,
      });
      await dbq.createSerialChapterVersion({
        serialChapterId,
        version: 1,
        content: '',
      });
    }

    return NextResponse.json({ ok: true, mappingId, validationErrors: [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve mapping' },
      { status: 500 }
    );
  }
}
