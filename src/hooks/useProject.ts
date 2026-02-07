'use client';

import { useEffect, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useAuth } from './useAuth';
import type { WorkflowStage, ProjectFormData } from '@/types';

// Bypass auth in development mode
const DEV_MODE_BYPASS_AUTH = process.env.NODE_ENV === 'development';
const DEV_USER_ID = 'dev-user-123';

export function useProjects() {
  const { user } = useAuth();
  const { projects, loading, error, loadUserProjects, clearError } = useProjectStore();
  
  // Use dev user ID in development mode
  const userId = DEV_MODE_BYPASS_AUTH ? DEV_USER_ID : user?.uid;
  
  useEffect(() => {
    if (userId) {
      loadUserProjects(userId);
    }
  }, [userId, loadUserProjects]);
  
  return {
    projects,
    loading,
    error,
    clearError,
    refresh: () => userId && loadUserProjects(userId),
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
  
  const getDocumentByType = useCallback((type: string) => {
    return documents.find((d) => d.type === type && d.approved);
  }, [documents]);
  
  const getLatestDocumentByType = useCallback((type: string) => {
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
  const { user } = useAuth();
  const { createProject, loading, error, clearError } = useProjectStore();
  
  // Use dev user ID in development mode
  const userId = DEV_MODE_BYPASS_AUTH ? DEV_USER_ID : user?.uid;
  
  const create = async (data: ProjectFormData) => {
    // Authentication disabled for testing
    // if (!userId) {
    //   throw new Error('User not authenticated');
    // }
    // Use dev user ID if no userId
    const finalUserId = userId || DEV_USER_ID;
    
    return createProject(finalUserId, {
      ...data,
      status: 'active',
      currentStage: 'setup',
    });
  };
  
  return {
    createProject: create,
    loading,
    error,
    clearError,
  };
}
