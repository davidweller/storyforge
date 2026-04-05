import { create } from 'zustand';
import type {
  Project,
  ProjectDocument,
  Chapter,
  ChapterVersion,
  EditorialIssue,
  RevisionTask,
  WorkflowStage,
  EditorialPass,
} from '@/types';
import * as firestore from '@/lib/db/client';

/** Fine-grained loading keys so UI components can show targeted spinners
 *  without a single global flag blocking unrelated parts of the UI. */
export type LoadingOp =
  | 'projects'
  | 'project'
  | 'createProject'
  | 'updateProject'
  | 'deleteProject'
  | 'document'
  | 'chapter'
  | 'chapterVersion'
  | 'editorial'
  | 'revision';

interface ProjectState {
  // Current project data
  currentProject: Project | null;
  documents: ProjectDocument[];
  chapters: Chapter[];
  chapterVersions: Map<string, ChapterVersion[]>;
  editorialIssues: EditorialIssue[];
  revisionTasks: RevisionTask[];
  
  // User's projects list
  projects: Project[];
  
  // Loading states
  /** @deprecated Use loadingOps.has(op) for targeted loading checks */
  loading: boolean;
  /** Set of in-progress operation keys — prefer this over the single `loading` flag */
  loadingOps: Set<LoadingOp>;
  error: string | null;
  
