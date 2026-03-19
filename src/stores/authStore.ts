import { create } from 'zustand';
import type { User } from '@/types';

// Single-user local app — no authentication needed.
// This store is kept as a stub so existing components that reference
// useAuthStore continue to compile without changes.
interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const LOCAL_USER: User = {
  uid: 'local',
  email: null,
  displayName: 'Local User',
  photoURL: null,
};

export const useAuthStore = create<AuthState>(() => ({
  user: LOCAL_USER,
  loading: false,
  error: null,
  initialized: true,
  signOut: async () => {},
  clearError: () => {},
}));
