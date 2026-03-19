'use client';

import { ReactNode } from 'react';

// Single-user local app — no authentication needed.
// ProtectedRoute is kept as a passthrough so the dashboard layout compiles
// without modification.
interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  return <>{children}</>;
}
