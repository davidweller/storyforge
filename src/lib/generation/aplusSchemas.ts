import { z } from 'zod';
import type { APlusBriefDocument } from '@/types';

const APlusModuleTypeSchema = z.enum([
  'hero-banner',
  'character-spotlight',
  'world-spotlight',
  'trope-promise',
  'series-author-brand',
  'quote-review',
]);

export const APlusBriefSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  moduleType: APlusModuleTypeSchema,
  promptDraft: z.string().min(24),
  suggestedText: z.string().nullable(),
  compositionNotes: z.array(z.string()).default([]),
  negativeConstraints: z.array(z.string()).default([]),
});

export function parseAPlusBrief(content: string): APlusBriefDocument {
  const trimmed = content.trim();
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const raw = JSON.parse(unfenced) as unknown;
  return APlusBriefSchema.parse(raw);
}
