import { createHash } from 'crypto';
import { countWords } from '@/lib/utils';

export interface ParsedSerialScene {
  sceneId: string;
  content: string;
  wordCount: number;
}

export interface ParsedSerialChapter {
  ordinal: number;
  title: string;
  rawHeading: string;
  scenes: ParsedSerialScene[];
  wordCount: number;
}

export interface ParsedSerialManuscript {
  chapters: ParsedSerialChapter[];
  chapterCount: number;
  sceneCount: number;
  totalWords: number;
}

export interface StructuralDiffSummary {
  chapterCountDelta: number;
  sceneCountDelta: number;
  wordCountDelta: number;
  chapterWordCountChanges: Array<{ chapterOrdinal: number; delta: number; percentDelta: number }>;
  chaptersAdded: number[];
  chaptersRemoved: number[];
}

const CHAPTER_HEADING_RE = /^(#{1,2})\s+(.+)$|^Chapter\s+(\d+)\b.*$/i;
const SCENE_BREAK_RE = /^(?:\*\*\*|---|#\s+#\s+#|\s*\*\s*\*\s*\*\s*)$/;

function sceneIdFor(ordinal: number, sceneIndex: number, content: string): string {
  const seed = `${ordinal}:${sceneIndex}:${content.slice(0, 64)}`;
  return createHash('sha1').update(seed).digest('hex').slice(0, 12);
}

function parseHeading(line: string): string | null {
  const match = line.match(CHAPTER_HEADING_RE);
  if (!match) return null;
  if (match[2]) return match[2].trim();
  if (match[3]) return `Chapter ${match[3]}`;
  return line.trim();
}

export function parseSerialMarkdown(markdown: string): ParsedSerialManuscript {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const chapters: ParsedSerialChapter[] = [];

  let currentTitle: string | null = null;
  let currentRawHeading = '';
  let sceneBuffer: string[] = [];
  let chapterScenes: ParsedSerialScene[] = [];
  let chapterOrdinal = 0;

  const flushScene = () => {
    const text = sceneBuffer.join('\n').trim();
    sceneBuffer = [];
    if (!text) return;
    const sceneIndex = chapterScenes.length + 1;
    chapterScenes.push({
      sceneId: sceneIdFor(chapterOrdinal || 1, sceneIndex, text),
      content: text,
      wordCount: countWords(text),
    });
  };

  const flushChapter = () => {
    flushScene();
    if (!currentTitle || chapterScenes.length === 0) {
      chapterScenes = [];
      return;
    }
    const wordCount = chapterScenes.reduce((sum, s) => sum + s.wordCount, 0);
    chapters.push({
      ordinal: chapterOrdinal,
      title: currentTitle,
      rawHeading: currentRawHeading,
      scenes: chapterScenes,
      wordCount,
    });
    chapterScenes = [];
  };

  for (const line of lines) {
    const heading = parseHeading(line);
    if (heading) {
      flushChapter();
      chapterOrdinal += 1;
      currentTitle = heading;
      currentRawHeading = line.trim();
      continue;
    }
    if (!currentTitle) continue;
    if (SCENE_BREAK_RE.test(line.trim())) {
      flushScene();
      continue;
    }
    sceneBuffer.push(line);
  }

  flushChapter();

  const sceneCount = chapters.reduce((sum, c) => sum + c.scenes.length, 0);
  const totalWords = chapters.reduce((sum, c) => sum + c.wordCount, 0);
  return {
    chapters,
    chapterCount: chapters.length,
    sceneCount,
    totalWords,
  };
}

export function buildStructuralDiff(
  baseline: ParsedSerialManuscript,
  candidate: ParsedSerialManuscript
): StructuralDiffSummary {
  const chapterCountDelta = candidate.chapterCount - baseline.chapterCount;
  const sceneCountDelta = candidate.sceneCount - baseline.sceneCount;
  const wordCountDelta = candidate.totalWords - baseline.totalWords;

  const maxChapters = Math.max(baseline.chapterCount, candidate.chapterCount);
  const chapterWordCountChanges: Array<{
    chapterOrdinal: number;
    delta: number;
    percentDelta: number;
  }> = [];
  const chaptersAdded: number[] = [];
  const chaptersRemoved: number[] = [];

  for (let i = 1; i <= maxChapters; i += 1) {
    const before = baseline.chapters[i - 1];
    const after = candidate.chapters[i - 1];
    if (!before && after) {
      chaptersAdded.push(i);
      continue;
    }
    if (before && !after) {
      chaptersRemoved.push(i);
      continue;
    }
    if (!before || !after) continue;
    const delta = after.wordCount - before.wordCount;
    const percentDelta = before.wordCount > 0 ? (delta / before.wordCount) * 100 : 0;
    if (Math.abs(percentDelta) >= 5) {
      chapterWordCountChanges.push({ chapterOrdinal: i, delta, percentDelta });
    }
  }

  return {
    chapterCountDelta,
    sceneCountDelta,
    wordCountDelta,
    chapterWordCountChanges,
    chaptersAdded,
    chaptersRemoved,
  };
}
