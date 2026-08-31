import {
  ApiError,
  authApi,
  getAccessToken,
  queryKeys,
  SessionRejectedError,
  setAccessToken,
  setRefreshTokenProvider,
  setSessionExpiredHandler,
} from '@org/api-client';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '@org/validation';
import { getDesktopApi } from '@org/web-desktop';
import type { CurrentUser } from '@org/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccountStore } from './account-store.js';
import { useAuthStore } from './auth.store.js';
import { refreshActiveAccountToken } from './use-account-switcher.js';

/** Seeds or refreshes the multi-account row for the signed-in identity. */
function trackAccount(
  user: CurrentUser,
  accessToken: string,
  refreshToken?: string,
): void {
  const store = useAccountStore.getState();
  const existing = store.accounts.find((a) => a.id === user.id);
  store.upsertAccount({
    id: user.id,
    user,
    accessToken,
    // Never downgrade a real stored token back to '' on a later cookie-path pass.
    refreshToken: refreshToken || existing?.refreshToken || '',
    addedAt: existing?.addedAt ?? Date.now(),
  });
  store.setActiveAccountId(user.id);
}

/** A refusal from the API — the one answer that ends a session. */
const isSessionRejection = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/*
 * The default token refresh reads an httpOnly cookie that only a browser
 * which completed the login request ever has. A desktop session is
 * established by the Electron main process's own `fetch` — no cookie jar
 * shared with the renderer — so it can never satisfy that path. Registering
 * this here, at module scope, means it is wired before the first request of
 * the session (including the bootstrap below) rather than racing a
 * component's mount effect.
 */
const desktopApiForRefresh = getDesktopApi();
if (desktopApiForRefresh) {
  setRefreshTokenProvider(async () => {
    let session;
    try {
      session = await desktopApiForRefresh.auth.refreshSession();
    } catch (error) {
      // The IPC call only ever rejects for a definitive refusal — an
      // expired/revoked refresh token (see `refreshSecureSession` in the
      // main process); anything else resolves `null` instead. A rejection
      // here always means "sign out," never "try again."
      throw new SessionRejectedError(
        error instanceof Error ? error.message : 'Desktop session refresh was rejected.',
      );
    }
    if (!session?.accessToken) {
      // Transient failure (offline, API restarting): a plain Error, not
      // `SessionRejectedError`, so the caller leaves the session untouched
      // instead of signing out for a blip.
      throw new Error('Desktop session refresh is temporarily unavailable.');
    }
    return session.accessToken;
  });
} else if (typeof window !== 'undefined') {
  /*
   * Browser multi-account: a browser holds exactly one refresh cookie, so every
   * account past the first refreshes from its own token in the account store
   * instead. The lone primary account still falls through to the cookie. Same
   * module-scope timing rationale as the desktop provider above.
   */
  setRefreshTokenProvider(() => refreshActiveAccountToken());
}

/*
 * A cold load races the API: under `dev:all` the browser is usually up first,
 * and the client also probes ports 3000-3009 to find it. Retrying an
 * unreachable server is what keeps that race from reading as a logout.
 */
const BOOTSTRAP_BACKOFF_MS = [400, 1_200, 3_000];

/**
 * Restores the session on a cold load.
 *
 * Checks Electron desktop bridge for persisted safeStorage credentials first,
 * then falls back to httpOnly cookie refresh exchange.
 */
