import { z } from 'zod';
import type {
  BackCoverBriefDocument,
  BackCoverBriefDocumentLegacy,
  BackCoverBriefDocumentV2,
  CoverBriefDocument,
  CoverBriefDocumentLegacy,
  CoverBriefDocumentV2,
} from '@/types';

const derivedFromSchema = z.object({
  storyBibleDocumentId: z.string(),
  creativeBriefDocumentId: z.string().nullable(),
  titleApprovedAt: z.string(),
});

export const CoverBriefDocumentLegacySchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  derivedFrom: derivedFromSchema,
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

const layerBackgroundSchema = z.object({
  description: z.string(),
  paletteDirection: z.string(),
  lightingNotes: z.string(),
});

const layerTextSchema = z.object({
  titleText: z.string(),
  authorText: z.string(),
  seriesText: z.string().nullable(),
  typographyDirection: z.string(),
  textPlacement: z.string(),
});

const coverBriefLayersSchema = z.object({
  background: layerBackgroundSchema,
  symbol: z
    .object({
      description: z.string(),
      placement: z.string(),
      detailNotes: z.string(),
    })
    .optional(),
  object: z
    .object({
      description: z.string(),
      placement: z.string(),
    })
    .optional(),
  protagonist: z
    .object({
      description: z.string(),
      pose: z.string(),
      emotionalState: z.string(),
    })
    .optional(),
  protagonistB: z
    .object({
      description: z.string(),
      pose: z.string(),
    })
    .optional(),
  landscape: z
    .object({
      description: z.string(),
      scaleNotes: z.string(),
    })
    .optional(),
  foregroundElement: z
    .object({
      description: z.string(),
    })
    .optional(),
  mysteriousSubject: z
    .object({
      description: z.string(),
      revealLevel: z.string(),
    })
    .optional(),
  focalElement: z
    .object({
      description: z.string(),
      illustrationStyle: z.string(),
    })
    .optional(),
  action: z
    .object({
      description: z.string(),
      motionDirection: z.string(),
    })
    .optional(),
  text: layerTextSchema,
});

const ARCHETYPE_IDS = [
  'A1',
  'A2',
  'A3',
  'A4',
  'A5',
  'A6',
  'A7',
  'R1',
  'R2',
  'R3',
  'R4',
  'R5',
  'R6',
] as const;

export const CoverBriefDocumentV2Schema = z.object({
  schemaVersion: z.literal(2),
  generatedAt: z.string(),
  archetypeId: z.enum(ARCHETYPE_IDS),
  derivedFrom: derivedFromSchema,
  layers: coverBriefLayersSchema,
  moodKeywords: z.array(z.string()).min(2).max(10),
  visualAvoid: z.array(z.string()),
  coverComps: z.array(z.string()).min(1).max(8),
  resolvedPrompt: z.string(),
  promptOverridden: z.boolean(),
});

export const BackCoverBriefLegacySchema = z.object({
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

export const BackCoverBriefV2Schema = z.object({
  schemaVersion: z.literal(2),
  coverSide: z.literal('back'),
  derivedFrom: z.object({
    coverBriefDocumentId: z.string(),
    approvedCoverImageId: z.string(),
  }),
  layers: z.object({
    background: z.object({
      description: z.string(),
      styleNotes: z.string(),
    }),
    blurbTextArea: z.object({
      blurbText: z.string(),
      placement: z.string(),
      typographyTreatment: z.string(),
      contrastNotes: z.string(),
    }),
    authorBioArea: z
      .object({
        bioText: z.string(),
        placement: z.string(),
        photoPlaceholderNotes: z.string(),
      })
      .optional(),
    publisherLogoArea: z
      .object({
        placement: z.string(),
        sizingNotes: z.string(),
      })
      .optional(),
    barcodeArea: z.object({
      placement: z.string(),
      sizeNotes: z.string(),
    }),
  }),
  moodKeywords: z.array(z.string()),
  visualAvoid: z.array(z.string()),
  resolvedPrompt: z.string(),
  promptOverridden: z.boolean(),
  approvedAt: z.string().nullable(),
});

export function parseCoverBrief(content: string): CoverBriefDocument {
  const trimmed = content.trim();
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const raw = JSON.parse(unfenced) as { schemaVersion?: number };
  if (raw.schemaVersion === 2) {
    return CoverBriefDocumentV2Schema.parse(raw) as CoverBriefDocumentV2;
  }
  return CoverBriefDocumentLegacySchema.parse(raw) as CoverBriefDocumentLegacy;
}

export function parseBackCoverBrief(content: string): BackCoverBriefDocument {
  const trimmed = content.trim();
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const raw = JSON.parse(unfenced) as { schemaVersion?: number };
  if (raw.schemaVersion === 2) {
    return BackCoverBriefV2Schema.parse(raw) as BackCoverBriefDocumentV2;
  }
  return BackCoverBriefLegacySchema.parse(raw) as BackCoverBriefDocumentLegacy;
}
