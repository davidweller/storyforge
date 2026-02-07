'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ProjectDocument } from '@/types';

const REFERENCE_ITEMS = [
  { type: 'genre' as const, label: 'Market Analysis', stageId: 'genre-research' },
  { type: 'niche' as const, label: 'Reader Targeting', stageId: 'niche' },
  { type: 'structure' as const, label: 'Plot Blueprint', stageId: 'structure' },
] as const;

const blockStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e5e5',
  borderRadius: '12px',
  boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  padding: '1.5rem',
  color: '#171717',
  fontFamily: 'inherit',
  fontSize: '0.9375rem',
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap' as const,
  maxHeight: '200px',
  overflowY: 'auto',
};

interface MarketingReferenceSectionProps {
  projectId: string;
  getDocumentByType: (type: string) => ProjectDocument | undefined;
}

export function MarketingReferenceSection({ projectId, getDocumentByType }: MarketingReferenceSectionProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    'genre': true,
    'niche': true,
    'structure': true,
  });

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      <h2
        style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          color: '#171717',
          marginBottom: '0.75rem',
        }}
      >
        Reference
      </h2>
      <p style={{ fontSize: '0.875rem', color: '#737373', marginBottom: '1rem' }}>
        Use your Market Analysis, Reader Targeting, and Plot Blueprint below while writing your marketing copy.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {REFERENCE_ITEMS.map(({ type, label, stageId }) => {
          const doc = getDocumentByType(type);
          const content = doc?.content?.trim();
          const isExpanded = expanded[type];

          return (
            <div
              key={type}
              style={{
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: '#fafafa',
              }}
            >
              <button
                type="button"
                onClick={() => toggle(type)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#171717',
                  textAlign: 'left',
                }}
              >
                {label}
                <svg
                  style={{
                    width: '1rem',
                    height: '1rem',
                    flexShrink: 0,
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
                <div style={{ padding: '0 1rem 1rem' }}>
                  {content ? (
                    <div style={blockStyle}>{content}</div>
                  ) : (
                    <p style={{ fontSize: '0.875rem', color: '#737373', margin: 0 }}>
                      Complete the{' '}
                      <Link
                        href={`/projects/${projectId}/stage/${stageId}`}
                        style={{ color: '#3b82f6', textDecoration: 'underline' }}
                      >
                        {label}
                      </Link>{' '}
                      stage to use it as reference here.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
