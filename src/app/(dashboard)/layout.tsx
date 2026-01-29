'use client';

import { ReactNode } from 'react';
import { AuthProvider, ProtectedRoute } from '@/components/auth';
import { Header } from '@/components/layout';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <div style={{ minHeight: '100vh', backgroundColor: '#fafafa' }}>
          <Header />
          {children}
        </div>
      </ProtectedRoute>
    </AuthProvider>
  );
}
