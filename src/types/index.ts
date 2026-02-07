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
  | 'revision'        // Stage 12
  | 'export-final'    // Stage 13
  | 'blurb'           // Marketing: back-cover blurb
  | 'amazon-description';  // Marketing: Amazon product description

export type StageStatus = 'locked' | 'not_started' | 'in_progress' | 'approved';

export type DocumentType = 
  | 'genre'
  | 'niche'
  | 'ending'
  | 'characters'
  | 'structure'
  | 'chapter-outlines'
  | 'editorial';

export type EditorialCategory = 
  | 'continuity'
  | 'character'
  | 'pacing'
  | 'prose'
  | 'logic';

export type RevisionTaskStatus = 'queued' | 'in_progress' | 'done';

// Firebase Document Types
export interface Project {
  id: string;
  userId: string;
  title?: string;  // Optional - deferred until after ending stage
  genre: string;
  niche?: string;  // Selected niche/subgenre
  microniche?: string;  // Selected microniche (optional)
  premise?: string;
  research?: string;
  status: 'active' | 'completed' | 'archived';
  currentStage: WorkflowStage;
  finalExportedAt?: Date;  // Timestamp when final export was completed
  blurb?: string;          // Back-cover / marketing blurb
  amazonDescription?: string;  // Amazon product description
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  type: DocumentType;
  content: string;
  version: number;
  approved: boolean;
  createdAt: Date;
  updatedAt: Date;
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
}

export interface RevisionTask {
  id: string;
  projectId: string;
  chapterNumber: number;
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
  model: 'openai' | 'claude';
  status: StageStatus;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// API Response Types
export interface GenerationResponse {
  content: string;
  model: string;
  tokensUsed: number;
}

export interface EndingOption {
  id: string;
  title: string;
  summary: string;
}

// Form Types
export interface ProjectFormData {
  title?: string;  // Optional - deferred until after ending stage
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
