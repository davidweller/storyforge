'use client';

import { useState, ReactNode } from 'react';

interface ContextSectionProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export function ContextSection({ title, children, defaultExpanded = true }: ContextSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  return (
    <div className="border-b border-border">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-5 text-left bg-transparent border-none cursor-pointer"
      >
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <div className="px-5 pb-5">
          {children}
        </div>
      )}
    </div>
  );
}
