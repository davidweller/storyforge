'use client';

import { useEffect, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type { WorkflowStage, ProjectFormData, DocumentType } from '@/types';

const LOCAL_USER_ID = 'local';

export function useProjects() {
  const { projects, loading, error, loadUserProjects, clearError } = useProjectStore();

  useEffect(() => {
    loadUserProjects(LOCAL_USER_ID);
  }, [loadUserProjects]);

  return {
    projects,
    loading,
    error,
    clearError,
    refresh: () => loadUserProjects(LOCAL_USER_ID),
  };
}

export function useProject(projectId: string | null) {
  const {
    currentProject,
    documents,
    chapters,
    chapterVersions,
    editorialIssues,
    revisionTasks,
    loading,
    error,
    loadProject,
    updateProject,
    advanceStage,
    createDocument,
    updateDocument,
    approveDocument,
    clearError,
    clearCurrentProject,
  } = useProjectStore();
  
  useEffect(() => {
    if (projectId) {
      loadProject(projectId);
    }
    return () => {
      clearCurrentProject();
    };
  }, [projectId, loadProject, clearCurrentProject]);
  
  const getDocumentByType = useCallback((type: DocumentType) => {
    return documents.find((d) => d.type === type && d.approved);
  }, [documents]);
  
  const getLatestDocumentByType = useCallback((type: DocumentType) => {
    const docs = documents.filter((d) => d.type === type);
    if (docs.length === 0) return undefined;
    return docs.sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0];
  }, [documents]);
  
  const getChapterVersions = useCallback((chapterId: string) => {
    return chapterVersions.get(chapterId) || [];
  }, [chapterVersions]);
  
  const getLatestChapterVersion = useCallback((chapterId: string) => {
    const versions = getChapterVersions(chapterId);
    return versions[0]; // Already sorted by version desc
  }, [getChapterVersions]);
  
  const getApprovedChapterVersion = useCallback((chapterId: string) => {
    const versions = getChapterVersions(chapterId);
    return versions.find((v) => v.approved);
  }, [getChapterVersions]);
  
  const getTotalWordCount = useCallback(() => {
    let total = 0;
    for (const chapter of chapters) {
      const approved = getApprovedChapterVersion(chapter.id);
      if (approved) {
        total += approved.wordCount;
      }
    }
    return total;
  }, [chapters, getApprovedChapterVersion]);
  
  const getApprovedChaptersCount = useCallback(() => {
    let count = 0;
    for (const chapter of chapters) {
      const approved = getApprovedChapterVersion(chapter.id);
      if (approved) {
        count++;
      }
    }
    return count;
  }, [chapters, getApprovedChapterVersion]);
  
  const getOpenIssuesCount = useCallback(() => {
    return editorialIssues.filter((i) => i.status === 'open').length;
  }, [editorialIssues]);
  
  const getPendingRevisionTasksCount = useCallback(() => {
    return revisionTasks.filter((t) => t.status !== 'done').length;
  }, [revisionTasks]);
  
  return {
    project: currentProject,
    documents,
    chapters,
    chapterVersions,
    editorialIssues,
    revisionTasks,
    loading,
    error,
    updateProject: (data: Partial<{ title: string; genre: string; niche?: string; premise?: string; research?: string; blurb?: string; amazonDescription?: string; fullAutoMode?: boolean }>) =>
      currentProject && updateProject(currentProject.id, data),
    createDocument,
    updateDocument,
    approveDocument,
    advanceStage: (newStage: WorkflowStage) => 
      currentProject && advanceStage(currentProject.id, newStage),
    getDocumentByType,
    getLatestDocumentByType,
    getChapterVersions,
    getLatestChapterVersion,
    getApprovedChapterVersion,
    getTotalWordCount,
    getApprovedChaptersCount,
    getOpenIssuesCount,
    getPendingRevisionTasksCount,
    clearError,
    refresh: () => projectId && loadProject(projectId),
  };
}

export function useCreateProject() {
  const { createProject, loading, error, clearError } = useProjectStore();

  const create = async (data: ProjectFormData) => {
    return createProject(LOCAL_USER_ID, {
      ...data,
      status: 'active',
      currentStage: 'setup',
      fourPassEditorial: true,
    });
  };

  return {
    createProject: create,
    loading,
    error,
    clearError,
  };
}
