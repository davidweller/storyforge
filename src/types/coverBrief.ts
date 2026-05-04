/** v1 flat brief (legacy). */
export interface CoverBriefDocumentLegacy {
  schemaVersion: 1;
  generatedAt: string;
  derivedFrom: CoverBriefDerivedFrom;
  recommendedArchetypes: Array<{
    archetypeId: string;
    rationale: string;
  }>;
  paletteDirection: string;
  visualElements: string[];
  visualAvoid: string[];
  typographyDirection: string;
  moodKeywords: string[];
  coverComps: string[];
}

export interface CoverBriefDerivedFrom {
  storyBibleDocumentId: string;
  creativeBriefDocumentId: string | null;
  titleApprovedAt: string;
}

export interface CoverBriefLayerBackground {
  description: string;
  paletteDirection: string;
  lightingNotes: string;
}

export interface CoverBriefLayerSymbol {
  description: string;
  placement: string;
  detailNotes: string;
}

export interface CoverBriefLayerObject {
  description: string;
  placement: string;
}

export interface CoverBriefLayerProtagonist {
  description: string;
  pose: string;
  emotionalState: string;
}

export interface CoverBriefLayerProtagonistB {
  description: string;
  pose: string;
}

export interface CoverBriefLayerLandscape {
  description: string;
  scaleNotes: string;
}

export interface CoverBriefLayerForeground {
  description: string;
}

export interface CoverBriefLayerMysteriousSubject {
  description: string;
  revealLevel: string;
}

export interface CoverBriefLayerFocalElement {
  description: string;
  illustrationStyle: string;
}

export interface CoverBriefLayerAction {
  description: string;
  motionDirection: string;
}

export interface CoverBriefLayerText {
  titleText: string;
  authorText: string;
  seriesText: string | null;
  typographyDirection: string;
  textPlacement: string;
}

export interface CoverBriefLayers {
  background: CoverBriefLayerBackground;
  symbol?: CoverBriefLayerSymbol;
  object?: CoverBriefLayerObject;
  protagonist?: CoverBriefLayerProtagonist;
  protagonistB?: CoverBriefLayerProtagonistB;
  landscape?: CoverBriefLayerLandscape;
  foregroundElement?: CoverBriefLayerForeground;
  mysteriousSubject?: CoverBriefLayerMysteriousSubject;
  focalElement?: CoverBriefLayerFocalElement;
  action?: CoverBriefLayerAction;
  text: CoverBriefLayerText;
}

/** v2 per-archetype layered brief (spec Section 4.2). */
export interface CoverBriefDocumentV2 {
  schemaVersion: 2;
  generatedAt: string;
  /** A1–A7, R1–R6 */
  archetypeId: string;
  derivedFrom: CoverBriefDerivedFrom;
  layers: CoverBriefLayers;
  moodKeywords: string[];
  visualAvoid: string[];
  coverComps: string[];
  resolvedPrompt: string;
  promptOverridden: boolean;
}

export type CoverBriefDocument = CoverBriefDocumentLegacy | CoverBriefDocumentV2;

export function isCoverBriefV2(b: CoverBriefDocument): b is CoverBriefDocumentV2 {
  return b.schemaVersion === 2;
}

/** Back cover brief layers (spec Section 5.5 / Stage F). */
export interface BackCoverBriefLayers {
  background: {
    description: string;
    styleNotes: string;
  };
  blurbTextArea: {
    blurbText: string;
    placement: string;
    typographyTreatment: string;
    contrastNotes: string;
  };
  authorBioArea?: {
    bioText: string;
    placement: string;
    photoPlaceholderNotes: string;
  };
  publisherLogoArea?: {
    placement: string;
    sizingNotes: string;
  };
  barcodeArea: {
    placement: string;
    sizeNotes: string;
  };
}

export interface BackCoverBriefDocumentLegacy {
  schemaVersion: 1;
  derivedFrom: {
    coverBriefDocumentId: string;
    approvedCoverImageId: string;
  };
  backgroundStyle: string;
  moodContinuity: string;
  avoidElements: string[];
  compositionNotes: string;
  approvedAt: string | null;
}

export interface BackCoverBriefDocumentV2 {
  schemaVersion: 2;
  coverSide: 'back';
  derivedFrom: {
    coverBriefDocumentId: string;
    approvedCoverImageId: string;
  };
  layers: BackCoverBriefLayers;
  moodKeywords: string[];
  visualAvoid: string[];
  resolvedPrompt: string;
  promptOverridden: boolean;
  approvedAt: string | null;
}

export type BackCoverBriefDocument = BackCoverBriefDocumentLegacy | BackCoverBriefDocumentV2;

export function isBackCoverBriefV2(b: BackCoverBriefDocument): b is BackCoverBriefDocumentV2 {
  return b.schemaVersion === 2;
}

export interface CoverFullWrapDocument {
  schemaVersion: 1;
  generatedAt: string;
  frontCoverImageId: string;
  backCoverImageId: string;
  spineConfig: {
    titleText: string;
    authorText: string;
    seriesText: string | null;
    backgroundColour: string;
    textColour: string;
    logoImageData: string | null;
  };
  templateSource: {
    uploadedAt: string;
    detectedDimensions: {
      canvasWidth: number;
      canvasHeight: number;
      frontZone: { x: number; y: number; width: number; height: number };
      backZone: { x: number; y: number; width: number; height: number };
      spineZone: { x: number; y: number; width: number; height: number };
      bleedPx: number;
    };
    dimensionsUserConfirmed: boolean;
  };
  exportedAt: string | null;
  exportFilename: string | null;
}
