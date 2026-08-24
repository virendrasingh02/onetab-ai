import {
  ApiError,
  authApi,
  getAccessToken,
  queryKeys,
  setAccessToken,
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
import { useAuthStore } from './auth.store.js';

/** A refusal from the API — the one answer that ends a session. */
const isSessionRejection = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
              if (!cancelled) setSession(me, desktopSession.accessToken);
            } catch {
              // Retain active session
            }
            return;
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
          if (!cancelled) setSession(me, tokens.accessToken);
          return;
        } catch (error) {
          if (cancelled) return;

          if (isSessionRejection(error)) {
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
}

export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: (data) => {
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
    onSettled: () => {
      clear();
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
