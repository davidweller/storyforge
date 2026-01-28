'use client';

import { useState, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ContextDrawerProps {
  children: ReactNode;
  defaultOpen?: boolean;
}

export function ContextDrawer({ children, defaultOpen = true }: ContextDrawerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'fixed right-0 top-1/2 -translate-y-1/2 z-20',
          'w-6 h-16 bg-[var(--card)] border border-r-0 border-[var(--border)] rounded-l-lg',
          'flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
          'transition-all duration-300',
          isOpen && 'right-[var(--context-drawer-width)]'
        )}
        aria-label={isOpen ? 'Close context panel' : 'Open context panel'}
      >
        <svg
          className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      
      {/* Drawer */}
      <aside
        className={cn(
          'fixed right-0 top-0 h-screen w-[var(--context-drawer-width)]',
          'bg-[var(--card)] border-l border-[var(--border)]',
          'transform transition-transform duration-300 ease-in-out',
          'overflow-y-auto z-10',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {children}
      </aside>
    </>
  );
}

interface ContextSectionProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export function ContextSection({ title, children, defaultExpanded = true }: ContextSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  return (
    <div className="border-b border-[var(--border)]">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--muted)] transition-colors"
      >
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
        <svg
          className={cn('w-4 h-4 text-[var(--muted-foreground)] transition-transform', isExpanded && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}
