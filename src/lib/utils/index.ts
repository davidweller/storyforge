import { type ClassValue, clsx } from 'clsx';
import { canProceedToExportFinal } from '@/lib/editorial/passes';

// Simple cn function without tailwind-merge for now
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Compute the display status of a workflow stage in the sidebar.
 * Extracted from WorkflowSidebar so it can be used independently and tested.
 */
export function getStageStatus(
  stage: import('@/types').WorkflowStage,
  currentStage: import('@/types').WorkflowStage,
  chapters?: import('@/types').Chapter[],
  approvedChapterIds?: Set<string>,
  revisionTasks?: import('@/types').RevisionTask[],
  finalExportedAt?: Date,
  fourPassEditorial?: boolean
): import('@/types').StageStatus {
  const stageIndex = getStageIndex(stage);
  const currentIndex = getStageIndex(currentStage);
  const projectStub = { fourPassEditorial: fourPassEditorial ?? false };

  if (stageIndex < currentIndex) return 'approved';
  if (stageIndex === currentIndex) {
    if (stage === 'revision' && revisionTasks && revisionTasks.length > 0) {
      const allDone = revisionTasks.every((t) => t.status === 'done');
      if (allDone && canProceedToExportFinal(projectStub, revisionTasks)) return 'approved';
    }
    if (stage === 'export-final' && finalExportedAt) return 'approved';
    return 'in_progress';
  }

  // Allow compilation access early if all chapters are approved
  if (stage === 'compilation' && currentStage === 'chapters' && chapters && approvedChapterIds) {
    if (chapters.length > 0 && chapters.every((ch) => approvedChapterIds.has(ch.id))) return 'not_started';
  }

  // Allow export-final when revision pipeline is complete
  if (stage === 'export-final' && currentStage === 'revision' && revisionTasks && revisionTasks.length > 0) {
    if (canProceedToExportFinal(projectStub, revisionTasks)) return 'not_started';
  }

  if (isStageAccessible(currentStage, stage)) return 'not_started';
  return 'locked';
}

/**
 * Rough token count estimate using the ~4 chars/token heuristic.
 * Accurate enough for context-window threshold checks; not suitable for billing.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Word count utility
export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

const DEFAULT_WORDS_PER_CHAPTER = 3000;

/**
 * Cap outline word targets so their sum does not exceed maxTotalWords.
 * If the sum is over the limit, scales each wordTarget proportionally.
 */
export function capOutlineWordTargets<T extends { wordTarget?: number }>(
  outlines: T[],
  maxTotalWords: number
): T[] {
  const total = outlines.reduce((sum, o) => sum + (o.wordTarget ?? DEFAULT_WORDS_PER_CHAPTER), 0);
  if (total <= maxTotalWords || total <= 0) return outlines;
  const scale = maxTotalWords / total;
  return outlines.map((o) => ({
    ...o,
    wordTarget: Math.max(500, Math.round((o.wordTarget ?? DEFAULT_WORDS_PER_CHAPTER) * scale)),
  }));
}

// Format date for display
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

// Format relative time
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

// Truncate text with ellipsis
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// Generate a slug from text
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Stage order for linear workflow progression.
// NOTE: 'blurb' and 'amazon-description' are intentionally excluded here even
// though they exist in the WorkflowStage union type. Those two are post-pipeline
// marketing tools accessible from the project dashboard, not sequential steps.
// As a result, getStageIndex() returns -1 for them — callers must guard for this
// before using the result in comparisons or array access.
export const STAGE_ORDER = [
  'setup',
  'genre-research',
  'niche',
  'ending',
  'characters',
  'structure',
  'title',
  'chapter-outlines',
  'chapters',
  'compilation',
  'export-draft',
  'editorial',
  'revision',
  'export-final',
] as const;

// Get stage index
export function getStageIndex(stage: string): number {
  return STAGE_ORDER.indexOf(stage as typeof STAGE_ORDER[number]);
}

// Check if stage is accessible
export function isStageAccessible(currentStage: string, targetStage: string): boolean {
  const currentIndex = getStageIndex(currentStage);
  const targetIndex = getStageIndex(targetStage);
  return targetIndex <= currentIndex;
}

