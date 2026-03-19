'use client';

import { useAuthStore } from '@/stores/authStore';

// Single-user local app — auth is a no-op. This hook is kept so all
// components that call useAuth() continue to work without modification.
export function useAuth() {
  const { user, loading, error, initialized, signOut, clearError } = useAuthStore();

  return {
    user,
    loading,
    error,
    initialized,
    isAuthenticated: true,
    signInWithEmail: async () => {},
    signUpWithEmail: async () => {},
    signOut,
    clearError,
  };
}

export function useRequireAuth() {
  return useAuth();
}
