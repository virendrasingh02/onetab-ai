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

const getInitialUser = (): CurrentUser | null => {
  try {
    const stored = localStorage.getItem('onetab_auth_user');
    return stored ? (JSON.parse(stored) as CurrentUser) : null;
  } catch {
    return null;
  }
};

const getInitialToken = (): string | null => {
  try {
    return localStorage.getItem('onetab_auth_token');
  } catch {
    return null;
  }
};

const initialUser = getInitialUser();
const initialToken = getInitialToken();

// Restored so the first request after a reload carries a token. Whether that
// token is still good is `useSessionBootstrap`'s call, not this module's.
if (initialToken) {
  setAccessToken(initialToken);
}

export const useAuthStore = create<AuthState>((set) => ({
  user: initialUser,
  // If we have cached user and access token, start in authenticated status so UI doesn't flicker
  status: initialUser && initialToken ? 'authenticated' : 'idle',

  setSession: (user, accessToken) => {
    try {
      localStorage.setItem('onetab_auth_user', JSON.stringify(user));
      localStorage.setItem('onetab_auth_token', accessToken);
    } catch {
      // ignore storage errors
    }
    setAccessToken(accessToken);
    set({ user, status: 'authenticated' });
  },

  setUser: (user) => {
    try {
      localStorage.setItem('onetab_auth_user', JSON.stringify(user));
    } catch {
      // ignore storage errors
    }
    set({ user });
  },

  setStatus: (status) => set({ status }),

  clear: () => {
    try {
      localStorage.removeItem('onetab_auth_user');
      localStorage.removeItem('onetab_auth_token');
    } catch {
      // ignore storage errors
    }
    setAccessToken(null);
    set({ user: null, status: 'anonymous' });
  },
}));

/** Selectors — subscribing narrowly avoids re-rendering on unrelated changes. */
export const selectUser = (state: AuthState) => state.user;
export const selectStatus = (state: AuthState) => state.status;
export const selectIsAuthenticated = (state: AuthState) =>
  state.status === 'authenticated' && state.user !== null;
