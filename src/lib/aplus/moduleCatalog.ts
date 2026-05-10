import type { APlusModuleType } from '@/types';

export interface APlusModuleMeta {
  id: APlusModuleType;
  label: string;
  purpose: string;
  composition: string;
  textSuitability: 'usually-none' | 'optional-short' | 'text-forward';
}

export const APLUS_MODULES: APlusModuleMeta[] = [
  {
    id: 'hero-banner',
    label: 'Hero / Banner',
    purpose: 'Primary cinematic showcase image for the book brand.',
    composition: 'Strong focal scene with clear foreground subject and dramatic depth.',
    textSuitability: 'optional-short',
  },
  {
    id: 'character-spotlight',
    label: 'Character Spotlight',
    purpose: 'Highlight protagonist or major character identity.',
    composition: 'Character-forward framing with expressive pose and story cue props.',
    textSuitability: 'optional-short',
  },
  {
    id: 'world-spotlight',
    label: 'World / Setting Spotlight',
    purpose: 'Sell atmosphere and setting appeal.',
    composition: 'Environmental composition with mood, scale, and location clues.',
    textSuitability: 'usually-none',
  },
  {
    id: 'trope-promise',
    label: 'Tropes / Promise Module',
    purpose: 'Signal key reading promises and genre hooks.',
    composition: 'Iconic visual symbols for trope expectations with simple hierarchy.',
    textSuitability: 'optional-short',
  },
  {
    id: 'series-author-brand',
    label: 'Series / Author Module',
    purpose: 'Reinforce author identity and series continuity.',
    composition: 'Brand-forward composition with consistent motif and spacious layout.',
    textSuitability: 'text-forward',
  },
  {
    id: 'quote-review',
    label: 'Quote / Review Module',
    purpose: 'Support social proof via quote-led visual card.',
    composition: 'Readable typography zone with tasteful supporting imagery.',
    textSuitability: 'text-forward',
  },
];

const VALID_APLUS_MODULE_ID = new Set<string>(APLUS_MODULES.map((m) => m.id));

/** Parse `selectedModules` from sessionStorage JSON without trusting the shape. */
export function parseStoredAPlusModuleIds(raw: unknown): APlusModuleType[] {
  if (!Array.isArray(raw)) return [];
  const out: APlusModuleType[] = [];
  for (const x of raw) {
    if (typeof x === 'string' && VALID_APLUS_MODULE_ID.has(x)) {
      out.push(x as APlusModuleType);
    }
  }
  return out;
}

export const APLUS_SETUP_STORAGE_PREFIX = 'storyforge.aplus.setup.';
