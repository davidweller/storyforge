'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

export type WorkflowSectionNavItem = { href: string; label: string; isActive: boolean };

interface WorkflowSectionNavProps {
  items: WorkflowSectionNavItem[];
  className?: string;
}

/**
 * Shared tab row for Marketing, Cover, and A+ headers (pill underline style).
 */
export function WorkflowSectionNav({ items, className }: WorkflowSectionNavProps) {
  return (
    <nav className={cn('flex flex-wrap gap-2', className)} aria-label="Section steps">
      {items.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={
            n.isActive
              ? cn(
                  'inline-flex rounded-full px-3 py-1.5 text-sm font-semibold',
                  'bg-accent/[0.12] text-foreground ring-1 ring-accent/25 no-underline'
                )
              : cn(
                  'inline-flex rounded-full px-3 py-1.5 text-sm text-muted-foreground',
                  'hover:bg-muted/80 hover:text-foreground no-underline'
                )
          }
        >
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
