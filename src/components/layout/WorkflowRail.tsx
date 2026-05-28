'use client';

import { cn } from '@/lib/utils';

export type SectionId =
  | 'planning'
  | 'writing'
  | 'editing'
  | 'marketing'
  | 'cover'
  | 'aplus'
  | 'serialisation';

interface WorkflowRailProps {
  activeSection: SectionId;
  onSelect: (id: SectionId) => void;
  coverCanonUnlocked: boolean;
  paperbackUnlocked: boolean;
  aPlusUnlocked: boolean;
  serialisationUnlocked?: boolean;
  serialisationEnabled?: boolean;
  sectionStatus?: Partial<Record<SectionId, 'in_progress' | 'approved'>>;
}

interface SectionDef {
  id: SectionId;
  label: string;
  icon: React.ReactNode;
}

const SECTIONS: SectionDef[] = [
  {
    id: 'planning',
    label: 'Planning',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 21h6m-3-3v3m-6.364-7.364A7 7 0 1118.364 6.636a7 7 0 01-2.83 9.546L14 17.5h-4l-1.535-1.318a7 7 0 01-2.829-2.546z" />
      </svg>
    ),
  },
  {
    id: 'writing',
    label: 'Writing',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    id: 'editing',
    label: 'Editing',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    ),
  },
  {
    id: 'cover',
    label: 'Cover',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'aplus',
    label: 'A+ Content',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    id: 'serialisation',
    label: 'Serialisation',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
];

const lockIcon = (
  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
      clipRule="evenodd"
    />
  </svg>
);

const inProgressDot = (
  <span className="w-2 h-2 rounded-full bg-[var(--status-in-progress)] animate-pulse shrink-0" />
);

const approvedCheck = (
  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

export function WorkflowRail({
  activeSection,
  onSelect,
  coverCanonUnlocked,
  paperbackUnlocked,
  aPlusUnlocked,
  serialisationUnlocked = false,
  serialisationEnabled = true,
  sectionStatus = {},
}: WorkflowRailProps) {
  const isLocked = (id: SectionId): { locked: boolean; reason?: string } => {
    if (id === 'cover') {
      if (!coverCanonUnlocked) return { locked: true, reason: 'Create a Story Bible or Creative Brief first.' };
      return { locked: false };
    }
    if (id === 'aplus') {
      if (!coverCanonUnlocked) return { locked: true, reason: 'Create a Story Bible or Creative Brief first.' };
      if (!paperbackUnlocked) return { locked: true, reason: 'Approve the front cover first.' };
      if (!aPlusUnlocked) return { locked: true, reason: 'Approve the back cover first.' };
      return { locked: false };
    }
    if (id === 'serialisation') {
      if (!serialisationUnlocked) {
        return { locked: true, reason: 'Complete Export Final first.' };
      }
      return { locked: false };
    }
    return { locked: false };
  };

  return (
    <aside
      className="w-[var(--workflow-rail-width)] h-full bg-card border-r border-border flex flex-col shrink-0 overflow-hidden"
      aria-label="Workflow sections"
    >
      <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
        {SECTIONS.filter((section) => serialisationEnabled || section.id !== 'serialisation').map((section) => {
          const { locked, reason } = isLocked(section.id);
          const isActive = activeSection === section.id;
          const status = sectionStatus[section.id];

          return (
            <button
              key={section.id}
              type="button"
              disabled={locked}
              title={locked ? reason : undefined}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => {
                if (!locked) onSelect(section.id);
              }}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left bg-transparent border-none cursor-pointer',
                isActive
                  ? 'bg-accent/[0.08] text-foreground font-medium ring-1 ring-accent/20'
                  : locked
                    ? 'text-[var(--status-locked)] bg-muted cursor-not-allowed opacity-60'
                    : 'text-muted-foreground hover:bg-secondary'
              )}
            >
              <span className="shrink-0">{section.icon}</span>
              <span className="flex-1 text-sm font-medium truncate">{section.label}</span>
              {locked
                ? lockIcon
                : status === 'approved'
                  ? approvedCheck
                  : status === 'in_progress'
                    ? inProgressDot
                    : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
