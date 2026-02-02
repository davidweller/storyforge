'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { STAGE_NAMES, STAGE_ORDER, getStageIndex, isStageAccessible } from '@/lib/utils';
import type { WorkflowStage, StageStatus, Chapter, RevisionTask } from '@/types';

interface WorkflowSidebarProps {
  projectId: string;
  projectTitle?: string;  // Optional - may not be set until after ending stage
  genre?: string;         // Used as fallback display when title is missing
  niche?: string;         // Additional context for display
  currentStage: WorkflowStage;
  chapters?: Chapter[];
  approvedChapterIds?: Set<string>;
  revisionTasks?: RevisionTask[];  // Optional - for checking revision completion
  finalExportedAt?: Date;  // Optional - timestamp when final export was completed
}

const stageIcons: Record<WorkflowStage, React.ReactNode> = {
  'setup': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  ),
  'genre-research': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  'niche': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  'ending': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'characters': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  'structure': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  ),
  'chapter-outlines': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  'chapters': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  'compilation': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  'editorial': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  ),
  'revision': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  'export-draft': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  'export-final': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

function getStageStatus(
  stage: WorkflowStage, 
  currentStage: WorkflowStage, 
  chapters?: Chapter[], 
  approvedChapterIds?: Set<string>,
  revisionTasks?: RevisionTask[],
  finalExportedAt?: Date
): StageStatus {
  const stageIndex = getStageIndex(stage);
  const currentIndex = getStageIndex(currentStage);
  
  if (stageIndex < currentIndex) return 'approved';
  if (stageIndex === currentIndex) {
    // Special case: mark revision as approved if all revision tasks are done
    if (stage === 'revision' && revisionTasks && revisionTasks.length > 0) {
      const allComplete = revisionTasks.every(task => task.status === 'done');
      if (allComplete) return 'approved';
    }
    // Special case: mark export-final as approved if it has been exported
    if (stage === 'export-final' && finalExportedAt) {
      return 'approved';
    }
    return 'in_progress';
  }
  
  // Special case: allow access to compilation if all chapters are approved, even if currentStage is 'chapters'
  if (stage === 'compilation' && currentStage === 'chapters' && chapters && approvedChapterIds) {
    const allApproved = chapters.length > 0 && chapters.every(ch => approvedChapterIds.has(ch.id));
    if (allApproved) return 'not_started';
  }
  
  // Special case: allow access to export-final if all revision tasks are done, even if currentStage is 'revision'
  if (stage === 'export-final' && currentStage === 'revision' && revisionTasks && revisionTasks.length > 0) {
    const allComplete = revisionTasks.every(task => task.status === 'done');
    if (allComplete) return 'not_started';
  }
  
  if (isStageAccessible(currentStage, stage)) return 'not_started';
  return 'locked';
}

const statusColors: Record<StageStatus, string> = {
  locked: 'text-[var(--status-locked)] bg-[var(--muted)]',
  not_started: 'text-[var(--status-not-started)] bg-[var(--muted)]',
  in_progress: 'text-[var(--status-in-progress)] bg-[rgba(212,160,58,0.15)]',
  approved: 'text-[var(--status-approved)] bg-[rgba(92,124,92,0.15)]',
};

const statusIndicators: Record<StageStatus, React.ReactNode> = {
  locked: (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
    </svg>
  ),
  not_started: null,
  in_progress: (
    <span className="w-2 h-2 rounded-full bg-[var(--status-in-progress)] animate-pulse" />
  ),
  approved: (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  ),
};

