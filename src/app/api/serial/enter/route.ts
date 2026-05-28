import { NextRequest, NextResponse } from 'next/server';
import * as dbq from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { projectId?: string };
    if (!body.projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    const result = await dbq.enterSerialisation(body.projectId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to enter serialisation' },
      { status: 500 }
    );
  }
}
