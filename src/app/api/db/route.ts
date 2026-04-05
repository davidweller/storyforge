import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const { action } = body;

    switch (action) {
      // ── Projects ────────────────────────────────────────────────────────
      case 'createProject': {
        const id = await q.createProject(
          body.userId as string,
          body.data as Parameters<typeof q.createProject>[1]
        );
        return NextResponse.json(id);
      }
      case 'getProject': {
        const project = await q.getProject(body.projectId as string);
        return NextResponse.json(project);
      }
      case 'getUserProjects': {
        const projects = await q.getUserProjects(body.userId as string);
        return NextResponse.json(projects);
      }
      case 'updateProject': {
        await q.updateProject(
          body.projectId as string,
          body.data as Parameters<typeof q.updateProject>[1]
        );
        return NextResponse.json({ ok: true });
      }
      case 'deleteProjectData': {
        await q.deleteProjectData(body.projectId as string);
        return NextResponse.json({ ok: true });
      }

      // ── Documents ───────────────────────────────────────────────────────
      case 'createDocument': {
        const id = await q.createDocument(
          body.data as Parameters<typeof q.createDocument>[0]
        );
        return NextResponse.json(id);
      }
      case 'getProjectDocuments': {
        const docs = await q.getProjectDocuments(body.projectId as string);
        return NextResponse.json(docs);
      }
      case 'getDocumentByType': {
        const doc = await q.getDocumentByType(
          body.projectId as string,
          body.type as Parameters<typeof q.getDocumentByType>[1]
        );
        return NextResponse.json(doc);
      }
      case 'updateDocument': {
        await q.updateDocument(
          body.documentId as string,
          body.data as Parameters<typeof q.updateDocument>[1]
        );
        return NextResponse.json({ ok: true });
      }

      // ── Chapters ─────────────────────────────────────────────────────────
      case 'createChapter': {
        const id = await q.createChapter(
          body.data as Parameters<typeof q.createChapter>[0]
        );
        return NextResponse.json(id);
      }
      case 'getProjectChapters': {
        const chapters = await q.getProjectChapters(body.projectId as string);
        return NextResponse.json(chapters);
      }
      case 'updateChapter': {
        await q.updateChapter(
          body.chapterId as string,
          body.data as Parameters<typeof q.updateChapter>[1]
        );
        return NextResponse.json({ ok: true });
      }

      // ── Chapter Versions ─────────────────────────────────────────────────
      case 'createChapterVersion': {
        const id = await q.createChapterVersion(
          body.data as Parameters<typeof q.createChapterVersion>[0]
        );
        return NextResponse.json(id);
      }
      case 'getChapterVersions': {
        const versions = await q.getChapterVersions(body.chapterId as string);
        return NextResponse.json(versions);
      }
      case 'getApprovedChapterVersions': {
        const versions = await q.getApprovedChapterVersions(body.projectId as string);
        return NextResponse.json(versions);
      }
      case 'updateChapterVersion': {
        await q.updateChapterVersion(
          body.versionId as string,
          body.data as Parameters<typeof q.updateChapterVersion>[1]
        );
        return NextResponse.json({ ok: true });
      }

      // ── Editorial Issues ─────────────────────────────────────────────────
      case 'createEditorialIssue': {
        const id = await q.createEditorialIssue(
          body.data as Parameters<typeof q.createEditorialIssue>[0]
        );
        return NextResponse.json(id);
      }
      case 'getProjectEditorialIssues': {
        const issues = await q.getProjectEditorialIssues(body.projectId as string);
        return NextResponse.json(issues);
      }
      case 'updateEditorialIssue': {
        await q.updateEditorialIssue(
          body.issueId as string,
          body.data as Parameters<typeof q.updateEditorialIssue>[1]
        );
        return NextResponse.json({ ok: true });
      }

      // ── Revision Tasks ───────────────────────────────────────────────────
      case 'createRevisionTask': {
        const id = await q.createRevisionTask(
          body.data as Parameters<typeof q.createRevisionTask>[0]
        );
        return NextResponse.json(id);
      }
      case 'getProjectRevisionTasks': {
        const tasks = await q.getProjectRevisionTasks(body.projectId as string);
        return NextResponse.json(tasks);
      }
      case 'updateRevisionTask': {
        await q.updateRevisionTask(
          body.taskId as string,
          body.data as Parameters<typeof q.updateRevisionTask>[1]
        );
        return NextResponse.json({ ok: true });
      }
      case 'deleteRevisionTasksForProjectAndPass': {
        await q.deleteRevisionTasksForProjectAndPass(
          body.projectId as string,
          body.pass as Parameters<typeof q.deleteRevisionTasksForProjectAndPass>[1]
        );
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[/api/db] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Database operation failed' },
      { status: 500 }
    );
  }
}
