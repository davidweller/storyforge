'use client';

import { ReactNode } from 'react';
import { AuthProvider, ProtectedRoute } from '@/components/auth';
import { Header } from '@/components/layout';
import { ToastProvider } from '@/components/ui';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <ToastProvider>
          <div className="min-h-screen bg-background">
            <Header />
            {children}
          </div>
        </ToastProvider>
      </ProtectedRoute>
    </AuthProvider>
  );
}
