import {
  ApiError,
  authApi,
  queryKeys,
  setSessionExpiredHandler,
} from '@org/api-client';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '@org/validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from './auth.store.js';

/**
 * Restores the session on a cold load.
 *
 * The access token is memory-only, so after a refresh the app has no token but
 * may still hold a valid httpOnly refresh cookie. This exchanges that cookie
 * for a new token before deciding the user is anonymous.
 */
export function useSessionBootstrap(): void {
  const setSession = useAuthStore((state) => state.setSession);
  const setStatus = useAuthStore((state) => state.setStatus);
  const clear = useAuthStore((state) => state.clear);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      setStatus('authenticating');
      try {
        // 5-second limit so the login page is visible quickly even when the
        // API hasn't started yet — avoids a 15-second spinner on cold boot.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1_500);
        try {
          const tokens = await authApi.refresh({ signal: controller.signal });
          const user = await authApi.me();
          if (!cancelled) setSession(user, tokens.accessToken);
        } finally {
          clearTimeout(timer);
        }
      } catch {
        // No cookie, expired token, API offline, or timeout — a normal first
        // visit. The user lands on /login as expected.
        if (!cancelled) clear();
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, [setSession, setStatus, clear]);

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
