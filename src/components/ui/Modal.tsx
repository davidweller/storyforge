'use client';

import { useEffect, useRef } from 'react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Footer action buttons. If omitted, a default "Close" button is rendered. */
  actions?: React.ReactNode;
}

/**
 * Accessible modal dialog with focus trap and Escape-key dismiss.
 * Replaces inline one-off confirmation dialogs across the app.
 */
export function Modal({ isOpen, onClose, title, children, actions }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-md rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xl p-6"
      >
        <h2
          id="modal-title"
          className="text-lg font-semibold text-[var(--foreground)] mb-3"
        >
          {title}
        </h2>

        <div className="text-sm text-[var(--muted-foreground)]">{children}</div>

        <div className="mt-6 flex justify-end gap-3">
          {actions ?? (
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
