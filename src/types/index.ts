// Core Types for StoryForge

export type WorkflowStage = 
  | 'setup'           // Stage 0
  | 'genre-research'  // Stage 1
  | 'niche'           // Stage 2
  | 'ending'          // Stage 3
  | 'characters'      // Stage 4
  | 'structure'       // Stage 5
  | 'title'           // Stage 6
  | 'chapter-outlines' // Stage 7
  | 'chapters'        // Stage 8
  | 'compilation'     // Stage 9
  | 'export-draft'    // Stage 10
  | 'editorial'       // Stage 11
  | 'editorial-issues' // Structured editorial: emits revision-queue JSON from manuscript directly
  | 'revision'        // Stage 12
  | 'export-final'    // Stage 13
  | 'chapter-summary' // Internal helper stage for chapter context summaries
  | 'chapter-scene-plan' // Phase 4: structured scene cards for a chapter
  | 'chapter-scenes-prose' // Phase 4: prose for one scene (structured output)
  | 'chapter-polish' // Phase 4: polish pass over concatenated scenes
  | 'chapter-scene-eval' // Phase 4: model rubric evaluation JSON
  | 'story-bible'     // Internal canon generation stage
  | 'creative-brief'  // Internal compact canon brief generation stage
  | 'blurb'           // Marketing: back-cover blurb
  | 'amazon-description'  // Marketing: Amazon product description
  | 'a-plus-brief'    // A+ content prompt brief (JSON)
  | 'revision-verify' // Post-revision checklist (structured JSON)
  | 'cover-brief'     // Structured cover direction (JSON)
  | 'back-cover-brief'; // Back-panel visual brief (JSON)

export type StageStatus = 'locked' | 'not_started' | 'in_progress' | 'approved';

export type DocumentType = 
  | 'genre'
  | 'niche'
  | 'ending'
  | 'ending-choice'  // User-selected ending option (saved separately from the ending blueprint)
  | 'characters'
  | 'structure'
  | 'chapter-outlines'
  | 'chapter-scene-plan'
  | 'story-bible'
  | 'creative-brief'
  | 'editorial' // legacy single editorial report (treated as structural pass)
  | 'editorial-structural'
  | 'editorial-line'
  | 'editorial-copy'
  | 'editorial-proofread'
  | 'editorial-final'
  | 'cover-brief'
  | 'cover-image'
  | 'back-cover-brief'
  | 'cover-full-wrap'
  | 'a-plus-brief'
  | 'a-plus-module'
  | 'a-plus-export';

/** Ordered editorial pipeline passes (structural → line → copy → proofread → final_report). */
export type EditorialPass = 'structural' | 'line' | 'copy' | 'proofread' | 'final_report';

export type EditorialCategory = 
  | 'continuity'
  | 'character'
  | 'pacing'
  | 'prose'
  | 'logic';

export type RevisionTaskStatus = 'queued' | 'in_progress' | 'done';

/** User-uploaded competitor / mood reference (stored as JSON array on `Project`). */
export interface ProjectStyleReference {
  mimeType: 'image/png' | 'image/jpeg';
  base64Data: string;
  /** Optional author cue — combined with vision summary for prompts. */
  note?: string;
}