  // Actions
  loadUserProjects: (userId: string) => Promise<void>;
  loadProject: (projectId: string) => Promise<void>;
  createProject: (userId: string, data: Omit<Project, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateProject: (projectId: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  
  // Document actions
  createDocument: (data: Omit<ProjectDocument, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateDocument: (documentId: string, data: Partial<ProjectDocument>) => Promise<void>;
  approveDocument: (documentId: string) => Promise<void>;
  
  // Chapter actions
  createChapter: (data: Omit<Chapter, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateChapter: (chapterId: string, data: Partial<Chapter>) => Promise<void>;
  loadChapterVersions: (chapterId: string) => Promise<void>;
  
  // Chapter version actions
  createChapterVersion: (data: Omit<ChapterVersion, 'id' | 'createdAt'>) => Promise<string>;
  approveChapterVersion: (versionId: string) => Promise<void>;
  
  // Editorial actions
  loadEditorialIssues: (projectId: string) => Promise<void>;
  createEditorialIssue: (data: Omit<EditorialIssue, 'id' | 'createdAt'>) => Promise<string>;
  resolveEditorialIssue: (issueId: string) => Promise<void>;
  
  // Revision actions
  loadRevisionTasks: (projectId: string) => Promise<void>;
  createRevisionTask: (data: Omit<RevisionTask, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateRevisionTask: (taskId: string, data: Partial<RevisionTask>) => Promise<void>;
  deleteRevisionTasksForProjectAndPass: (projectId: string, pass: EditorialPass) => Promise<void>;
  
  // Stage progression
  advanceStage: (projectId: string, newStage: WorkflowStage) => Promise<void>;
  
  // Utilities
  clearError: () => void;
  clearCurrentProject: () => void;
}

/** Helper to add/remove an op from the loadingOps Set immutably. */
function setOp(op: LoadingOp, active: boolean) {
  return (state: { loadingOps: Set<LoadingOp> }) => {
    const next = new Set(state.loadingOps);
    if (active) {
      next.add(op);
    } else {
      next.delete(op);
    }
    return { loadingOps: next, loading: next.size > 0 };
  };
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  documents: [],
  chapters: [],
  chapterVersions: new Map(),
  editorialIssues: [],
  revisionTasks: [],
  projects: [],
  loading: false,
  loadingOps: new Set(),
  error: null,

  loadUserProjects: async (userId: string) => {
    set(setOp('projects', true));
    set({ error: null });
    try {
      const projects = await firestore.getUserProjects(userId);
      set({ projects });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load projects' });
    } finally {
      set(setOp('projects', false));
    }
  },

  loadProject: async (projectId: string) => {
    set(setOp('project', true));
    set({ error: null });
    try {
      const [project, documents, chapters, approvedVersions, revisionTasks] = await Promise.all([
        firestore.getProject(projectId),
        firestore.getProjectDocuments(projectId),
        firestore.getProjectChapters(projectId),
        firestore.getApprovedChapterVersions(projectId),
        firestore.getProjectRevisionTasks(projectId),
      ]);
      if (!project) throw new Error('Project not found');
      const chapterVersions = new Map<string, ChapterVersion[]>();
      for (const version of approvedVersions) {
        const existing = chapterVersions.get(version.chapterId) ?? [];
        existing.push(version);
        chapterVersions.set(version.chapterId, existing);
      }
      for (const [chapterId, versions] of chapterVersions) {
        versions.sort((a, b) => b.version - a.version);
        chapterVersions.set(chapterId, versions);
      }
      set({ currentProject: project, documents, chapters, chapterVersions, revisionTasks });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load project' });
    } finally {
      set(setOp('project', false));
    }
  },

  createProject: async (userId: string, data) => {
    set(setOp('createProject', true));
    set({ error: null });
    try {
      const projectId = await firestore.createProject(userId, data);
      // Construct from known fields — avoids a round-trip read after write
      const now = new Date();
      const project: Project = {
        id: projectId,
        userId,
        ...data,
        createdAt: now,
        updatedAt: now,
      };
      set((state) => ({ projects: [project, ...state.projects], currentProject: project }));
      return projectId;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create project' });
      throw error;
    } finally {
      set(setOp('createProject', false));
    }
  },

  updateProject: async (projectId: string, data) => {
    set(setOp('updateProject', true));
    set({ error: null });
    try {
      await firestore.updateProject(projectId, data);
      // Apply the delta locally — avoids a round-trip read after write
      set((state) => {
        const currentProject = state.currentProject?.id === projectId
          ? { ...state.currentProject, ...data, updatedAt: new Date() }
          : state.currentProject;
        const projects = state.projects.map((p) =>
          p.id === projectId ? { ...p, ...data, updatedAt: new Date() } : p
        );
        return { currentProject, projects };
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update project' });
    } finally {
      set(setOp('updateProject', false));
    }
  },

  deleteProject: async (projectId: string) => {
    set(setOp('deleteProject', true));
    set({ error: null });
    try {
      await firestore.deleteProjectData(projectId);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== projectId),
        currentProject: state.currentProject?.id === projectId ? null : state.currentProject,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete project' });
    } finally {
      set(setOp('deleteProject', false));
    }
  },

  createDocument: async (data) => {
    set(setOp('document', true));
    set({ error: null });
    try {
      const documentId = await firestore.createDocument(data);
      const now = new Date();
      const document: ProjectDocument = { id: documentId, ...data, createdAt: now, updatedAt: now };
      set((state) => ({ documents: [...state.documents, document] }));
      return documentId;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create document' });
      throw error;
    } finally {
      set(setOp('document', false));
    }
  },

  updateDocument: async (documentId: string, data) => {
    set(setOp('document', true));
    set({ error: null });
    try {
      await firestore.updateDocument(documentId, data);
      set((state) => ({
        documents: state.documents.map((d) => d.id === documentId ? { ...d, ...data } : d),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update document' });
    } finally {
      set(setOp('document', false));
    }
  },

  approveDocument: async (documentId: string) => {
    const { updateDocument } = get();
    await updateDocument(documentId, { approved: true });
  },

  createChapter: async (data) => {
    set(setOp('chapter', true));
    set({ error: null });
    try {
      const chapterId = await firestore.createChapter(data);
      const now = new Date();
      const chapter: Chapter = { id: chapterId, ...data, createdAt: now, updatedAt: now };
      set((state) => ({
        chapters: [...state.chapters, chapter].sort((a, b) => a.chapterNumber - b.chapterNumber),
      }));
      return chapterId;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create chapter' });
      throw error;
    } finally {
      set(setOp('chapter', false));
    }
  },

  updateChapter: async (chapterId: string, data) => {
    set(setOp('chapter', true));
    set({ error: null });
    try {
      await firestore.updateChapter(chapterId, data);
      set((state) => ({
        chapters: state.chapters.map((c) => c.id === chapterId ? { ...c, ...data } : c),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update chapter' });
    } finally {
      set(setOp('chapter', false));
    }
  },

  loadChapterVersions: async (chapterId: string) => {
    try {
      const versions = await firestore.getChapterVersions(chapterId);
      set((state) => {
        const newVersions = new Map(state.chapterVersions);
        newVersions.set(chapterId, versions);
        return { chapterVersions: newVersions };
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load chapter versions',
      });
    }
  },

  createChapterVersion: async (data) => {
    set(setOp('chapterVersion', true));
    set({ error: null });
    try {
      const versionId = await firestore.createChapterVersion(data);
      const { loadChapterVersions } = get();
      await loadChapterVersions(data.chapterId);
      return versionId;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create chapter version' });
      throw error;
    } finally {
      set(setOp('chapterVersion', false));
    }
  },

  approveChapterVersion: async (versionId: string) => {
    set(setOp('chapterVersion', true));
    set({ error: null });
    try {
      await firestore.updateChapterVersion(versionId, { approved: true });
      set((state) => {
        const newVersions = new Map(state.chapterVersions);
        for (const [chapterId, versions] of newVersions) {
          newVersions.set(chapterId, versions.map((v) => v.id === versionId ? { ...v, approved: true } : v));
        }
        return { chapterVersions: newVersions };
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to approve chapter version' });
    } finally {
      set(setOp('chapterVersion', false));
    }
  },

  loadEditorialIssues: async (projectId: string) => {
    try {
      const issues = await firestore.getProjectEditorialIssues(projectId);
      set({ editorialIssues: issues });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load editorial issues',
      });
    }
  },

  createEditorialIssue: async (data) => {
    set(setOp('editorial', true));
    set({ error: null });
    try {
      const issueId = await firestore.createEditorialIssue(data);
      const { loadEditorialIssues } = get();
      await loadEditorialIssues(data.projectId);
      return issueId;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create editorial issue' });
      throw error;
    } finally {
      set(setOp('editorial', false));
    }
  },

  resolveEditorialIssue: async (issueId: string) => {
    set(setOp('editorial', true));
    set({ error: null });
    try {
      await firestore.updateEditorialIssue(issueId, { status: 'resolved' });
      set((state) => ({
        editorialIssues: state.editorialIssues.map((i) =>
          i.id === issueId ? { ...i, status: 'resolved' as const } : i
        ),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to resolve editorial issue' });
    } finally {
      set(setOp('editorial', false));
    }
  },

  loadRevisionTasks: async (projectId: string) => {
    try {
      const tasks = await firestore.getProjectRevisionTasks(projectId);
      set({ revisionTasks: tasks });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load revision tasks',
      });
    }
  },

  createRevisionTask: async (data) => {
    set(setOp('revision', true));
    set({ error: null });
    try {
      const taskId = await firestore.createRevisionTask(data);
      const { loadRevisionTasks } = get();
      await loadRevisionTasks(data.projectId);
      return taskId;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create revision task' });
      throw error;
    } finally {
      set(setOp('revision', false));
    }
  },

  updateRevisionTask: async (taskId: string, data) => {
    set(setOp('revision', true));
    set({ error: null });
    try {
      await firestore.updateRevisionTask(taskId, data);
      set((state) => ({
        revisionTasks: state.revisionTasks.map((t) => t.id === taskId ? { ...t, ...data } : t),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update revision task' });
    } finally {
      set(setOp('revision', false));
    }
  },

  deleteRevisionTasksForProjectAndPass: async (projectId: string, pass: EditorialPass) => {
    set(setOp('revision', true));
    set({ error: null });
    try {
      await firestore.deleteRevisionTasksForProjectAndPass(projectId, pass);
      const { loadRevisionTasks } = get();
      await loadRevisionTasks(projectId);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete revision tasks' });
      throw error;
    } finally {
      set(setOp('revision', false));
    }
  },

  advanceStage: async (projectId: string, newStage: WorkflowStage) => {
    const { updateProject } = get();
    await updateProject(projectId, { currentStage: newStage });
  },

  clearError: () => set({ error: null }),
  
  clearCurrentProject: () => set({
    currentProject: null,
    documents: [],
    chapters: [],
    chapterVersions: new Map(),
    editorialIssues: [],
    revisionTasks: [],
  }),
}));
