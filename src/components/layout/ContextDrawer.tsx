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
    <div style={{ borderBottom: '1px solid #e5e5e5' }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem',
          textAlign: 'left',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#171717' }}>{title}</h3>
        <svg
          style={{ 
            width: '1rem', 
            height: '1rem', 
            color: '#737373',
            transition: 'transform 0.2s',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <div style={{ padding: '0 1.25rem 1.25rem' }}>
          {children}
        </div>
      )}
    </div>
  );
}
