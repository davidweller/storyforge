'use client';

import { ReactNode } from 'react';

// Single-user local app — no authentication needed.
// AuthProvider is kept as a passthrough so the dashboard layout compiles
// without modification.
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return <>{children}</>;
}
