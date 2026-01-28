'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { STAGE_NAMES, STAGE_ORDER, getStageIndex, isStageAccessible } from '@/lib/utils';
import type { WorkflowStage, StageStatus, Chapter } from '@/types';

interface WorkflowSidebarProps {
  projectId: string;
  projectTitle: string;
  currentStage: WorkflowStage;
  chapters?: Chapter[];
  approvedChapterIds?: Set<string>;
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
};

function getStageStatus(stage: WorkflowStage, currentStage: WorkflowStage): StageStatus {
  const stageIndex = getStageIndex(stage);
  const currentIndex = getStageIndex(currentStage);
  
  if (stageIndex < currentIndex) return 'approved';
  if (stageIndex === currentIndex) return 'in_progress';
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
  currentStage,
  chapters = [],
  approvedChapterIds = new Set(),
}: WorkflowSidebarProps) {
  const pathname = usePathname();
  
  // Group stages: planning (0-5), writing (6-7), editing (8-9)
  const planningStages = STAGE_ORDER.slice(0, 6);
  const writingStages = STAGE_ORDER.slice(6, 8);
  const editingStages = STAGE_ORDER.slice(8);
  
  const renderStageItem = (stage: WorkflowStage) => {
    const status = getStageStatus(stage, currentStage);
    const isActive = pathname.includes(`/stage/${stage}`);
    const isLocked = status === 'locked';
    
    return (
      <Link
        key={stage}
        href={isLocked ? '#' : `/projects/${projectId}/stage/${stage}`}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200',
          statusColors[status],
          isActive && 'ring-2 ring-[var(--ring)]',
          isLocked && 'cursor-not-allowed opacity-60',
          !isLocked && 'hover:opacity-80'
        )}
        onClick={(e) => isLocked && e.preventDefault()}
      >
        <span className="flex-shrink-0">{stageIcons[stage]}</span>
        <span className="flex-1 text-sm font-medium truncate">{STAGE_NAMES[stage]}</span>
        {statusIndicators[status]}
      </Link>
    );
  };
  
  return (
    <aside className="w-[var(--sidebar-width)] h-screen bg-[var(--card)] border-r border-[var(--border)] border-opacity-30 flex flex-col overflow-hidden shadow-[var(--shadow-sm)]">
      {/* Header */}
      <div className="p-5 border-b border-[var(--border)] border-opacity-30">
        <Link 
          href="/projects"
          className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1 mb-2"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Projects
        </Link>
        <h2 className="font-semibold text-[var(--foreground)] truncate" title={projectTitle}>
          {projectTitle}
        </h2>
      </div>
      
      {/* Stages */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Planning */}
        <div>
          <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2 px-3">
            Planning
          </h3>
          <div className="space-y-1">
            {planningStages.map(renderStageItem)}
          </div>
        </div>
        
        {/* Writing */}
        <div>
          <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2 px-3">
            Writing
          </h3>
          <div className="space-y-1">
            {writingStages.map(renderStageItem)}
          </div>
          
          {/* Chapters list (nested under Writing) */}
          {chapters.length > 0 && getStageIndex(currentStage) >= getStageIndex('chapters') && (
            <div className="mt-2 ml-4 pl-3 border-l border-[var(--border)]">
              {chapters.map((chapter) => {
                const isApproved = approvedChapterIds.has(chapter.id);
                const isActive = pathname.includes(`/chapter/${chapter.id}`);
                
                return (
                  <Link
                    key={chapter.id}
                    href={`/projects/${projectId}/chapter/${chapter.id}`}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors',
                      isActive ? 'bg-[var(--muted)] text-[var(--foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                    )}
                  >
                    <span className="truncate">Ch. {chapter.chapterNumber}</span>
                    {isApproved && (
                      <svg className="w-3 h-3 text-[var(--status-approved)] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
          <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2 px-3">
            Editing
          </h3>
          <div className="space-y-1">
            {editingStages.map(renderStageItem)}
          </div>
        </div>
      </nav>
      
      {/* Footer with project link */}
      <div className="p-4 border-t border-[var(--border)] border-opacity-30">
        <Link
          href={`/projects/${projectId}`}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
            pathname === `/projects/${projectId}` 
              ? 'bg-[var(--muted)] text-[var(--foreground)]' 
              : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]'
          )}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Project Dashboard
        </Link>
      </div>
    </aside>
  );
}
