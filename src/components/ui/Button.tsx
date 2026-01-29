'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const sizes = {
      sm: 'h-9 px-4 py-2 text-sm',
      md: 'h-10 px-5 py-2.5 text-sm',
      lg: 'h-11 px-6 py-3 text-sm',
    };

    const variants = {
      primary: 'bg-[#171717] text-white shadow-sm hover:bg-[#262626] active:bg-[#0a0a0a] focus-visible:ring-[#171717]',
      secondary: 'bg-white text-[#171717] border border-[#d4d4d4] hover:bg-[#f5f5f5] hover:border-[#a3a3a3] focus-visible:ring-[#171717]',
      ghost: 'text-[#525252] hover:bg-[#f5f5f5] hover:text-[#171717] focus-visible:ring-[#171717]',
      destructive: 'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-600',
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          sizes[size],
          variants[variant],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
