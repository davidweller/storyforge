'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ContentDisplayProps {
  content: string;
  isEditing?: boolean;
  onContentChange?: (content: string) => void;
  className?: string;
}

export function ContentDisplay({
  content,
  isEditing = false,
  onContentChange,
  className,
}: ContentDisplayProps) {
  if (isEditing && onContentChange) {
    return (
      <textarea
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        className={cn(
          'w-full min-h-[500px] p-6 lg:p-8 bg-[var(--card)] border border-[var(--border)] rounded-lg',
          'text-[var(--foreground)] font-[inherit] text-base leading-relaxed',
          'focus:border-[var(--ring)] focus:outline-none resize-y',
          className
        )}
      />
    );
  }
  
  return (
    <div
      className={cn(
        'prose prose-lg max-w-none',
        'bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 lg:p-8',
        className
      )}
    >
      <div 
        className="text-[var(--foreground)] whitespace-pre-wrap"
        dangerouslySetInnerHTML={{ __html: formatMarkdown(content) }}
      />
    </div>
  );
}

// Simple markdown formatter
function formatMarkdown(text: string): string {
  return text
    // Headers
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-6 mb-3 text-[var(--foreground)]">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-8 mb-4 text-[var(--foreground)]">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-4 text-[var(--foreground)]">$1</h1>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Lists
    .replace(/^\- (.*$)/gim, '<li class="ml-4">$1</li>')
    .replace(/^\d+\. (.*$)/gim, '<li class="ml-4 list-decimal">$1</li>')
    // Line breaks
    .replace(/\n\n/g, '</p><p class="mb-4">')
    .replace(/\n/g, '<br />');
}

interface LoadingContentProps {
  message?: string;
}

export function LoadingContent({ message = 'Generating content...' }: LoadingContentProps) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-12 lg:p-16">
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
        <p className="text-[var(--muted-foreground)]">{message}</p>
        <p className="text-sm text-[var(--muted-foreground)]">This may take a minute...</p>
      </div>
    </div>
  );
}

interface EmptyContentProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  isLoading?: boolean;
}

export function EmptyContent({
  title,
  description,
  actionLabel,
  onAction,
  isLoading = false,
}: EmptyContentProps) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-12 lg:p-16 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--muted)] rounded-full mb-4">
        <svg className="w-8 h-8 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">{title}</h3>
      <p className="text-[var(--muted-foreground)] mb-6 max-w-md mx-auto">{description}</p>
      <button
        onClick={onAction}
        disabled={isLoading}
        className={cn(
          'inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all',
          'bg-[var(--primary)] text-[var(--primary-foreground)]',
          'hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {actionLabel}
          </>
        )}
      </button>
    </div>
  );
}
