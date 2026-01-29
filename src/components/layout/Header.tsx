'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface HeaderProps {
  showBackLink?: boolean;
  backLinkHref?: string;
  backLinkText?: string;
}

export function Header({ showBackLink, backLinkHref = '/projects', backLinkText = 'Projects' }: HeaderProps) {
  const { user, signOut } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return (
    <header 
      className="border-b w-full"
      style={{ 
        height: '64px', 
        backgroundColor: '#ffffff', 
        borderColor: '#e5e5e5' 
      }}
    >
      <div 
        className="h-full w-full flex items-center justify-between px-6"
      >
        <div className="flex items-center gap-4">
          {showBackLink && (
            <Link
              href={backLinkHref}
              className="flex items-center gap-1 text-sm transition-colors hover:opacity-80"
              style={{ color: '#737373' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {backLinkText}
            </Link>
          )}
          
          <Link href="/projects" className="flex items-center gap-2">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: '#171717' }}
            >
              <svg
                className="w-4 h-4"
                style={{ color: '#ffffff' }}
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
            <span className="font-semibold" style={{ color: '#171717' }}>StoryForge</span>
          </Link>
        </div>
        
        {/* User menu */}
        {user && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#f5f5f5' }}
                >
                  <span className="text-sm font-medium" style={{ color: '#737373' }}>
                    {user.displayName?.[0] || user.email?.[0] || '?'}
                  </span>
                </div>
              )}
              <svg
                className={cn('w-4 h-4 transition-transform', showDropdown && 'rotate-180')}
                style={{ color: '#737373' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showDropdown && (
              <div 
                className="absolute right-0 mt-2 w-56 rounded-xl py-1 z-50 animate-fadeIn"
                style={{ 
                  backgroundColor: '#ffffff', 
                  border: '1px solid #e5e5e5',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
                }}
              >
                <div className="px-4 py-3" style={{ borderBottom: '1px solid #e5e5e5' }}>
                  <p className="text-sm font-medium truncate" style={{ color: '#171717' }}>
                    {user.displayName}
                  </p>
                  <p className="text-xs truncate" style={{ color: '#737373' }}>
                    {user.email}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    signOut();
                  }}
                  className="w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 hover:bg-gray-50"
                  style={{ color: '#171717' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
