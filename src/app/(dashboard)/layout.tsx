'use client';

import { ReactNode } from 'react';
import { AuthProvider, ProtectedRoute } from '@/components/auth';
import { Header } from '@/components/layout';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <div className="min-h-screen bg-background">
          <Header />
          {children}
        </div>
      </ProtectedRoute>
    </AuthProvider>
  );
}
