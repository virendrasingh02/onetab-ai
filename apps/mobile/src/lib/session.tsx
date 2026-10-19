import {
  authApi,
  isTwoFactorChallenge,
  refreshSession,
  SessionRejectedError,
  setAccessToken,
  setApiBaseURL,
  setRefreshTokenProvider,
  setSessionExpiredHandler,
  type AuthResponse,
} from '@org/api-client';
import type { CurrentUser } from '@org/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';
import { authenticate } from './biometrics';
import { appConfig } from './config';
import { queryClient } from './query';
import { secureStore } from './secure-store';
import {
  clearSessionStorage,
  createRefreshProvider,
  hasStoredSession,
  isAuthRejection,
  persistTokens,
  STORAGE_KEYS,
  type RefreshMode,
} from './session-core';

/** Browsers keep the refresh token in the API's httpOnly cookie. */
const REFRESH_MODE: RefreshMode = Platform.OS === 'web' ? 'cookie' : 'token';

export type SessionStatus =
  'loading' | 'signedOut' | 'signedIn' | 'unreachable';

export interface TwoFactorChallenge {
  challengeToken: string;
  expiresAt: string;
}

interface SessionContextValue {
  status: SessionStatus;
  user: CurrentUser | null;
  /** True while a biometric unlock is required before showing content. */
  locked: boolean;
  biometricLock: boolean;
  signIn(
    email: string,
    password: string,
  ): Promise<{ challenge?: TwoFactorChallenge }>;
  completeTwoFactor(challengeToken: string, code: string): Promise<void>;
  signOut(): Promise<void>;
  retry(): void;
  unlock(): Promise<boolean>;
  setBiometricLock(enabled: boolean): Promise<void>;
  setUser(user: CurrentUser): void;
  /** Registered by the push module so sign-out can revoke this device first. */
  registerSignOutHook(hook: () => Promise<void>): () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/** Relock after this long in the background. */
const LOCK_AFTER_MS = 60_000;

let apiConfigured = false;

function configureApiClient(onExpired: () => void) {
  if (!apiConfigured) {
    setApiBaseURL(appConfig.apiUrl);
    // Without a provider `@org/api-client` refreshes from the cookie, exactly
    // as the web app does.
    setRefreshTokenProvider(
      REFRESH_MODE === 'cookie'
        ? null
        : createRefreshProvider({
            store: secureStore,
            refresh: (refreshToken) => authApi.refresh({ refreshToken }),
            isRejection: isAuthRejection,
            toRejection: (message) => new SessionRejectedError(message),
          }),
    );
    apiConfigured = true;
  }
  setSessionExpiredHandler(onExpired);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [biometricLock, setBiometricLockState] = useState(false);
  const [locked, setLocked] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const signOutHooks = useRef(new Set<() => Promise<void>>());

  const resetLocal = useCallback(async () => {
    setAccessToken(null);
    await clearSessionStorage(secureStore);
    queryClient.clear();
    setUser(null);
    setLocked(false);
    setStatus('signedOut');
  }, []);

  const bootstrap = useCallback(async () => {
    setStatus('loading');
    configureApiClient(() => {
      void resetLocal();
    });

    const lockSetting = await secureStore.get(STORAGE_KEYS.biometricLock);
    setBiometricLockState(lockSetting === 'on');

    if (!(await hasStoredSession(secureStore, REFRESH_MODE))) {
      setStatus('signedOut');
      return;
    }

    try {
      await refreshSession();
      const me = await authApi.me();
      setUser(me);
      setLocked(lockSetting === 'on');
      setStatus('signedIn');
    } catch (error) {
      if (isAuthRejection(error)) {
        await resetLocal();
      } else {
        // The token may well be fine; the API just could not be reached.
        setStatus('unreachable');
      }
    }
  }, [resetLocal]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // Relock when returning from the background after a while.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        backgroundedAt.current = Date.now();
      } else if (next === 'active' && backgroundedAt.current !== null) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (biometricLock && status === 'signedIn' && away > LOCK_AFTER_MS)
          setLocked(true);
      }
    });
    return () => subscription.remove();
  }, [biometricLock, status]);

  const establish = useCallback(async (response: AuthResponse) => {
    setAccessToken(response.accessToken);
    await persistTokens(secureStore, response, REFRESH_MODE);
    await secureStore.set(STORAGE_KEYS.userId, response.user.id);
    setUser(response.user);
    setLocked(false);
    setStatus('signedIn');
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      user,
      locked,
      biometricLock,
      async signIn(email, password) {
        configureApiClient(() => {
          void resetLocal();
        });
        const response = await authApi.login({
          email,
          password,
          rememberMe: true,
        });
        if (isTwoFactorChallenge(response)) {
          return {
            challenge: {
              challengeToken: response.challengeToken,
              expiresAt: response.expiresAt,
            },
          };
        }
        await establish(response);
        return {};
      },
      async completeTwoFactor(challengeToken, code) {
        const response = await authApi.completeTwoFactorLogin({
          challengeToken,
          code,
        });
        await establish(response);
      },
      async signOut() {
        for (const hook of signOutHooks.current) {
          await hook().catch(() => undefined);
        }
        // Web sends nothing: the API revokes the cookie's session and clears it.
        const refreshToken =
          REFRESH_MODE === 'token'
            ? await secureStore.get(STORAGE_KEYS.refreshToken)
            : null;
        // Revoke server-side; a failure here must not keep the person signed in locally.
        await authApi
          .logout(refreshToken ? { refreshToken } : {})
          .catch(() => undefined);
        await resetLocal();
      },
      retry() {
        void bootstrap();
      },
      async unlock() {
        const ok = await authenticate();
        if (ok) setLocked(false);
        return ok;
      },
      async setBiometricLock(enabled) {
        if (enabled) {
          const ok = await authenticate('Confirm to turn on biometric unlock');
          if (!ok) return;
        }
        await secureStore.set(
          STORAGE_KEYS.biometricLock,
          enabled ? 'on' : 'off',
        );
        setBiometricLockState(enabled);
      },
      setUser,
      registerSignOutHook(hook) {
        signOutHooks.current.add(hook);
        return () => {
          signOutHooks.current.delete(hook);
        };
      },
    }),
    [status, user, locked, biometricLock, establish, resetLocal, bootstrap],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value)
    throw new Error('useSession must be used inside <SessionProvider>.');
  return value;
}