export function useSessionBootstrap(): void {
  const setSession = useAuthStore((state) => state.setSession);
  const setStatus = useAuthStore((state) => state.setStatus);
  const clear = useAuthStore((state) => state.clear);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      setStatus('authenticating');

      // 1. In Electron shell, inspect desktop safeStorage session first
      const desktopApi = getDesktopApi();
      if (desktopApi) {
        try {
          const desktopSession = await desktopApi.auth.getSession();
          if (desktopSession?.user && desktopSession.accessToken) {
            setAccessToken(desktopSession.accessToken);
            setSession(desktopSession.user as unknown as CurrentUser, desktopSession.accessToken);
            try {
              const me = await authApi.me();
              // `me()` may have silently gone through the axios interceptor's
              // own refresh-and-retry (it shares this same desktop refresh
              // path) and rotated the live token in the process. Re-reading
              // it here rather than trusting the pre-call `desktopSession`
              // value matters: saving the stale one back over the fresh one
              // would immediately 401 the next request and restart the whole
              // refresh dance — see the matrix-provider backoff, which relies
              // on the token staying put once a sync attempt has run.
              if (!cancelled) setSession(me, getAccessToken() ?? desktopSession.accessToken);
              return;
            } catch {
              // The stored access token is a JWT with a short TTL (minutes);
              // any cold start more than that after the last launch finds it
              // already expired. The desktop's own refresh token — never a
              // browser cookie the generic path below could use — is the only
              // way to recover it without forcing a fresh login every time.
              try {
                const refreshed = await desktopApi.auth.refreshSession();
                if (refreshed?.user && refreshed.accessToken) {
                  setAccessToken(refreshed.accessToken);
                  const me = await authApi.me();
                  if (!cancelled) setSession(me, getAccessToken() ?? refreshed.accessToken);
                  return;
                }
                // Transient failure (offline, API restarting): keep the
                // cached identity showing rather than bounce to /login for a
                // blip, matching the cookie path's "unreachable" fallback.
                if (user) {
                  if (!cancelled) setSession(user, getAccessToken() ?? desktopSession.accessToken);
                  return;
                }
              } catch {
                // Refresh token itself was refused — desktop has no cookie
                // fallback that could succeed either, so fall through and let
                // step 2 settle the session into `clear()`.
              }
            }
          }
        } catch {
          // Continue to cookie exchange
        }
      }

      // 2. Standard cookie refresh loop
      for (let attempt = 0; ; attempt += 1) {
        try {
          const tokens = await authApi.refresh();
          setAccessToken(tokens.accessToken);

          const me = await authApi.me();
          if (!cancelled) {
            setSession(me, tokens.accessToken);
            // The cookie was just rotated — keep the multi-account row's stored
            // token in step with it, or a later switch back to this account
            // would replay a spent token.
            trackAccount(me, tokens.accessToken, tokens.refreshToken);
          }
          return;
        } catch (error) {
          if (cancelled) return;

          if (isSessionRejection(error)) {
            const currentToken = getAccessToken();
            if (currentToken) {
              try {
                const me = await authApi.me();
                if (!cancelled) {
                  setSession(me, currentToken);
                  return;
                }
              } catch {
                // Token also invalid
              }
            }
            clear();
            return;
          }

          const backoff = BOOTSTRAP_BACKOFF_MS[attempt];
          if (backoff !== undefined) {
            await wait(backoff);
            continue;
          }

          // Unreachable, not refused. Keep whoever was signed in here.
          if (user && getAccessToken()) setSession(user, getAccessToken() ?? '');
          else clear();
          return;
        }
      }
    }

    restore();

    // Subscribe to live auth session updates from browser login / deep link
    const desktopApi = getDesktopApi();
    const unsubscribeDesktop = desktopApi?.auth.onSessionChange((sess) => {
      if (sess?.user && sess.accessToken) {
        setAccessToken(sess.accessToken);
        setSession(sess.user as unknown as CurrentUser, sess.accessToken);
        if (
          window.location.pathname.startsWith('/login') ||
          window.location.pathname.startsWith('/auth/callback')
        ) {
          navigate('/', { replace: true });
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribeDesktop?.();
    };
    // `user` is the cached identity read once at store creation; re-running this
    // when it changes would re-bootstrap on every profile edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSession, setStatus, clear, navigate]);

  // A refresh failure mid-session must drop the user back to sign-in.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      clear();
      navigate('/login', { replace: true });
    });
    return () => setSessionExpiredHandler(null);
  }, [clear, navigate]);

  // Once a session is live — however it was restored — make sure it has a
  // multi-account row so the switcher lists it and the refresh provider can
  // find it. Its client-side refresh token is backfilled on the first rotation.
  const liveUser = useAuthStore((state) => state.user);
  const liveStatus = useAuthStore((state) => state.status);
  useEffect(() => {
    if (liveStatus !== 'authenticated' || !liveUser) return;
    const store = useAccountStore.getState();
    const known = store.accounts.some((a) => a.id === liveUser.id);
    // `setSession`/`setUser` already keep an existing row current — only step in
    // to create the row (and mark it active) the first time.
    if (known) {
      if (store.activeAccountId !== liveUser.id) {
        store.setActiveAccountId(liveUser.id);
      }
      return;
    }
    trackAccount(liveUser, getAccessToken() ?? '');
  }, [liveStatus, liveUser]);
}

export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: (data) => {
      trackAccount(data.user, data.accessToken, data.refreshToken);
      setSession(data.user, data.accessToken);
      // Anything cached for a previous account must not leak into this one.
      queryClient.clear();
    },
  });
}

export function useRegister() {
  const setSession = useAuthStore((state) => state.setSession);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
    onSuccess: (data) => {
      trackAccount(data.user, data.accessToken, data.refreshToken);
      setSession(data.user, data.accessToken);
      queryClient.clear();
    },
  });
}

export function useLogout() {
  const clear = useAuthStore((state) => state.clear);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => authApi.logout(),
    // Runs on success *and* failure: a server-side logout error must not strand
    // the user in a half-signed-in state.
    onSettled: async () => {
      // The desktop shell keeps its own encrypted session (access + refresh
      // token) in the main process — see the bootstrap's desktop branch above.
      // `authApi.logout()` only clears the browser's httpOnly cookie, which
      // that stored session never relied on, so without this the next cold
      // start (or window recreation) finds it still valid and silently signs
      // the user back in, making logout look like it never took effect.
      try {
        await getDesktopApi()?.auth.clearSession();
      } catch {
        // Best-effort: local state is cleared below regardless.
      }
      clear();
      // "Log out" ends *every* linked account, not just the active one.
      useAccountStore.getState().clearAll();
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: ForgotPasswordInput) => authApi.forgotPassword(input),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) => authApi.resetPassword(input),
  });
}

export function useCurrentUser() {
  return useAuthStore((state) => state.user);
}

/**
 * The path to send someone to after they authenticate.
 *
 * Router `state.from` is set by whatever gated them here — a protected route, or
 * an invitation link that needs a session. Preserving `search`/`hash` matters:
 * an invite token or a device-pair `?request=` lives there. Falls back to
 * `fallback` when nothing was stashed.
 */
export function redirectPathFromAuthState(
  state: unknown,
  fallback = '/',
): string {
  const from = (
    state as {
      from?: { pathname?: string; search?: string; hash?: string };
    } | null
  )?.from;
  if (!from?.pathname) return fallback;
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`;
}

/** Extracts a form-level message from an ApiError, ignoring field errors. */
export function formErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    // Field-level problems render next to their inputs instead.
    if (error.fieldErrors && Object.keys(error.fieldErrors).length > 0) {
      return null;
    }
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

export { queryKeys };
