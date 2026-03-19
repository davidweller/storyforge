'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

interface HeaderProps {
  showBackLink?: boolean;
  backLinkHref?: string;
  backLinkText?: string;
}

export function Header({ showBackLink, backLinkHref = '/projects', backLinkText = 'Projects' }: HeaderProps) {
  return (
    <header className="border-b border-border bg-card w-full h-[var(--header-height)]">
      <div className="h-full w-full flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          {showBackLink && (
            <Link
              href={backLinkHref}
              className="flex items-center gap-1 text-sm text-muted-foreground transition-opacity hover:opacity-80"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {backLinkText}
            </Link>
          )}

          <Link href="/projects" className={cn('flex items-center gap-2.5', showBackLink && 'ml-2')}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-accent/15">
              <svg
                className="w-3.5 h-3.5 text-accent"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <span className="font-semibold text-foreground font-sans tracking-tight">StoryForge</span>
          </Link>
        </div>

        {/* Settings link */}
        <Link
          href="/settings"
          className="flex items-center gap-2 text-sm text-muted-foreground transition-opacity hover:opacity-80"
          title="Settings (API keys)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="hidden sm:inline">Settings</span>
        </Link>
      </div>
    </header>
  );
}
