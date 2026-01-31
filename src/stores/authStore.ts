import { create } from 'zustand';
import {
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const mapFirebaseUser = (firebaseUser: FirebaseUser): User => ({
  uid: firebaseUser.uid,
  email: firebaseUser.email,
  displayName: firebaseUser.displayName,
  photoURL: firebaseUser.photoURL,
});

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,
  initialized: false,

  signInWithEmail: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      set({ user: mapFirebaseUser(result.user), loading: false });
    } catch (error) {
      let errorMessage = 'Failed to sign in';
      if (error instanceof Error) {
        // Map Firebase auth errors to user-friendly messages
        if (error.message.includes('user-not-found') || error.message.includes('wrong-password')) {
          errorMessage = 'Invalid email or password';
        } else if (error.message.includes('invalid-email')) {
          errorMessage = 'Invalid email address';
        } else if (error.message.includes('too-many-requests')) {
          errorMessage = 'Too many failed attempts. Please try again later.';
        } else {
          errorMessage = error.message;
        }
      }
      set({
        error: errorMessage,
        loading: false,
      });
    }
  },

  signUpWithEmail: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      // First check if email is in allowlist
      const allowlistResponse = await fetch('/api/auth/check-allowlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!allowlistResponse.ok) {
        throw new Error('Failed to check email allowlist');
      }

      const { allowed } = await allowlistResponse.json();
      if (!allowed) {
        set({
          error: 'This email address is not authorized to create an account.',
          loading: false,
        });
        return;
      }

      // If email is allowed, create the account
      const result = await createUserWithEmailAndPassword(auth, email, password);
      set({ user: mapFirebaseUser(result.user), loading: false });
    } catch (error) {
      let errorMessage = 'Failed to create account';
      if (error instanceof Error) {
        // Map Firebase auth errors to user-friendly messages
        if (error.message.includes('email-already-in-use')) {
          errorMessage = 'An account with this email already exists';
        } else if (error.message.includes('invalid-email')) {
          errorMessage = 'Invalid email address';
        } else if (error.message.includes('weak-password')) {
          errorMessage = 'Password is too weak. Please use a stronger password.';
        } else if (error.message.includes('not authorized')) {
          errorMessage = error.message; // Already set above
        } else {
          errorMessage = error.message;
        }
      }
      set({
        error: errorMessage,
        loading: false,
      });
    }
  },

  signOut: async () => {
    set({ loading: true, error: null });
    try {
      await firebaseSignOut(auth);
      set({ user: null, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to sign out',
        loading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));

// Initialize auth listener
if (typeof window !== 'undefined') {
  onAuthStateChanged(auth, (firebaseUser) => {
    useAuthStore.setState({
      user: firebaseUser ? mapFirebaseUser(firebaseUser) : null,
      initialized: true,
      loading: false,
    });
  });
}
