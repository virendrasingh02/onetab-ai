import { setAccessToken } from '@org/api-client';
import type { CurrentUser } from '@org/types';
import { create } from 'zustand';

/**
 * Authentication state.
 *
 * Zustand holds only session identity; server data (workspaces, channels)
 * belongs to TanStack Query. The access token deliberately lives in the
 * api-client module rather than here — it must never be serialised into
 * devtools, storage, or a persisted store.
 */
export type AuthStatus =
  'idle' | 'authenticating' | 'authenticated' | 'anonymous';

interface AuthState {
  user: CurrentUser | null;
  status: AuthStatus;
  setSession: (user: CurrentUser, accessToken: string) => void;
  setUser: (user: CurrentUser) => void;
  setStatus: (status: AuthStatus) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',

  setSession: (user, accessToken) => {
    setAccessToken(accessToken);
    set({ user, status: 'authenticated' });
  },

  setUser: (user) => set({ user }),

  setStatus: (status) => set({ status }),

  clear: () => {
    setAccessToken(null);
    set({ user: null, status: 'anonymous' });
  },
}));

/** Selectors — subscribing narrowly avoids re-rendering on unrelated changes. */
export const selectUser = (state: AuthState) => state.user;
export const selectStatus = (state: AuthState) => state.status;
export const selectIsAuthenticated = (state: AuthState) =>
  state.status === 'authenticated' && state.user !== null;
