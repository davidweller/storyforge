'use client';

import { useState, ReactNode } from 'react';

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
        style={{
          position: 'fixed',
          right: isOpen ? '320px' : 0,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 20,
          width: '24px',
          height: '64px',
          backgroundColor: '#ffffff',
          border: '1px solid #e5e5e5',
          borderRight: 'none',
          borderRadius: '8px 0 0 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#737373',
          cursor: 'pointer',
          transition: 'all 0.3s',
        }}
        aria-label={isOpen ? 'Close context panel' : 'Open context panel'}
      >
        <svg
          style={{ 
            width: '1rem', 
            height: '1rem', 
            transition: 'transform 0.3s',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      
      {/* Drawer */}
      <aside
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          height: '100vh',
          width: '320px',
          backgroundColor: '#ffffff',
          borderLeft: '1px solid #e5e5e5',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease-in-out',
          overflowY: 'auto',
          zIndex: 10,
        }}
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
