'use client';

import type { ReviewChecklistItem } from '@/lib/review/checklists';

interface ReviewChecklistProps {
  title?: string;
  items: ReviewChecklistItem[];
  className?: string;
}

export function ReviewChecklist({ title = 'Review before you approve', items, className }: ReviewChecklistProps) {
  if (!items.length) return null;
  return (
    <div
      className={className}
      style={{
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        backgroundColor: 'var(--card)',
        marginBottom: '1rem',
      }}
    >
      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.5rem' }}>
        {title}
      </p>
      <ul style={{ margin: 0, paddingLeft: '1.15rem', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
        {items.map((item) => (
          <li key={item.id} style={{ marginBottom: '0.35rem' }}>
            {item.label}
            {item.detail ? (
              <span style={{ display: 'block', fontSize: '0.75rem', marginTop: '0.15rem', opacity: 0.9 }}>
                {item.detail}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
