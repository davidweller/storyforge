import { create } from 'zustand';
import type {
  Project,
  ProjectDocument,
  Chapter,
  ChapterVersion,
  EditorialIssue,
  RevisionTask,
  WorkflowStage,
} from '@/types';
import * as firestore from '@/lib/firebase/firestore';

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
  loading: boolean;
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
  
  // Stage progression
  advanceStage: (projectId: string, newStage: WorkflowStage) => Promise<void>;
  
  // Utilities
  clearError: () => void;
  clearCurrentProject: () => void;
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
  error: null,

  loadUserProjects: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const projects = await firestore.getUserProjects(userId);
      set({ projects, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load projects',
        loading: false,
      });
    }
  },

  loadProject: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      const [project, documents, chapters] = await Promise.all([
        firestore.getProject(projectId),
        firestore.getProjectDocuments(projectId),
        firestore.getProjectChapters(projectId),
      ]);
      
      if (!project) {
        throw new Error('Project not found');
      }
      
      set({
        currentProject: project,
        documents,
        chapters,
        loading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load project',
        loading: false,
      });
    }
  },

  createProject: async (userId: string, data) => {
    set({ loading: true, error: null });
    try {
      const projectId = await firestore.createProject(userId, data);
      const project = await firestore.getProject(projectId);
      if (project) {
        set((state) => ({
          projects: [project, ...state.projects],
          currentProject: project,
          loading: false,
        }));
      }
      return projectId;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create project',
        loading: false,
      });
      throw error;
    }
  },

  updateProject: async (projectId: string, data) => {
    set({ loading: true, error: null });
    try {
      await firestore.updateProject(projectId, data);
      const updatedProject = await firestore.getProject(projectId);
      set((state) => ({
        currentProject: updatedProject,
        projects: state.projects.map((p) =>
          p.id === projectId ? { ...p, ...data } : p
        ),
        loading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update project',
        loading: false,
      });
    }
  },

  deleteProject: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      await firestore.deleteProjectData(projectId);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== projectId),
        currentProject: state.currentProject?.id === projectId ? null : state.currentProject,
        loading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete project',
        loading: false,
      });
    }
  },

  createDocument: async (data) => {
    set({ loading: true, error: null });
    try {
      const documentId = await firestore.createDocument(data);
      const document = await firestore.getDocument(documentId);
      if (document) {
        set((state) => ({
          documents: [...state.documents, document],
          loading: false,
        }));
      }
      return documentId;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create document',
        loading: false,
      });
      throw error;
    }
  },

  updateDocument: async (documentId: string, data) => {
    set({ loading: true, error: null });
    try {
      await firestore.updateDocument(documentId, data);
      set((state) => ({
        documents: state.documents.map((d) =>
          d.id === documentId ? { ...d, ...data } : d
        ),
        loading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update document',
        loading: false,
      });
    }
  },

  approveDocument: async (documentId: string) => {
    const { updateDocument } = get();
    await updateDocument(documentId, { approved: true });
  },

  createChapter: async (data) => {
    set({ loading: true, error: null });
    try {
      const chapterId = await firestore.createChapter(data);
      const chapter = await firestore.getChapter(chapterId);
      if (chapter) {
        set((state) => ({
          chapters: [...state.chapters, chapter].sort((a, b) => a.chapterNumber - b.chapterNumber),
          loading: false,
        }));
      }
      return chapterId;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create chapter',
        loading: false,
      });
      throw error;
    }
  },

  updateChapter: async (chapterId: string, data) => {
    set({ loading: true, error: null });
    try {
      await firestore.updateChapter(chapterId, data);
      set((state) => ({
        chapters: state.chapters.map((c) =>
          c.id === chapterId ? { ...c, ...data } : c
        ),
        loading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update chapter',
        loading: false,
      });
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
    set({ loading: true, error: null });
    try {
      const versionId = await firestore.createChapterVersion(data);
      // Reload versions for this chapter
      const { loadChapterVersions } = get();
      await loadChapterVersions(data.chapterId);
      set({ loading: false });
      return versionId;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create chapter version',
        loading: false,
      });
      throw error;
    }
  },

  approveChapterVersion: async (versionId: string) => {
    set({ loading: true, error: null });
    try {
      await firestore.updateChapterVersion(versionId, { approved: true });
      set((state) => {
        const newVersions = new Map(state.chapterVersions);
        for (const [chapterId, versions] of newVersions) {
          const updated = versions.map((v) =>
            v.id === versionId ? { ...v, approved: true } : v
          );
          newVersions.set(chapterId, updated);
        }
        return { chapterVersions: newVersions, loading: false };
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to approve chapter version',
        loading: false,
      });
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
    set({ loading: true, error: null });
    try {
      const issueId = await firestore.createEditorialIssue(data);
      const { loadEditorialIssues } = get();
      await loadEditorialIssues(data.projectId);
      set({ loading: false });
      return issueId;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create editorial issue',
        loading: false,
      });
      throw error;
    }
  },

  resolveEditorialIssue: async (issueId: string) => {
    set({ loading: true, error: null });
    try {
      await firestore.updateEditorialIssue(issueId, { status: 'resolved' });
      set((state) => ({
        editorialIssues: state.editorialIssues.map((i) =>
          i.id === issueId ? { ...i, status: 'resolved' as const } : i
        ),
        loading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to resolve editorial issue',
        loading: false,
      });
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
    set({ loading: true, error: null });
    try {
      const taskId = await firestore.createRevisionTask(data);
      const { loadRevisionTasks } = get();
      await loadRevisionTasks(data.projectId);
      set({ loading: false });
      return taskId;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create revision task',
        loading: false,
      });
      throw error;
    }
  },

  updateRevisionTask: async (taskId: string, data) => {
    set({ loading: true, error: null });
    try {
      await firestore.updateRevisionTask(taskId, data);
      set((state) => ({
        revisionTasks: state.revisionTasks.map((t) =>
          t.id === taskId ? { ...t, ...data } : t
        ),
        loading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update revision task',
        loading: false,
      });
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
