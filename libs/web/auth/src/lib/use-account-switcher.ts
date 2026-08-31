import {
  ApiError,
  authApi,
  SessionRejectedError,
  setAccessToken,
} from '@org/api-client';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import {
  getActiveAccount,
  useAccountStore,
  type Account,
} from './account-store.js';
import { useAuthStore } from './auth.store.js';

/** Credentials for adding a second identity — login without `rememberMe`. */
export interface AddAccountInput {
  email: string;
  password: string;
}

/**
 * localStorage keys the workspace layer reads to restore the last-open
 * workspace. Cleared on a switch so the redirect resolves the *new* account's
 * first workspace instead of bouncing to one it cannot see.
 */
const ACTIVE_WORKSPACE_KEYS = [
  'onetab_active_workspace_id',
  'onetab_active_workspace_slug',
];

/** `exp` (ms) from a JWT payload, without verifying the signature. `0` if unreadable. */
function accessTokenExpiry(token: string): number {
  try {
    const payload = token.split('.')[1];
    const json = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/')),
    ) as { exp?: number };
    return typeof json.exp === 'number' ? json.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/**
 * Rotates one account's tokens from its own stored refresh token and writes the
 * fresh pair back into the account store.
 *
 * The empty-`refreshToken` branch is the cookie-restored primary account before
 * its first rotation: it still owns the browser refresh cookie, so a bare
 * `/auth/refresh` works and backfills its token. Every other account must use
 * its body token — the cookie is not theirs.
 *
 * Shared by the switch routine and the api-client refresh provider, so it is a
 * plain function (no hooks): the provider runs outside React.
 */
export async function rotateAccount(account: Account): Promise<string> {
  const res = account.refreshToken
    ? await authApi.refresh({ refreshToken: account.refreshToken })
    : await authApi.refresh();
  useAccountStore.getState().updateAccountTokens(account.id, {
    accessToken: res.accessToken,
    refreshToken: res.refreshToken,
  });
  return res.accessToken;
}

/**
 * The api-client refresh provider for the browser multi-account session.
 *
 * Registered once from `use-auth` (desktop keeps its own provider). Refreshes
 * whichever account is active; throws {@link SessionRejectedError} only on a
 * definitive 401/403 so a network blip never signs anyone out.
 */
export async function refreshActiveAccountToken(): Promise<string> {
  const active = getActiveAccount();
  try {
    if (active) {
      const token = await rotateAccount(active);
      setAccessToken(token);
      return token;
    }
    // No multi-account state yet — plain cookie refresh.
    const res = await authApi.refresh();
    setAccessToken(res.accessToken);
    return res.accessToken;
  } catch (error) {
    if (
      error instanceof SessionRejectedError ||
      (error instanceof ApiError &&
        (error.status === 401 || error.status === 403))
    ) {
      throw new SessionRejectedError(
        error instanceof Error ? error.message : 'Session was rejected.',
      );
    }
    throw error instanceof Error
      ? error
      : new Error('Token refresh is temporarily unavailable.');
  }
}

/**
 * Makes `accountId` the active identity: swaps the access token, points the
 * auth store and api-client at it, resets account-scoped caches and routing,
 * and lands on the account's default workspace.
 */
async function activateAccount(
  accountId: string,
  queryClient: QueryClient,
  navigate: NavigateFunction,
): Promise<void> {
  const account = useAccountStore
    .getState()
    .accounts.find((a) => a.id === accountId);
  if (!account) throw new Error('That account is no longer linked.');

  // Refresh a token that is expired or within 30s of it before it goes live.
  let accessToken = account.accessToken;
  if (!accessToken || accessTokenExpiry(accessToken) - Date.now() < 30_000) {
    accessToken = await rotateAccount(account);
  }

  setAccessToken(accessToken);
  useAccountStore.getState().setActiveAccountId(accountId);
  useAuthStore.getState().setSession(account.user, accessToken);

  for (const key of ACTIVE_WORKSPACE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore storage errors
    }
  }

  // Nothing cached under the previous identity may leak into this one.
  queryClient.clear();
  navigate('/', { replace: true });
}

/** The linked accounts and which one is active. */
export function useAccounts() {
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  return { accounts, activeAccountId };
}

/**
 * Signs into a second identity without disturbing the current one, then
 * switches to it. Surfaces {@link ApiError} so a form can show field errors.
 */
export function useAddAccount() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (input: AddAccountInput) => {
      // The current account may have been restored from the cookie this session
      // and never given a client-side refresh token. `authApi.login` below
      // overwrites the browser's one refresh cookie, so the current account
      // must capture its own token first — while the cookie is still hers — or
      // it cannot be refreshed after the switch. Not best-effort: proceeding
      // past a failure here strands the current session.
      const active = getActiveAccount();
      if (active && !active.refreshToken) {
        await rotateAccount(active);
      }

      const data = await authApi.login({ ...input, rememberMe: true });
      useAccountStore.getState().upsertAccount({
        id: data.user.id,
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? '',
        addedAt: Date.now(),
      });
      return data;
    },
    onSuccess: (data) => activateAccount(data.user.id, queryClient, navigate),
  });
}

/** Switches to an already-linked account. */
export function useSwitchAccount() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (accountId: string) =>
      activateAccount(accountId, queryClient, navigate),
  });
}

/**
 * Removes one linked account. Revokes its refresh token server-side, drops it
 * locally, and — if it was the active one — falls back to the most recently
 * added remaining account, or to `/login` when none are left.
 */
export function useRemoveAccount() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (accountId: string) => {
      const { accounts, activeAccountId } = useAccountStore.getState();
      const account = accounts.find((a) => a.id === accountId);
      const isActive = activeAccountId === accountId;
      try {
        // The active account owns the refresh cookie, so a plain logout clears
        // it. A background account has no cookie — revoke it by token instead,
        // leaving the active session untouched.
        if (isActive) {
          await authApi.logout();
        } else if (account?.refreshToken) {
          await authApi.logout({ refreshToken: account.refreshToken });
        }
      } catch {
        // Best effort — still drop it locally.
      }
      return accountId;
    },
    onSuccess: async (accountId) => {
      const wasActive =
        useAccountStore.getState().activeAccountId === accountId;
      useAccountStore.getState().removeAccount(accountId);

      if (!wasActive) return;

      const remaining = useAccountStore.getState().accounts;
      if (remaining.length > 0) {
        await activateAccount(
          remaining[remaining.length - 1].id,
          queryClient,
          navigate,
        );
      } else {
        useAuthStore.getState().clear();
        queryClient.clear();
        navigate('/login', { replace: true });
      }
    },
  });
}
