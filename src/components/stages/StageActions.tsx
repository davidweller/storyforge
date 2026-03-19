'use client';

import { Button } from '@/components/ui';

interface StageActionsProps {
  onApprove: () => void;
  onRegenerate: () => void;
  onEdit?: () => void;
  isApproved?: boolean;
  isGenerating?: boolean;
  canApprove?: boolean;
  showEdit?: boolean;
}

export function StageActions({
  onApprove,
  onRegenerate,
  onEdit,
  isApproved = false,
  isGenerating = false,
  canApprove = true,
  showEdit = true,
}: StageActionsProps) {
  if (isApproved) {
    return (
      <div className="flex items-center justify-between p-6 bg-[color-mix(in_srgb,var(--status-approved)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-approved)_30%,transparent)] rounded-xl mt-6">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-[var(--status-approved)]" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="font-medium text-[var(--status-approved)]">Approved &amp; Locked</span>
        </div>
        <p className="text-sm text-muted-foreground">
          This content is now part of your project canon.
        </p>
      </div>
    );
  }

  return (
    <div className="sticky bottom-0 bg-background border-t border-border py-6 mt-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={onRegenerate}
            disabled={isGenerating}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Regenerate
          </Button>

          {showEdit && onEdit && (
            <Button variant="ghost" onClick={onEdit} disabled={isGenerating}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </Button>
          )}
        </div>

        <Button
          onClick={onApprove}
          disabled={isGenerating || !canApprove}
          loading={isGenerating}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Approve &amp; Continue
        </Button>
      </div>
    </div>
  );
}