export function WorkflowSidebar({
  projectId,
  projectTitle,
  genre,
  niche,
  currentStage,
  chapters = [],
  approvedChapterIds = new Set(),
  revisionTasks = [],
  finalExportedAt,
}: WorkflowSidebarProps) {
  const pathname = usePathname();
  
  // Display title or fallback to genre-based name
  const displayTitle = projectTitle || (genre ? `${genre} Project` : 'Untitled Project');
  
  // Group stages: planning (0-5), writing (6-7), editing (8+)
  const planningStages = STAGE_ORDER.slice(0, 6);
  const writingStages = STAGE_ORDER.slice(6, 8); // chapter-outlines, chapters
  const editingStages = STAGE_ORDER.slice(8); // compilation, export-draft, editorial, revision, export-final
  
  const getStatusStyle = (status: StageStatus, isActive: boolean) => {
    const baseStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.5rem 0.75rem',
      borderRadius: '8px',
      transition: 'all 0.2s',
      textDecoration: 'none',
    };
    
    const statusStyles: Record<StageStatus, React.CSSProperties> = {
      locked: { color: '#a3a3a3', backgroundColor: '#f5f5f5', cursor: 'not-allowed', opacity: 0.6 },
      not_started: { color: '#737373', backgroundColor: '#f5f5f5' },
      in_progress: { color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.15)' },
      approved: { color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.15)' },
    };
    
    return {
      ...baseStyle,
      ...statusStyles[status],
      ...(isActive ? { outline: '2px solid #3b82f6', outlineOffset: '2px' } : {}),
    };
  };
  
  const renderStageItem = (stage: WorkflowStage) => {
    const status = getStageStatus(stage, currentStage, chapters, approvedChapterIds, revisionTasks, finalExportedAt);
    const isActive = pathname.includes(`/stage/${stage}`);
    const isLocked = status === 'locked';
    
    return (
      <Link
        key={stage}
        href={isLocked ? '#' : `/projects/${projectId}/stage/${stage}`}
        style={getStatusStyle(status, isActive)}
        onClick={(e) => isLocked && e.preventDefault()}
      >
        <span style={{ flexShrink: 0 }}>{stageIcons[stage]}</span>
        <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {STAGE_NAMES[stage]}
        </span>
        {statusIndicators[status]}
      </Link>
    );
  };
  
  return (
    <aside style={{
      width: '280px',
      height: '100vh',
      backgroundColor: '#ffffff',
      borderRight: '1px solid #e5e5e5',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    }}>
      {/* Header */}
      <div style={{ padding: '1.25rem', borderBottom: '1px solid #e5e5e5' }}>
        <Link 
          href="/projects"
          style={{ 
            fontSize: '0.75rem', 
            color: '#737373', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.25rem', 
            marginBottom: '0.5rem',
            textDecoration: 'none',
          }}
        >
          <svg style={{ width: '0.75rem', height: '0.75rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Projects
        </Link>
        <h2 style={{ fontWeight: 600, color: '#171717', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={displayTitle}>
          {displayTitle}
        </h2>
        {!projectTitle && genre && (
          <p style={{ fontSize: '0.75rem', color: '#a3a3a3', marginTop: '0.25rem' }}>
            {niche || genre}
          </p>
        )}
      </div>
      
      {/* Stages */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Planning */}
        <div>
          <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', padding: '0 0.75rem' }}>
            Planning
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {planningStages.map(renderStageItem)}
          </div>
        </div>
        
        {/* Writing */}
        <div>
          <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', padding: '0 0.75rem' }}>
            Writing
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {writingStages.map(renderStageItem)}
          </div>
          
          {/* Chapters list (nested under Writing) */}
          {chapters.length > 0 && getStageIndex(currentStage) >= getStageIndex('chapters') && (
            <div style={{ marginTop: '0.5rem', marginLeft: '1rem', paddingLeft: '0.75rem', borderLeft: '1px solid #e5e5e5' }}>
              {chapters.map((chapter) => {
                const isApproved = approvedChapterIds.has(chapter.id);
                const isActive = pathname.includes(`/chapter/${chapter.id}`);
                
                return (
                  <Link
                    key={chapter.id}
                    href={`/projects/${projectId}/chapter/${chapter.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.375rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      textDecoration: 'none',
                      backgroundColor: isActive ? '#f5f5f5' : 'transparent',
                      color: isActive ? '#171717' : '#737373',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Ch. {chapter.chapterNumber}</span>
                    {isApproved && (
                      <svg style={{ width: '0.75rem', height: '0.75rem', color: '#10b981', flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Editing */}
        <div>
          <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', padding: '0 0.75rem' }}>
            Editing
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {editingStages.map(renderStageItem)}
          </div>
        </div>
      </nav>
      
      {/* Footer with project link */}
      <div style={{ padding: '1rem', borderTop: '1px solid #e5e5e5' }}>
        <Link
          href={`/projects/${projectId}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            fontSize: '0.875rem',
            textDecoration: 'none',
            backgroundColor: pathname === `/projects/${projectId}` ? '#f5f5f5' : 'transparent',
            color: pathname === `/projects/${projectId}` ? '#171717' : '#737373',
          }}
        >
          <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Project Dashboard
        </Link>
      </div>
    </aside>
  );
}
