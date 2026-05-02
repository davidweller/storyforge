import type { RevisionQueue } from '@/lib/generation/schemas';

/** Human-readable summary stored as the editorial doc when structured JSON is generated first. */
export function formatStructuredQueueMarkdown(passLabel: string, queue: RevisionQueue): string {
  const lines: string[] = [
    `# Structured editorial (${passLabel})`,
    '',
    'This document was generated from **structured analysis** directly into a revision queue (no prose report pass). ',
    '',
  ];
  const tasks = [...queue.revisionTasks].sort((a, b) => a.chapterNumber - b.chapterNumber);
  for (const t of tasks) {
    lines.push(`## Chapter ${t.chapterNumber}`, '', `**Priority:** ${t.priority} · **Issues:** ${t.issueCount}`, '');
    if (t.summary?.trim()) lines.push(t.summary.trim(), '');
    if (t.issues?.length) {
      for (const issue of t.issues) {
        lines.push(`- **${issue.category}** — ${issue.description}`, `  - **Fix:** ${issue.fix}`);
        if (issue.location?.trim()) lines.push(`  - **Where:** ${issue.location}`, '');
      }
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}
