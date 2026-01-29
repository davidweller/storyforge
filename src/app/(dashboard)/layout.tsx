'use client';

import { ReactNode } from 'react';
import { AuthProvider, ProtectedRoute } from '@/components/auth';
import { Header } from '@/components/layout';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <div className="min-h-screen bg-[#fafafa]">
          <Header />
          <main className="w-full max-w-5xl mx-auto px-6 lg:px-8">
            {children}
          </main>
        </div>
      </ProtectedRoute>
    </AuthProvider>
  );
}