// Get next stage
export function getNextStage(currentStage: string): string | null {
  const currentIndex = getStageIndex(currentStage);
  if (currentIndex === -1 || currentIndex >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[currentIndex + 1];
}

const DOCUMENT_STAGE_ROUTES: Partial<Record<import('@/types').DocumentType, import('@/types').WorkflowStage>> = {
  genre: 'genre-research',
  niche: 'niche',
  ending: 'ending',
  characters: 'characters',
  structure: 'structure',
  'chapter-outlines': 'chapter-outlines',
  'editorial': 'editorial',
  'editorial-structural': 'editorial',
  'editorial-line': 'editorial',
  'editorial-copy': 'editorial',
  'editorial-proofread': 'editorial',
  'editorial-final': 'editorial',
};

export function getStageRouteForDocument(type: import('@/types').DocumentType): import('@/types').WorkflowStage | null {
  return DOCUMENT_STAGE_ROUTES[type] ?? null;
}

// Stage display names
export const STAGE_NAMES: Record<string, string> = {
  'setup': 'Getting Started',
  'genre-research': 'Market Analysis',
  'niche': 'Reader Targeting',
  'ending': 'Choose Your Ending',
  'characters': 'Cast of Characters',
  'structure': 'Plot Blueprint',
  'title': 'Title',
  'chapter-outlines': 'Chapter Outlines',
  'chapters': 'Write Chapters',
  'compilation': 'Manuscript Assembly',
  'export-draft': 'Export Draft',
  'editorial': 'Editorial Analysis',
  'revision': 'Apply Revisions',
  'export-final': 'Export Final',
};

// Stage descriptions
export const STAGE_DESCRIPTIONS: Record<string, string> = {
  'setup': 'Review your genre and niche selection. Add an optional premise or research notes to guide the AI.',
  'genre-research': 'AI analyzes current market trends, reader demand, and competitive positioning. You\'ll receive actionable insights about opportunities in your genre.',
  'niche': 'Define your ideal reader avatar and emotional promise. AI generates a detailed profile of who will love your book and what tropes to include or avoid.',
  'ending': 'AI generates 8-10 potential endings for your story. Select the one that resonates, then expand it into a detailed blueprint.',
  'characters': 'Design your protagonist, antagonist, and supporting cast. AI creates detailed character profiles including motivations, arcs, and relationships.',
  'structure': 'Build your story structure using the Save the Cat beat sheet. AI generates a scene-by-scene breakdown to guide your chapter writing.',
  'title': 'Generate title ideas for your novel. Choose your favourite and it becomes the name of your book.',
  'chapter-outlines': 'Convert your Plot Blueprint beats into detailed chapter outlines. Each chapter includes title, story beat, scene goals, POV, and key plot points needed for writing.',
  'chapters': 'Draft your novel chapter by chapter. Each chapter is generated based on your chapter outlines, characters, and ending.',
  'compilation': 'Compile all approved chapters into a complete manuscript. Preview your draft manuscript before export.',
  'export-draft': 'Export your draft manuscript in multiple formats. Download your work-in-progress for review or sharing.',
  'editorial': 'AI performs a comprehensive editorial review, identifying issues with continuity, pacing, character consistency, and prose.',
  'revision': 'Work through editorial suggestions chapter by chapter. AI helps you implement fixes while maintaining your voice.',
  'export-final': 'Export your final manuscript after revisions. Download the polished version ready for publication or submission.',
};

// Model used per stage - re-exported from models.ts for backwards compatibility
export { STAGE_DEFAULT_PROVIDERS as STAGE_MODELS } from '@/lib/data/models';

/**
 * Apply basic markdown-style bold/italic to already-escaped HTML text.
 */
function applyInlineFormat(escaped: string): string {
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
}

/**
 * Convert plain text to HTML with proper paragraph formatting (book-like).
 * Handles double newlines as paragraph breaks, single newlines as line breaks,
 * and basic **bold** / *italic* so content does not show raw markdown.
 */
export function textToHtml(text: string): string {
  if (!text) return '';

  // Check if content is already HTML (contains HTML tags)
  const isHtml = /<[a-z][\s\S]*>/i.test(text);
  if (isHtml) {
    return text;
  }

  // Escape HTML entities
  const html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Split by double newlines (paragraph breaks)
  const paragraphs = html.split(/\n\n+/);

  // Convert each paragraph with book-like spacing and inline formatting
  const formattedParagraphs = paragraphs
    .map((para) => {
      const trimmed = para.trim();
      if (!trimmed) return '';

      const withInline = applyInlineFormat(trimmed);
      const withBreaks = withInline.replace(/\n/g, '<br />');

      return `<p style="margin-bottom: 0.75em; line-height: 1.75;">${withBreaks}</p>`;
    })
    .filter((p) => p);

  return formattedParagraphs.join('\n');
}