// Firebase Document Types
export interface Project {
  id: string;
  userId: string;
  title?: string;  // Optional until selected in the dedicated title stage
  /** Kindle / print subtitle (often after colon on cover). */
  subtitle?: string;
  /** Very short hook for cover or ads. */
  tagline?: string;
  genre: string;
  niche?: string;  // Selected niche/subgenre
  microniche?: string;  // Selected microniche (optional)
  premise?: string;
  research?: string;
  status: 'active' | 'completed' | 'archived';
  currentStage: WorkflowStage;
  fullAutoMode?: boolean;  // When true, pipeline runs without intervention; cleared on completion
  /** When true, revision/export-final unlock only after final_report pass tasks complete. */
  fourPassEditorial?: boolean;
  finalExportedAt?: Date;  // Timestamp when final export was completed
  blurb?: string;          // Back-cover / marketing blurb
  amazonDescription?: string;  // Amazon product description
  /** Display / cover credit name (optional). */
  authorName?: string;
  /** Approved front cover raster document id (`cover-image`, surface front). */
  approvedCoverImageId?: string | null;
  /** Approved back panel background document id (`cover-image`, surface back). */
  approvedBackCoverImageId?: string | null;
  coverGenerationStatus?: CoverTrackStatus;
  paperbackGenerationStatus?: CoverTrackStatus;
  aPlusGenerationStatus?: CoverTrackStatus;
  /** Base64 KDP template (PNG/JPEG) for full-wrap compositing. */
  kdpTemplateImageData?: string | null;
  /** Last selected KDP trim size id for cover flow. */
  coverTrimSizeId?: string | null;
  /** Approved A+ module image document id (`a-plus-module`). */
  approvedAPlusModuleId?: string | null;
  /** When true, blurb generation appends approved cover tone context. */
  marketingAlignCoverToneBlurb?: boolean;
  /** When true, Amazon description appends approved cover tone context. */
  marketingAlignCoverToneAmazon?: boolean;
  /** JSON array of ProjectStyleReference (max 5) for cover generation mood. */
  coverStyleReferencesJson?: string | null;
  /** JSON array of ProjectStyleReference (max 5) for A+ setup / generation. */
  aPlusStyleReferencesJson?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CoverTrackStatus = 'not-started' | 'in-progress' | 'complete';

export type CoverJobStatus =
  | 'queued'
  | 'running_front'
  | 'running_back'
  | 'running_wrap'
  | 'finalizing'
  | 'succeeded'
  | 'partially_succeeded'
  | 'failed';

export type CoverSizingSource = 'uploaded-template' | 'trim-size-estimate' | 'fallback-default';

export type {
  CoverBriefDocument,
  CoverBriefDocumentLegacy,
  CoverBriefDocumentV2,
  CoverBriefLayers,
  BackCoverBriefDocument,
  BackCoverBriefDocumentLegacy,
  BackCoverBriefDocumentV2,
  CoverFullWrapDocument,
} from './coverBrief';
export { isCoverBriefV2, isBackCoverBriefV2 } from './coverBrief';
export type {
  APlusModuleType,
  APlusTextMode,
  APlusBriefDocument,
  APlusImagePayload,
  APlusExportDocument,
} from './aplus';

/** JSON stored in document `cover-image` rows (`content`). */
export interface CoverImagePayload {
  schemaVersion: 1;
  runId: string;
  archetypeId: string;
  highClickEnabled: boolean;
  promptUsed: string;
  variantIndex: number;
  parentImageId: string | null;
  refinementRequest: string | null;
  version: number;
  surface: 'front' | 'back';
  status: 'candidate' | 'discarded' | 'approved';
  imageData: string;
  generatedAt: string;
  /** Accumulated refinement lines appended to prompt (restart clears). */
  refinementHistory?: string[];
}

export interface CoverGenerationJobInput {
  archetypeId: string;
  authorName: string;
  trimSizeId: string;
  trimWidthIn: number;
  trimHeightIn: number;
  templateUpload?: {
    mimeType: string;
    base64Data: string;
  };
}

export interface CoverGenerationJobResult {
  frontDocumentId?: string;
  backDocumentId?: string;
  wrapDocumentId?: string;
  resolvedCanvasWidth?: number;
  resolvedCanvasHeight?: number;
  resolvedSizingSource?: CoverSizingSource;
  error?: string;
}

export interface CoverGenerationJob {
  id: string;
  projectId: string;
  status: CoverJobStatus;
  progressStage: string;
  error?: string | null;
  input: CoverGenerationJobInput;
  result?: CoverGenerationJobResult;
  createdAt: Date;
  updatedAt: Date;
}


export interface ProjectDocument {
  id: string;
  projectId: string;
  type: DocumentType;
  /** Set when `type` is chapter-scene-plan: which chapter this plan belongs to. */
  chapterNumber?: number;
  content: string;
  version: number;
  approved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoryBibleSourceRef {
  documentType: DocumentType;
  documentId: string;
  version: number;
  updatedAt: string;
}

export interface StoryBibleDocument {
  schemaVersion: number;
  storyBibleVersion: number;
  generatedAt: string;
  approvedAt: string | null;
  derivedFrom: StoryBibleSourceRef[];
  logline: string;
  genrePromise: string;
  audiencePromise: string;
  voiceAndStyle: {
    pov: string;
    tense: string;
    narrativeDistance: string;
    styleRules: string[];
    avoid: string[];
  };
  themes: string[];
  characters: Array<{
    name: string;
    role: string;
    want: string;
    need: string;
    flaw: string;
    arcPromise: string;
    voiceNotes: string[];
    hardConstraints: string[];
  }>;
  relationships: Array<{
    participants: string[];
    startingState: string;
    targetState: string;
    tension: string;
    constraints: string[];
  }>;
  worldRules: string[];
  timelineFacts: string[];
  unresolvedThreads: Array<{
    thread: string;
    introducedBy: string;
    mustResolveBy: string;
    status: string;
  }>;
  endingPromises: string[];
  forbiddenChanges: string[];
}

export interface CreativeBriefDocument {
  schemaVersion: number;
  creativeBriefVersion: number;
  generatedAt: string;
  derivedFromStoryBible: {
    documentId: string;
    version: number;
    updatedAt: string;
  };
  brief: string;
}

export type ContextPurpose =
  | 'chapter-draft'
  | 'scene-plan'
  | 'chapter-eval'
  | 'chapter-summary'
  | 'chapter-revision'
  | 'editorial'
  | 'chapter-outline'
  | 'title'
  | 'marketing'
  | 'full-auto';

export interface ContextBudget {
  totalTokens: number;
  maxSectionTokens: number;
  sections?: Partial<Record<string, number>>;
}

export interface ContextSection {
  id: string;
  title: string;
  text: string;
  tokenEstimate: number;
  truncated: boolean;
  omitted?: boolean;
}

export interface AssembledContext {
  purpose: ContextPurpose;
  text: string;
  sections: ContextSection[];
  warnings: string[];
  tokenEstimate: number;
}

export interface Chapter {
  id: string;
  projectId: string;
  chapterNumber: number;
  title: string;
  beatReference: string;
  sceneGoal: string;
  pov?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Ordered scene prose segments for Phase 4 pipeline (JSON in DB). */
export interface SceneProseSegment {
  sceneId: string;
  prose: string;
}

export interface ChapterVersion {
  id: string;
  chapterId: string;
  projectId: string;
  chapterNumber: number;
  version: number;
  content: string;
  wordCount: number;
  approved: boolean;
  parentVersionId?: string;
  notes?: string;
  /** Phase 4: structured segments before concatenation into `content`. */
  sceneSegments?: SceneProseSegment[];
  createdAt: Date;
}

export interface EditorialIssue {
  id: string;
  projectId: string;
  chapterNumber?: number;
  locationHint?: string;
  category: EditorialCategory;
  description: string;
  recommendedFix: string;
  status: 'open' | 'resolved';
  createdAt: Date;
  editPass: EditorialPass;
  revisionTaskId?: string;
  manuscriptQuote?: string;
  sceneId?: string;
}

export interface RevisionTask {
  id: string;
  projectId: string;
  chapterNumber: number;
  /** Which editorial pass this task belongs to. */
  editPass: EditorialPass;
  issueIds: string[];
  instructions: string;
  acceptanceCriteria: string[];
  status: RevisionTaskStatus;
  createdAt: Date;
  updatedAt: Date;
}

// UI State Types
export interface StageInfo {
  id: WorkflowStage;
  name: string;
  description: string;
  model: 'openai' | 'claude' | 'openrouter';
  status: StageStatus;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// API Response Types
/** Origin of a logged generation call (for usage aggregation). */
export type GenerationUsageSource =
  | 'manual-stage'
  | 'full-auto'
  | 'chapter-editor'
  | 'editorial'
  | 'revision';

export interface GenerationUsageTotals {
  totalTokens: number;
  callCount: number;
}

export interface GenerationResponse {
  content: string;
  model: string;
  tokensUsed: number;
  /** Non-blocking validations (e.g. output cardinality vs prompt). */
  warnings?: string[];
}

/** Extended response returned by POST /api/generate — includes provider and
 *  optional model-switch metadata (editorial stage auto-fallback). */
export interface GenerateApiResponse extends GenerationResponse {
  provider: string;
  /** Optional low-level provider route (e.g. openrouter-fallback-alibaba-model-studio). */
  providerRoute?: string;
  modelSwitched?: boolean;
  switchMessage?: string;
}

export interface EndingOption {
  id: string;
  title: string;
  summary: string;
}

// Form Types
export interface ProjectFormData {
  title?: string;  // Optional until selected in the dedicated title stage
  genre: string;
  niche?: string;  // Selected niche/subgenre
  microniche?: string;  // Selected microniche (optional)
  premise?: string;
  research?: string;
}

export interface ChapterFormData {
  title: string;
  beatReference: string;
  sceneGoal: string;
  pov?: string;
}
