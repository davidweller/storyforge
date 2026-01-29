'use client';

import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-muted text-muted-foreground',
      success: 'bg-[rgba(34,197,94,0.1)] text-green-600',
      warning: 'bg-[rgba(245,158,11,0.1)] text-amber-600',
      error: 'bg-[rgba(239,68,68,0.1)] text-red-600',
      info: 'bg-[rgba(59,130,246,0.1)] text-blue-600',
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
