'use client';

import { formatMarkdown } from '@/lib/utils/markdown';

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
        className={className}
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        style={{
          width: '100%',
          minHeight: '500px',
          padding: '1.5rem',
          backgroundColor: '#ffffff',
          border: '1px solid #e5e5e5',
          borderRadius: '12px',
          boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
          color: '#171717',
          fontFamily: 'inherit',
          fontSize: '1rem',
          lineHeight: 1.6,
          resize: 'vertical',
          outline: 'none',
        }}
      />
    );
  }
  
  return (
    <div
      className={className}
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e5e5e5',
        borderRadius: '12px',
        boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        padding: '1.5rem',
      }}
    >
      <div
        className="prose-book"
        dangerouslySetInnerHTML={{ __html: formatMarkdown(content) }}
      />
    </div>
  );
}

interface LoadingContentProps {
  message?: string;
}

export function LoadingContent({ message = 'Generating content...' }: LoadingContentProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-12">
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-border border-t-[var(--ring)] animate-spin" />
        <p className="text-muted-foreground">{message}</p>
        <p className="text-sm text-muted-foreground">This may take a minute...</p>
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
  disabled?: boolean;
}

export function EmptyContent({
  title,
  description,
  actionLabel,
  onAction,
  isLoading = false,
  disabled = false,
}: EmptyContentProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-12 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-muted rounded-full mb-4">
        <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">{description}</p>
      <button
        onClick={onAction}
        disabled={isLoading || disabled}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium bg-primary text-primary-foreground border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
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
