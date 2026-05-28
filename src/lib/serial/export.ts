export interface SerialExportInput {
  chapterContent: string;
  preNote?: string | null;
  postNote?: string | null;
}

function normalizeSceneBreaks(text: string): string {
  return text.replace(/\n(?:---|#\s+#\s+#)\n/g, '\n***\n');
}

export function renderRoyalRoadMarkdown(input: SerialExportInput): string {
  const parts: string[] = [];
  if (input.preNote?.trim()) {
    parts.push(`> ${input.preNote.trim()}`);
    parts.push('');
  }
  parts.push(normalizeSceneBreaks(input.chapterContent.trim()));
  if (input.postNote?.trim()) {
    parts.push('');
    parts.push(`> ${input.postNote.trim()}`);
  }
  return parts.join('\n').trim();
}
