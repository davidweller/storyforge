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
  'setup': 'Project Setup',
  'genre-research': 'Genre Research',
  'niche': 'Niche Positioning',
  'ending': 'Ending Development',
  'characters': 'Character Design',
  'structure': 'Story Structure',
  'chapters': 'Chapter Drafting',
  'compilation': 'Compilation',
  'editorial': 'Editorial Review',
  'revision': 'Revision',
};

// Stage descriptions
export const STAGE_DESCRIPTIONS: Record<string, string> = {
  'setup': 'Set up your project with basic information',
  'genre-research': 'Analyze market opportunities and genre trends',
  'niche': 'Define your target audience and positioning',
  'ending': 'Develop your story\'s ending first',
  'characters': 'Design your cast of characters',
  'structure': 'Build your story structure using Save the Cat beats',
  'chapters': 'Write your chapters one at a time',
  'compilation': 'Compile your manuscript for export',
  'editorial': 'Get AI-powered editorial feedback',
  'revision': 'Apply revisions chapter by chapter',
};

// Model used per stage
export const STAGE_MODELS: Record<string, 'openai' | 'claude'> = {
  'setup': 'openai',
  'genre-research': 'openai',
  'niche': 'openai',
  'ending': 'claude',
  'characters': 'openai',
  'structure': 'openai',
  'chapters': 'claude',
  'compilation': 'openai',
  'editorial': 'openai',
  'revision': 'claude',
};
