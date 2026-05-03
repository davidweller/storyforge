import { z } from 'zod';
import type { BackCoverBriefDocument, CoverBriefDocument } from '@/types';

export const CoverBriefDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  derivedFrom: z.object({
    storyBibleDocumentId: z.string(),
    creativeBriefDocumentId: z.string().nullable(),
    titleApprovedAt: z.string(),
  }),
  recommendedArchetypes: z
    .array(
      z.object({
        archetypeId: z.string(),
        rationale: z.string(),
      })
    )
    .min(2)
    .max(6),
  paletteDirection: z.string(),
  visualElements: z.array(z.string()),
  visualAvoid: z.array(z.string()),
  typographyDirection: z.string(),
  moodKeywords: z.array(z.string()).min(2).max(10),
  coverComps: z.array(z.string()).min(1).max(6),
});

export const BackCoverBriefDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  derivedFrom: z.object({
    coverBriefDocumentId: z.string(),
    approvedCoverImageId: z.string(),
  }),
  backgroundStyle: z.string(),
  moodContinuity: z.string(),
  avoidElements: z.array(z.string()),
  compositionNotes: z.string(),
  approvedAt: z.string().nullable(),
});

export function parseCoverBrief(content: string): CoverBriefDocument {
  const trimmed = content.trim();
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return CoverBriefDocumentSchema.parse(JSON.parse(unfenced)) as CoverBriefDocument;
}

export function parseBackCoverBrief(content: string): BackCoverBriefDocument {
  const trimmed = content.trim();
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return BackCoverBriefDocumentSchema.parse(JSON.parse(unfenced)) as BackCoverBriefDocument;
}
