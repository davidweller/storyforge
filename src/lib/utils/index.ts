import { type ClassValue, clsx } from 'clsx';

// Simple cn function without tailwind-merge for now
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// Word count utility
export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
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

// Stage order for progression
export const STAGE_ORDER = [
  'setup',
  'genre-research',
  'niche',
  'ending',
  'characters',
  'structure',
  'chapters',
  'compilation',
  'editorial',
  'revision',
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

// Stage display names
export const STAGE_NAMES: Record<string, string> = {
  'setup': 'Getting Started',
  'genre-research': 'Market Analysis',
  'niche': 'Reader Targeting',
  'ending': 'Choose Your Ending',
  'characters': 'Cast of Characters',
  'structure': 'Plot Blueprint',
  'chapters': 'Write Chapters',
  'compilation': 'Manuscript Assembly',
  'editorial': 'Editorial Analysis',
  'revision': 'Apply Revisions',
};

// Stage descriptions
export const STAGE_DESCRIPTIONS: Record<string, string> = {
  'setup': 'Review your genre and niche selection. Add an optional premise or research notes to guide the AI.',
  'genre-research': 'AI analyzes current market trends, reader demand, and competitive positioning. You\'ll receive actionable insights about opportunities in your genre.',
  'niche': 'Define your ideal reader avatar and emotional promise. AI generates a detailed profile of who will love your book and what tropes to include or avoid.',
  'ending': 'AI generates 8-10 potential endings for your story. Select the one that resonates, then expand it into a detailed blueprint. You\'ll also name your project here.',
  'characters': 'Design your protagonist, antagonist, and supporting cast. AI creates detailed character profiles including motivations, arcs, and relationships.',
  'structure': 'Build your story structure using the Save the Cat beat sheet. AI generates a scene-by-scene breakdown to guide your chapter writing.',
  'chapters': 'Draft your novel chapter by chapter. Each chapter is generated based on your structure, characters, and ending.',
  'compilation': 'Compile all approved chapters into a complete manuscript. Preview and export your novel in multiple formats.',
  'editorial': 'AI performs a comprehensive editorial review, identifying issues with continuity, pacing, character consistency, and prose.',
  'revision': 'Work through editorial suggestions chapter by chapter. AI helps you implement fixes while maintaining your voice.',
};

// Model used per stage - re-exported from models.ts for backwards compatibility
export { STAGE_DEFAULT_PROVIDERS as STAGE_MODELS } from '@/lib/data/models';
