export type APlusModuleType =
  | 'hero-banner'
  | 'character-spotlight'
  | 'world-spotlight'
  | 'trope-promise'
  | 'series-author-brand'
  | 'quote-review';

export type APlusTextMode = 'none' | 'suggested' | 'custom';

export interface APlusBriefDocument {
  schemaVersion: 1;
  generatedAt: string;
  moduleType: APlusModuleType;
  promptDraft: string;
  suggestedText: string | null;
  compositionNotes: string[];
  negativeConstraints: string[];
}

export interface APlusImagePayload {
  schemaVersion: 1;
  runId: string;
  moduleType: APlusModuleType;
  promptUsed: string;
  promptOverridden: boolean;
  textMode: APlusTextMode;
  customText: string | null;
  suggestedText: string | null;
  variantIndex: number;
  parentImageId: string | null;
  refinementRequest: string | null;
  version: number;
  status: 'candidate' | 'discarded' | 'approved';
  imageData: string;
  generatedAt: string;
  refinementHistory?: string[];
}

export interface APlusExportDocument {
  schemaVersion: 1;
  moduleDocumentId: string;
  moduleType: APlusModuleType;
  filename: string;
  format: 'png';
  exportedAt: string;
}
