import { describe, expect, it } from 'vitest';
import { CoverBriefDocumentV2Schema } from '@/lib/generation/coverSchemas';
import { buildCoverPromptBodyV2 } from '@/lib/prompts/covers';
import { defaultThirdZones } from '@/lib/cover/fullWrapZones';
import type { CoverBriefDocumentV2 } from '@/types';

function sampleV2(archetypeId: 'A1' | 'R2'): CoverBriefDocumentV2 {
  const baseLayers = {
    background: {
      description: 'Misty peaks at dawn',
      paletteDirection: 'cool teals against warm rim light',
      lightingNotes: 'soft side light',
    },
    text: {
      titleText: 'The Lost Peak',
      authorText: 'A. Writer',
      seriesText: null,
      typographyDirection: 'modern serif condensed',
      textPlacement: 'upper third centred',
    },
  };
  if (archetypeId === 'A1') {
    return {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      archetypeId: 'A1',
      derivedFrom: { storyBibleDocumentId: 'sb1', creativeBriefDocumentId: null, titleApprovedAt: new Date().toISOString() },
      layers: {
        ...baseLayers,
        symbol: { description: 'ancient compass rose', placement: 'centred', detailNotes: 'etched metal' },
      },
      moodKeywords: ['mysterious', 'epic'],
      visualAvoid: ['modern tech'],
      coverComps: ['Comp one', 'Comp two'],
      resolvedPrompt: '',
      promptOverridden: false,
    };
  }
  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    archetypeId: 'R2',
    derivedFrom: { storyBibleDocumentId: 'sb1', creativeBriefDocumentId: null, titleApprovedAt: new Date().toISOString() },
    layers: {
      ...baseLayers,
      protagonist: {
        description: 'young woman with windblown coat',
        pose: 'three-quarter gaze',
        emotionalState: 'hope',
      },
    },
    moodKeywords: ['warm', 'hopeful'],
    visualAvoid: ['cold palettes'],
    coverComps: ['Comp'],
    resolvedPrompt: '',
    promptOverridden: false,
  };
}

describe('cover brief v2', () => {
  it('parses archetype brief with Zod', () => {
    const b = sampleV2('A1');
    const out = CoverBriefDocumentV2Schema.parse(b);
    expect(out.layers.symbol?.description).toContain('compass');
  });

  it('assembles prompt body mentioning title and archetype motifs', () => {
    const b = sampleV2('A1');
    const txt = buildCoverPromptBodyV2('Epic Fantasy', b);
    expect(txt).toMatch(/The Lost Peak/);
    expect(txt.toLowerCase()).toMatch(/symbol|compass/i);
    expect(txt).toMatch(/Negative:/);
  });

  it('defaultThirdZones divides width evenly', () => {
    const { backZone, spineZone, frontZone } = defaultThirdZones(900, 1200);
    expect(backZone.width).toBe(300);
    expect(spineZone.x).toBe(300);
    expect(frontZone.x).toBe(600);
  });
});
