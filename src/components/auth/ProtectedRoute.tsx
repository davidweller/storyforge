'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

// Bypass auth in development mode
const DEV_MODE_BYPASS_AUTH = process.env.NODE_ENV === 'development';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, initialized, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Skip auth redirect in dev mode
    if (DEV_MODE_BYPASS_AUTH) return;
    
    if (initialized && !loading && !user) {
      router.push('/login');
    }
  }, [initialized, loading, user, router]);

  // In dev mode, skip loading state and auth check
  if (DEV_MODE_BYPASS_AUTH) {
    return <>{children}</>;
  }

  if (!initialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
          <p className="text-[var(--muted-foreground)]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
