'use client';

import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
      success: 'bg-[rgba(92,124,92,0.2)] text-[var(--status-approved)]',
      warning: 'bg-[rgba(212,160,58,0.2)] text-[var(--status-in-progress)]',
      error: 'bg-[rgba(139,38,53,0.2)] text-[var(--status-attention)]',
      info: 'bg-[rgba(201,162,39,0.2)] text-[var(--color-gold)]',
    };
    
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
