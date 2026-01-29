'use client';

interface ContentDisplayProps {
  content: string;
  isEditing?: boolean;
  onContentChange?: (content: string) => void;
}

export function ContentDisplay({
  content,
  isEditing = false,
  onContentChange,
}: ContentDisplayProps) {
  if (isEditing && onContentChange) {
    return (
      <textarea
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
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e5e5e5',
        borderRadius: '12px',
        boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        padding: '1.5rem',
      }}
    >
      <div 
        style={{ color: '#171717', whiteSpace: 'pre-wrap' }}
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
    <div style={{
      backgroundColor: '#ffffff',
      border: '1px solid #e5e5e5',
      borderRadius: '12px',
      padding: '3rem',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
        <div style={{
          width: '3rem',
          height: '3rem',
          border: '4px solid #e5e5e5',
          borderTopColor: '#3b82f6',
          borderRadius: '9999px',
          animation: 'spin 1s linear infinite',
        }} />
        <p style={{ color: '#737373' }}>{message}</p>
        <p style={{ fontSize: '0.875rem', color: '#737373' }}>This may take a minute...</p>
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
    <div style={{
      backgroundColor: '#ffffff',
      border: '1px solid #e5e5e5',
      borderRadius: '12px',
      padding: '3rem',
      textAlign: 'center',
    }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '4rem',
        height: '4rem',
        backgroundColor: '#f5f5f5',
        borderRadius: '9999px',
        marginBottom: '1rem',
      }}>
        <svg style={{ width: '2rem', height: '2rem', color: '#737373' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#171717', marginBottom: '0.5rem' }}>{title}</h3>
      <p style={{ color: '#737373', marginBottom: '1.5rem', maxWidth: '28rem', marginLeft: 'auto', marginRight: 'auto' }}>{description}</p>
      <button
        onClick={onAction}
        disabled={isLoading}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem 1.5rem',
          borderRadius: '8px',
          fontWeight: 500,
          backgroundColor: '#171717',
          color: '#ffffff',
          border: 'none',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.5 : 1,
        }}
      >
        {isLoading ? (
          <>
            <div style={{
              width: '1rem',
              height: '1rem',
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              borderRadius: '9999px',
              animation: 'spin 1s linear infinite',
            }} />
            Generating...
          </>
        ) : (
          <>
            <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {actionLabel}
          </>
        )}
      </button>
    </div>
  );
}
