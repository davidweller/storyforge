'use client';

import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium mb-3 text-[var(--foreground)]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full h-11 px-4 py-2.5 text-sm border rounded-xl bg-[var(--card)] text-[var(--foreground)] transition-all duration-200',
            'border-[var(--input)] focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-opacity-20',
            'placeholder:text-[var(--muted-foreground)]',
            error && 'border-[var(--destructive)] focus:ring-[var(--destructive)] focus:ring-opacity-20',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-[var(--destructive)]">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
