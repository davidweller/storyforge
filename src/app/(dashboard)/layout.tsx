'use client';

import { ReactNode } from 'react';
import { AuthProvider, ProtectedRoute } from '@/components/auth';
import { Header } from '@/components/layout';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <div className="min-h-screen bg-[var(--background)]">
          <Header />
          <main className="max-w-6xl mx-auto px-6">{children}</main>
        </div>
      </ProtectedRoute>
    </AuthProvider>
  );
}
