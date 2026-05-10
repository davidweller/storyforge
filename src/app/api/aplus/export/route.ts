import { NextRequest } from 'next/server';
import * as q from '@/lib/db/queries';
import type { APlusImagePayload } from '@/types';
import { slugify } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const projectId = search.get('projectId') ?? '';
  const moduleId = search.get('moduleId') ?? '';
  if (!projectId || !moduleId) {
    return new Response('Missing projectId/moduleId', { status: 400 });
  }

  const project = await q.getProject(projectId);
  if (!project) return new Response('Project not found', { status: 404 });

  const doc = await q.getDocument(moduleId);
  if (!doc || doc.projectId !== projectId || doc.type !== 'a-plus-module') {
    return new Response('A+ module not found', { status: 404 });
  }

  let payload: APlusImagePayload;
  try {
    payload = JSON.parse(doc.content) as APlusImagePayload;
  } catch {
    return new Response('Invalid A+ image payload', { status: 400 });
  }

  const fileName = `${slugify(project.title || 'untitled')}-aplus-${payload.moduleType}-v${payload.version}-${new Date().toISOString().slice(0, 10)}.png`;
  const body = Buffer.from(payload.imageData, 'base64');
  return new Response(body, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
