'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function useAuth() {
  const { user, loading, error, initialized, signInWithEmail, signUpWithEmail, signOut, clearError } = useAuthStore();
  
  return {
    user,
    loading,
    error,
    initialized,
    isAuthenticated: !!user,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    clearError,
  };
}

export function useRequireAuth() {
  const auth = useAuth();
  
  useEffect(() => {
    if (auth.initialized && !auth.isAuthenticated) {
      // Redirect to login will be handled by the component or middleware
    }
  }, [auth.initialized, auth.isAuthenticated]);
  
  return auth;
}
