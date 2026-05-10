'use client';

import { Fragment, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { STAGE_NAMES, STAGE_ORDER, getStageIndex, getStageStatus } from '@/lib/utils';
import {
  EDITORIAL_PASSES,
  EDITORIAL_PASS_LABELS,
  approvedEditorialDocForPass,
  passRevisionTasksAllDone,
  canStartEditorialPass,
} from '@/lib/editorial/passes';
import type { WorkflowStage, StageStatus, Chapter, RevisionTask, ProjectDocument } from '@/types';
import type { SectionId } from './WorkflowRail';

interface WorkflowSidebarProps {
  projectId: string;
  projectTitle?: string;  // Optional - may not be set until title stage selection
  genre?: string;         // Used as fallback display when title is missing
  niche?: string;         // Additional context for display
  currentStage: WorkflowStage;
  chapters?: Chapter[];
  approvedChapterIds?: Set<string>;
  revisionTasks?: RevisionTask[];  // Optional - for checking revision completion
  documents?: ProjectDocument[];  // Status for per-pass Review links under Editorial Analysis
  fourPassEditorial?: boolean;     // Affects revision / export-final sidebar status
  finalExportedAt?: Date;  // Optional - timestamp when final export was completed
  blurbFilled?: boolean;  // When true, show Blurb tab as green (generated)
  amazonDescriptionFilled?: boolean;  // When true, show Amazon Description tab as green (generated)
  approvedCoverImageId?: string | null;
  approvedBackCoverImageId?: string | null;
  approvedAPlusModuleId?: string | null;
  /** Which section's items to render. When omitted, falls back to 'planning'. */
  activeSection?: SectionId;
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
  'title': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h2l2 2h4a2 2 0 012 2v2a2 2 0 01-2 2h-2l-2 2z" />
    </svg>
  ),
  'chapter-outlines': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  'chapter-summary': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h8M6 10h12M6 14h8M6 18h10" />
    </svg>
  ),
  'chapter-scene-plan': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16v12H4V6zm4 4h8m-8 4h5" />
    </svg>
  ),
  'chapter-scenes-prose': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  'chapter-polish': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  ),
  'chapter-scene-eval': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5 6a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'story-bible': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  'creative-brief': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8M8 11h8M8 15h5M5 4h14v16H5z" />
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
  'editorial-issues': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  ),
  'revision': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  'revision-verify': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
  'blurb': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  ),
  'amazon-description': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  'cover-brief': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  'back-cover-brief': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12M8 12h8m-8 5h12M4 5h2v14H4V5z" />
    </svg>
  ),
  'a-plus-brief': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h12M4 17h16" />
    </svg>
  ),
};

const statusColors: Record<StageStatus, string> = {
  locked: 'text-[var(--status-locked)] bg-muted cursor-not-allowed opacity-60',
  not_started: 'text-muted-foreground bg-muted hover:bg-secondary',
  in_progress: 'text-[var(--status-in-progress)] bg-[color-mix(in_srgb,var(--status-in-progress)_15%,transparent)]',
  approved: 'text-[var(--status-approved)] bg-[color-mix(in_srgb,var(--status-approved)_15%,transparent)]',
};

const statusIndicators: Record<StageStatus, React.ReactNode> = {
  locked: (
    <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
    </svg>
  ),
  not_started: null,
  in_progress: (
    <span className="w-2 h-2 rounded-full bg-[var(--status-in-progress)] animate-pulse shrink-0" />
  ),
  approved: (
    <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  ),
};

