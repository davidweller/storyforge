'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ProjectDocument } from '@/types';

const REFERENCE_ITEMS = [
  { type: 'genre' as const, label: 'Market Analysis', stageId: 'genre-research' },
  { type: 'niche' as const, label: 'Reader Targeting', stageId: 'niche' },
  { type: 'characters' as const, label: 'Character Profiles', stageId: 'characters' },
  { type: 'structure' as const, label: 'Plot Blueprint', stageId: 'structure' },
] as const;

const blockClassName =
  'bg-card border border-border rounded-xl shadow-sm p-6 text-foreground font-[inherit] text-[0.9375rem] leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto';

interface MarketingReferenceSectionProps {
  projectId: string;
  getDocumentByType: (type: string) => ProjectDocument | undefined;
}

export function MarketingReferenceSection({ projectId, getDocumentByType }: MarketingReferenceSectionProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    'genre': false,
    'niche': false,
    'characters': true,
    'structure': true,
  });

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-foreground mb-3">
        Reference
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Use your Market Analysis, Reader Targeting, Character Profiles, and Plot Blueprint below while writing your marketing copy.
      </p>
      <div className="flex flex-col gap-3">
        {REFERENCE_ITEMS.map(({ type, label, stageId }) => {
          const doc = getDocumentByType(type);
          const content = doc?.content?.trim();
          const isExpanded = expanded[type];

          return (
            <div
              key={type}
              className="border border-border rounded-lg overflow-hidden bg-background"
            >
              <button
                type="button"
                onClick={() => toggle(type)}
                className="w-full flex items-center justify-between px-4 py-3 bg-transparent border-none cursor-pointer text-sm font-semibold text-foreground text-left"
              >
                {label}
                <svg
                  className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4">
                  {content ? (
                    <div className={blockClassName}>{content}</div>
                  ) : (
                    <p className="text-sm text-muted-foreground m-0">
                      Complete the{' '}
                      <Link
                        href={`/projects/${projectId}/stage/${stageId}`}
                        className="text-[var(--accent)] underline"
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
