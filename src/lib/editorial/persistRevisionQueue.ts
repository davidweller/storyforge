import type { EditorialPass } from '@/types';
import type { RevisionQueue } from '@/lib/generation/schemas';
import * as db from '@/lib/db/client';

/** Persists revision tasks and linked editorial issues from an already-validated queue. */
export async function persistRevisionQueueFromParsed(
  projectId: string,
  editorialPass: EditorialPass,
  revisionTasks: RevisionQueue['revisionTasks'],
): Promise<void> {
  for (const taskData of revisionTasks) {
    const issueIds: string[] = [];
    for (const issue of taskData.issues) {
      const id = await db.createEditorialIssue({
        projectId,
        chapterNumber: taskData.chapterNumber,
        editPass: editorialPass,
        category: issue.category,
        description: issue.description,
        recommendedFix: issue.fix,
        manuscriptQuote: issue.manuscriptQuote || undefined,
        locationHint: issue.location || undefined,
        sceneId: issue.sceneId || undefined,
        status: 'open',
      });
      issueIds.push(id);
    }

    const instructions =
      taskData.issueCount > 0
        ? taskData.issues
            .map(
              (issue) =>
                `${issue.category}: ${issue.description}\nLocation: ${issue.location}\nFix: ${issue.fix}`,
            )
            .join('\n\n')
        : taskData.summary || 'Review chapter for overall quality and consistency.';

    const finalInstructions =
      taskData.issueCount > 0
        ? instructions
        : taskData.summary || 'Review chapter for overall quality and consistency.';

    const taskId = await db.createRevisionTask({
      projectId,
      chapterNumber: taskData.chapterNumber,
      editPass: editorialPass,
      issueIds,
      instructions: finalInstructions,
      acceptanceCriteria: taskData.acceptanceCriteria || [],
      status: taskData.issueCount > 0 ? 'queued' : 'done',
    });

    for (const iid of issueIds) {
      await db.updateEditorialIssueTaskId(iid, taskId);
    }
  }
}