const marketingApprovedClass = 'text-[var(--status-approved)] bg-[color-mix(in_srgb,var(--status-approved)_15%,transparent)]';
const marketingCheck = (
  <svg className="w-3 h-3 shrink-0 text-[var(--status-approved)]" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

export function WorkflowSidebar({
  projectId,
  projectTitle,
  genre,
  niche,
  currentStage,
  chapters = [],
  approvedChapterIds = new Set(),
  revisionTasks = [],
  documents = [],
  fourPassEditorial = false,
  finalExportedAt,
  blurbFilled = false,
  amazonDescriptionFilled = false,
  approvedCoverImageId,
  approvedBackCoverImageId,
  approvedAPlusModuleId,
  activeSection = 'planning',
}: WorkflowSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isChaptersExpanded, setIsChaptersExpanded] = useState(false);
  const [isEditorialPassesExpanded, setIsEditorialPassesExpanded] = useState(false);
  const [isRevisionPassesExpanded, setIsRevisionPassesExpanded] = useState(false);
  const [isAPlusExpanded, setIsAPlusExpanded] = useState(true);

  // Display title or fallback to genre-based name
  const displayTitle = projectTitle || (genre ? `${genre} Project` : 'Untitled Project');

  const aPlusUnlocked = Boolean(approvedCoverImageId) && Boolean(approvedBackCoverImageId);

  // Group stages: planning (0-6), writing (7-8), editing (9+)
  const planningStages = STAGE_ORDER.slice(0, 7); // setup through title
  const writingStages = STAGE_ORDER.slice(7, 9); // chapter-outlines, chapters
  const editingStages = STAGE_ORDER.slice(9); // compilation, export-draft, editorial, revision, export-final

  const showPassSubnav =
    getStageIndex(currentStage) >= getStageIndex('editorial') && chapters.length > 0;
  
  const getStageItemClass = (status: StageStatus, isActive: boolean) =>
    cn(
      'flex items-center gap-3 px-3 py-2 rounded-lg transition-all no-underline',
      isActive
        ? 'bg-accent/[0.08] text-foreground font-medium ring-1 ring-accent/20'
        : statusColors[status]
    );

  const getApprovedStub = (chapterId: string) =>
    approvedChapterIds.has(chapterId) ? { content: '' } : undefined;

  const renderStageItem = (stage: WorkflowStage) => {
    const status = getStageStatus(
      stage,
      currentStage,
      chapters,
      approvedChapterIds,
      revisionTasks,
      finalExportedAt,
      fourPassEditorial
    );
    const isActive =
      stage === 'editorial'
        ? pathname.includes('/stage/editorial')
        : stage === 'revision'
          ? pathname.includes('/stage/revision')
          : pathname.includes(`/stage/${stage}`);
    const isLocked = status === 'locked';
    const isChaptersStage = stage === 'chapters';
    const hasChapters = chapters.length > 0 && getStageIndex(currentStage) >= getStageIndex('chapters');

    const editorialHref =
      stage === 'editorial' && !isLocked
        ? `/projects/${projectId}/stage/editorial?pass=structural`
        : `/projects/${projectId}/stage/${stage}`;
    const revisionHref =
      stage === 'revision' && !isLocked
        ? `/projects/${projectId}/stage/revision?pass=structural`
        : `/projects/${projectId}/stage/${stage}`;
    const stageHref =
      stage === 'editorial' ? editorialHref : stage === 'revision' ? revisionHref : `/projects/${projectId}/stage/${stage}`;

    // Special handling for chapters stage - make it collapsible
    if (isChaptersStage && hasChapters) {
      return (
        <div key={stage} className="relative">
          <Link
            href={isLocked ? '#' : `/projects/${projectId}/stage/${stage}`}
            className={getStageItemClass(status, isActive)}
            onClick={(e) => isLocked && e.preventDefault()}
          >
            <span className="shrink-0">{stageIcons[stage]}</span>
            <span className="flex-1 text-sm font-medium truncate">
              {STAGE_NAMES[stage]}
            </span>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsChaptersExpanded(!isChaptersExpanded);
              }}
              className="shrink-0 ml-1 p-1 flex items-center justify-center bg-transparent border-none cursor-pointer"
              title={isChaptersExpanded ? 'Collapse chapters' : 'Expand chapters'}
            >
              <svg
                className={cn('w-3.5 h-3.5 transition-transform duration-200', !isChaptersExpanded && '-rotate-90')}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {statusIndicators[status]}
          </Link>
        </div>
      );
    }

    const isEditorialWithPassNav = stage === 'editorial' && showPassSubnav;
    const isRevisionWithPassNav = stage === 'revision' && showPassSubnav;

    if (isEditorialWithPassNav) {
      return (
        <div key={stage} className="relative">
          <Link
            href={isLocked ? '#' : stageHref}
            className={getStageItemClass(status, isActive)}
            onClick={(e) => isLocked && e.preventDefault()}
          >
            <span className="shrink-0">{stageIcons[stage]}</span>
            <span className="flex-1 text-sm font-medium truncate">
              {STAGE_NAMES[stage]}
            </span>
            <button
              type="button"
              aria-expanded={isEditorialPassesExpanded}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsEditorialPassesExpanded(!isEditorialPassesExpanded);
              }}
              className="shrink-0 ml-1 p-1 flex items-center justify-center bg-transparent border-none cursor-pointer"
              title={isEditorialPassesExpanded ? 'Collapse editorial passes' : 'Expand editorial passes'}
            >
              <svg
                className={cn('w-3.5 h-3.5 transition-transform duration-200', !isEditorialPassesExpanded && '-rotate-90')}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {statusIndicators[status]}
          </Link>
        </div>
      );
    }

    if (isRevisionWithPassNav) {
      return (
        <div key={stage} className="relative">
          <Link
            href={isLocked ? '#' : stageHref}
            className={getStageItemClass(status, isActive)}
            onClick={(e) => isLocked && e.preventDefault()}
          >
            <span className="shrink-0">{stageIcons[stage]}</span>
            <span className="flex-1 text-sm font-medium truncate">
              {STAGE_NAMES[stage]}
            </span>
            <button
              type="button"
              aria-expanded={isRevisionPassesExpanded}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsRevisionPassesExpanded(!isRevisionPassesExpanded);
              }}
              className="shrink-0 ml-1 p-1 flex items-center justify-center bg-transparent border-none cursor-pointer"
              title={isRevisionPassesExpanded ? 'Collapse revision passes' : 'Expand revision passes'}
            >
              <svg
                className={cn('w-3.5 h-3.5 transition-transform duration-200', !isRevisionPassesExpanded && '-rotate-90')}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {statusIndicators[status]}
          </Link>
        </div>
      );
    }

    return (
      <Link
        key={stage}
        href={isLocked ? '#' : stageHref}
        className={getStageItemClass(status, isActive)}
        onClick={(e) => isLocked && e.preventDefault()}
      >
        <span className="shrink-0">{stageIcons[stage]}</span>
        <span className="flex-1 text-sm font-medium truncate">
          {STAGE_NAMES[stage]}
        </span>
        {statusIndicators[status]}
      </Link>
    );
  };
  
  return (
    <aside className="w-[var(--workflow-sidebar-inner-width)] h-full bg-card border-r border-border flex flex-col overflow-hidden shrink-0">
      {/* Header */}
      <div className="p-5 border-b border-border">
        <Link
          href="/projects"
          className="text-xs text-muted-foreground flex items-center gap-1 mb-2 no-underline hover:opacity-80 transition-opacity"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Projects
        </Link>
        <h2 className="font-semibold text-foreground truncate" title={displayTitle}>
          {displayTitle}
        </h2>
        {!projectTitle && genre && (
          <p className="text-xs text-muted-foreground mt-1">
            {niche || genre}
          </p>
        )}
      </div>

      {/* Stages */}
      <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {activeSection === 'planning' && (
          <div className="flex flex-col gap-1">
            {planningStages.map(renderStageItem)}
          </div>
        )}

        {activeSection === 'writing' && (
          <div>
            <div className="flex flex-col gap-1">
              {writingStages.map(renderStageItem)}
            </div>

            {/* Chapters list (nested under Writing) */}
            {chapters.length > 0 && getStageIndex(currentStage) >= getStageIndex('chapters') && isChaptersExpanded && (
              <div className="mt-2 ml-4 pl-3 border-l border-border">
                {chapters.map((chapter) => {
                  const isApproved = approvedChapterIds.has(chapter.id);
                  const isActive = pathname.includes(`/chapter/${chapter.id}`);

                  return (
                    <Link
                      key={chapter.id}
                      href={`/projects/${projectId}/chapter/${chapter.id}`}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded text-sm no-underline transition-colors',
                        isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'
                      )}
                    >
                      <span className="truncate">Ch. {chapter.chapterNumber}</span>
                      {isApproved && (
                        <svg className="w-3 h-3 text-[var(--status-approved)] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeSection === 'editing' && (
          <div className="flex flex-col gap-1">
            {editingStages.map((stage) => (
              <Fragment key={stage}>
                {renderStageItem(stage)}
                {stage === 'editorial' && showPassSubnav && isEditorialPassesExpanded && (
                  <div className="ml-4 pl-3 border-l border-border space-y-2 pb-1">
                    {EDITORIAL_PASSES.map((pass) => {
                      const canReview = canStartEditorialPass(
                        pass,
                        chapters,
                        getApprovedStub,
                        revisionTasks
                      );
                      const reviewDone = approvedEditorialDocForPass(documents, pass);
                      const passParam = searchParams.get('pass');
                      const reviewActive = pathname.includes('/stage/editorial') && passParam === pass;

                      return (
                        <div key={pass} className="text-xs">
                          <p className="text-muted-foreground/70 font-medium px-2 mb-0.5">
                            {EDITORIAL_PASS_LABELS[pass]}
                          </p>
                          <div className="pl-1">
                            <Link
                              href={canReview ? `/projects/${projectId}/stage/editorial?pass=${pass}` : '#'}
                              onClick={(e) => !canReview && e.preventDefault()}
                              className={cn(
                                'flex items-center gap-1.5 px-2 py-1 rounded no-underline',
                                !canReview && 'opacity-50 cursor-not-allowed pointer-events-none',
                                reviewActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50',
                                reviewDone && 'text-[var(--status-approved)]'
                              )}
                            >
                              {reviewDone && statusIndicators.approved}
                              <span>Review</span>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {stage === 'revision' && showPassSubnav && isRevisionPassesExpanded && (
                  <div className="ml-4 pl-3 border-l border-border space-y-2 pb-1">
                    {EDITORIAL_PASSES.map((pass) => {
                      const revDone = passRevisionTasksAllDone(revisionTasks, pass);
                      const hasRevTasks = revisionTasks.some((t) => t.editPass === pass);
                      const passParam = searchParams.get('pass');
                      const revActive = pathname.includes('/stage/revision') && passParam === pass;

                      return (
                        <div key={pass} className="text-xs">
                          <p className="text-muted-foreground/70 font-medium px-2 mb-0.5">
                            {EDITORIAL_PASS_LABELS[pass]}
                          </p>
                          <div className="pl-1">
                            <Link
                              href={hasRevTasks ? `/projects/${projectId}/stage/revision?pass=${pass}` : '#'}
                              onClick={(e) => !hasRevTasks && e.preventDefault()}
                              className={cn(
                                'flex items-center gap-1.5 px-2 py-1 rounded no-underline',
                                !hasRevTasks && 'opacity-50 cursor-not-allowed pointer-events-none',
                                revActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50',
                                revDone && hasRevTasks && 'text-[var(--status-approved)]'
                              )}
                            >
                              {revDone && hasRevTasks && statusIndicators.approved}
                              <span>Revisions</span>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        )}

        {activeSection === 'marketing' && (
          <div className="flex flex-col gap-1">
            {(['amazon-description', 'blurb'] as const).map((mktStage) => {
              const isFilled = mktStage === 'blurb' ? blurbFilled : amazonDescriptionFilled;
              const isActive = pathname.includes(`/marketing/${mktStage}`);
              return (
                <Link
                  key={mktStage}
                  href={`/projects/${projectId}/marketing/${mktStage}`}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg no-underline text-sm transition-all',
                    isFilled
                      ? marketingApprovedClass
                      : isActive
                        ? 'bg-accent/[0.08] text-foreground font-medium ring-1 ring-accent/20'
                        : 'text-muted-foreground hover:bg-muted/60'
                  )}
                >
                  {mktStage === 'amazon-description' ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                  )}
                  {mktStage === 'amazon-description' ? 'Amazon Description' : 'Blurb for back of book'}
                  {isFilled && marketingCheck}
                </Link>
              );
            })}
          </div>
        )}

        {activeSection === 'cover' && (
          <div className="ml-4 pl-3 border-l border-border space-y-2 pb-1">
            <Link
              href={`/projects/${projectId}/cover/front/archetype`}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded no-underline text-sm transition-colors',
                pathname.includes('/cover/front/archetype')
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50'
              )}
            >
              <span className="shrink-0 w-4 h-4 flex items-center justify-center [&>svg]:w-3.5 [&>svg]:h-3.5">
                {stageIcons['cover-brief']}
              </span>
              <span className="flex-1 truncate">Design</span>
            </Link>
            <Link
              href={`/projects/${projectId}/cover/front/archetype`}
              className="flex items-center gap-1.5 px-2 py-1 rounded no-underline text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <span className="shrink-0 w-4 h-4 flex items-center justify-center [&>svg]:w-3.5 [&>svg]:h-3.5">
                {stageIcons['cover-brief']}
              </span>
              <span className="flex-1 truncate">Review & Export</span>
            </Link>
            <Link
              href={`/projects/${projectId}/cover/paperback/full-wrap`}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded no-underline text-sm transition-colors',
                pathname.includes('/cover/paperback/full-wrap')
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50'
              )}
            >
              <span className="shrink-0 w-4 h-4 flex items-center justify-center [&>svg]:w-3.5 [&>svg]:h-3.5">
                {stageIcons['back-cover-brief']}
              </span>
              <span className="flex-1 truncate">Advanced Wrap</span>
            </Link>
          </div>
        )}

        {activeSection === 'aplus' && (
          <div className="ml-4 pl-3 border-l border-border space-y-2 pb-1">
            <div className="text-xs">
              <button
                type="button"
                aria-expanded={isAPlusExpanded}
                onClick={() => setIsAPlusExpanded(!isAPlusExpanded)}
                className="w-full flex items-center gap-1.5 px-2 mb-0.5 bg-transparent border-none cursor-pointer text-muted-foreground/70 font-medium"
                title={isAPlusExpanded ? 'Collapse A+ content' : 'Expand A+ content'}
              >
                <span className="flex-1 text-left">A+ modules</span>
                <svg
                  className={cn('w-3.5 h-3.5 transition-transform duration-200', !isAPlusExpanded && '-rotate-90')}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isAPlusExpanded && (
                <div className="pl-1 flex flex-col gap-1">
                  {(
                    [
                      ['setup', 'Setup'],
                      ['brief', 'Prompt brief'],
                      ['generate', 'Generate'],
                      ['refine', 'Refine'],
                      ['export', 'Export'],
                    ] as const
                  ).map(([slug, label]) => {
                    const href = aPlusUnlocked ? `/projects/${projectId}/aplus/${slug}` : '#';
                    const active = pathname.includes(`/aplus/${slug}`);
                    return (
                      <Link
                        key={slug}
                        href={href}
                        title={!aPlusUnlocked ? 'Approve front and back cover first' : undefined}
                        onClick={(e) => !aPlusUnlocked && e.preventDefault()}
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1 rounded no-underline text-sm transition-colors',
                          !aPlusUnlocked && 'opacity-50 cursor-not-allowed',
                          active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50',
                          slug === 'export' && approvedAPlusModuleId && 'text-[var(--status-approved)]'
                        )}
                      >
                        <span className="shrink-0 w-4 h-4 flex items-center justify-center [&>svg]:w-3.5 [&>svg]:h-3.5">
                          {stageIcons['a-plus-brief']}
                        </span>
                        <span className="flex-1 truncate">{label}</span>
                        {slug === 'export' && approvedAPlusModuleId && marketingCheck}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Footer with project link */}
      <div className="p-4 border-t border-border">
        <Link
          href={`/projects/${projectId}`}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm no-underline transition-colors',
            pathname === `/projects/${projectId}` ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted'
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
