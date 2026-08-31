import {
  ApiError,
  authApi,
  SessionRejectedError,
  setAccessToken,
  workspaceApi,
  type AuthResponse,
} from '@org/api-client';
import type { CurrentUser } from '@org/types';
import type { LoginInput, RegisterInput } from '@org/validation';
import {
  useMutation,
  useQueries,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import {
  getActiveAccount,
  useAccountStore,
  type Account,
  type AccountWorkspace,
} from './account-store.js';
import { useAuthStore } from './auth.store.js';

/** Credentials for the "Add account → Log in" path. */
export type AddAccountInput = LoginInput;
/** Fields for the "Add account → Sign up" path. */
export type SignUpAccountInput = RegisterInput;

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
 * `/auth/refresh` works and backfills its token. That fallback is ONLY valid
 * for the account that currently owns the cookie — the signed-in one — because
 * for anyone else it would rotate the wrong session's token.
 *
 * Shared by the switch routine and the api-client refresh provider, so it is a
 * plain function (no hooks): the provider runs outside React.
 */
export async function rotateAccount(account: Account): Promise<string> {
  if (!account.refreshToken && useAuthStore.getState().user?.id !== account.id) {
    throw new SessionRejectedError(
      'This account needs to be signed in again.',
    );
  }
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
 * and lands on `to` — the account's default workspace (`/`) unless a specific
 * path is given (e.g. a workspace picked straight from the switcher).
 */
async function activateAccount(
  accountId: string,
  queryClient: QueryClient,
  navigate: NavigateFunction,
  to = '/',
): Promise<void> {
  const account = useAccountStore
    .getState()
    .accounts.find((a) => a.id === accountId);
  if (!account) throw new Error('That account is no longer linked.');

  // Already signed in as this account — the only thing wrong is a dangling
  // `activeAccountId` (a previous switch that half-failed). Repair the pointer
  // in place; no token swap, no cache clear, no reload.
  if (useAuthStore.getState().user?.id === accountId) {
    useAccountStore.getState().setActiveAccountId(accountId);
    if (to !== '/') navigate(to, { replace: true });
    return;
  }

  // Refresh a token that is expired or within 30s of it before it goes live.
  let accessToken = account.accessToken;
  if (!accessToken || accessTokenExpiry(accessToken) - Date.now() < 30_000) {
    accessToken = await rotateAccount(account);
  }

  setAccessToken(accessToken);
  useAccountStore.getState().setActiveAccountId(accountId);
  useAuthStore.getState().setSession(account.user, accessToken);

  if (to === '/') {
    // Let the redirect resolve this account's first workspace rather than
    // bouncing to one it cannot see.
    for (const key of ACTIVE_WORKSPACE_KEYS) {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore storage errors
      }
    }
  }

  // Nothing cached under the previous identity may leak into this one.
  queryClient.clear();
  navigate(to, { replace: true });
}

/** The linked accounts and which one is active. */
export function useAccounts() {
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  return { accounts, activeAccountId };
}

function toAccountWorkspace(w: {
  id: string;
  name: string;
  slug: string;
  email?: string | null;
  icon?: string | null;
  iconColor?: string | null;
  avatarUrl?: string | null;
  memberCount: number;
}): AccountWorkspace {
  return {
    id: w.id,
    name: w.name,
    slug: w.slug,
    email: w.email ?? null,
    icon: w.icon ?? null,
    iconColor: w.iconColor ?? null,
    avatarUrl: w.avatarUrl ?? null,
    memberCount: w.memberCount,
  };
}

/**
 * Keeps every *background* account's cached workspace list fresh by fetching it
 * with that account's own token. The active account's list is already kept
 * current from the app shell's own `useWorkspaces` query.
 *
 * A failure (that account's token lapsed) is left alone — the switcher falls
 * back to the last list written to the account store, so both accounts'
 * workspaces stay visible regardless.
 */
export function useLinkedAccountWorkspaces(): void {
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const setAccountWorkspaces = useAccountStore((s) => s.setAccountWorkspaces);
  const authedUserId = useAuthStore((s) => s.user?.id);

  // The signed-in identity is active even if `activeAccountId` has not caught
  // up yet — its list already comes from the app's own query, so skip it here.
  const background = accounts.filter(
    (a) => a.id !== activeAccountId && a.id !== authedUserId,
  );

  useQueries({
    queries: background.map((account) => ({
      queryKey: ['linked-account-workspaces', account.id, account.accessToken],
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: false,
      refetchOnWindowFocus: false,
      queryFn: async () => {
        const list = await workspaceApi.listForAccount(account.accessToken);
        const slim = list.map(toAccountWorkspace);
        setAccountWorkspaces(account.id, slim);
        return slim;
      },
    })),
  });
}

/**
 * The current account may have been restored from the cookie this session and
 * never given a client-side refresh token. A following `login`/`register`
 * overwrites the browser's one refresh cookie, so the current account must
 * capture its own token first — while the cookie is still hers — or it cannot
 * be refreshed after the switch. Not best-effort: proceeding past a failure
 * here strands the current session.
 */
async function protectCurrentSession(): Promise<void> {
  const active = getActiveAccount();
  if (active && !active.refreshToken) {
    await rotateAccount(active);
  }
}

function registerAuthedAccount(data: {
  user: CurrentUser;
  accessToken: string;
  refreshToken?: string;
}): void {
  useAccountStore.getState().upsertAccount({
    id: data.user.id,
    user: data.user,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? '',
    addedAt: Date.now(),
  });
}

/**
 * Signs into a second identity with an existing password without disturbing the
 * current one, then switches to it. Surfaces {@link ApiError} so a form can show
 * field errors.
 */
export function useAddAccount() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (input: AddAccountInput): Promise<AuthResponse> => {
      await protectCurrentSession();
      const data = await authApi.login({ ...input, rememberMe: true });
      registerAuthedAccount(data);
      return data;
    },
    onSuccess: (data) => activateAccount(data.user.id, queryClient, navigate),
  });
}

/**
 * Creates a brand-new account without disturbing the current one, then switches
 * to it. A new account has no workspaces yet — the post-switch redirect lands on
 * the app's own first-run screen, which is where workspace creation lives.
 */
export function useSignUpAccount() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (input: SignUpAccountInput): Promise<AuthResponse> => {
      await protectCurrentSession();
      const data = await authApi.register(input);
      registerAuthedAccount(data);
      return data;
    },
    onSuccess: (data) => activateAccount(data.user.id, queryClient, navigate),
  });
}

/**
 * Switches to an already-linked account. Pass a bare id to land on that
 * account's default workspace, or `{ accountId, to }` to open a specific route
 * (used when a workspace is picked straight from the switcher).
 */
export function useSwitchAccount() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (input: string | { accountId: string; to?: string }) => {
      const { accountId, to } =
        typeof input === 'string' ? { accountId: input, to: undefined } : input;
      return activateAccount(accountId, queryClient, navigate, to);
    },
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
