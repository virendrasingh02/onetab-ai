import type { CurrentUser } from '@org/types';
import { create } from 'zustand';

/**
 * The linked accounts for a browser multi-account session.
 *
 * Unlike {@link useAuthStore}, which holds only the *active* identity, this
 * store keeps every signed-in account so the switcher can move between them
 * without a fresh login.
 *
 * SECURITY NOTE — refresh tokens are persisted here in `localStorage`, not in
 * an httpOnly cookie. A browser holds exactly one refresh cookie, so every
 * account past the first has nowhere else to keep its token; the switcher
 * cannot work without it. This widens the blast radius of an XSS bug to "all
 * linked sessions" and is a deliberate, product-level trade-off — the same one
 * the desktop shell already makes with its persisted `safeStorage` session.
 * The active account still also has its normal refresh cookie.
 */
/**
 * The slice of a workspace the switcher needs to list and open one that belongs
 * to a *background* account — cached because that account's full list can only
 * be fetched with its own token, which is not the one on the wire.
 */
export interface AccountWorkspace {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  icon: string | null;
  iconColor: string | null;
  avatarUrl: string | null;
  memberCount: number;
}

export interface Account {
  /** The user id — stable, and what the switcher addresses an account by. */
  id: string;
  user: CurrentUser;
  accessToken: string;
  /**
   * Empty only for the cookie-restored primary account before its first
   * rotation — the refresh provider backfills it from the response then.
   */
  refreshToken: string;
  /** Epoch ms; orders the list and picks a fallback when the active one leaves. */
  addedAt: number;
  /**
   * Last-known workspaces for this account, refreshed while it is active. Lets
   * the switcher list every account's workspaces in one grouped menu; may be
   * absent on rows written before this field existed.
   */
  workspaces?: AccountWorkspace[];
}

interface AccountState {
  accounts: Account[];
  activeAccountId: string | null;

  /** Adds a new account or replaces an existing one (matched by `id`). */
  upsertAccount: (account: Account) => void;
  /** Patches just the tokens of one account after a rotation. */
  updateAccountTokens: (
    id: string,
    tokens: { accessToken: string; refreshToken?: string },
  ) => void;
  /** Caches the workspace list for one account (the active one, in practice). */
  setAccountWorkspaces: (id: string, workspaces: AccountWorkspace[]) => void;
  removeAccount: (id: string) => void;
  setActiveAccountId: (id: string) => void;
  /** Full sign-out: drops every linked account. */
  clearAll: () => void;
}

const STORAGE_KEY = 'onetab_accounts';

interface PersistedShape {
  accounts: Account[];
  activeAccountId: string | null;
}

function readPersisted(): PersistedShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { accounts: [], activeAccountId: null };
    const parsed = JSON.parse(raw) as Partial<PersistedShape>;
    return {
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      activeAccountId: parsed.activeAccountId ?? null,
    };
  } catch {
    return { accounts: [], activeAccountId: null };
  }
}

function persist(state: PersistedShape): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accounts: state.accounts,
        activeAccountId: state.activeAccountId,
      }),
    );
  } catch {
    // Storage can be blocked by policy; the in-memory copy still works.
  }
}

const initial = readPersisted();

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: initial.accounts,
  activeAccountId: initial.activeAccountId,

  upsertAccount: (account) => {
    const accounts = [
      ...get().accounts.filter((a) => a.id !== account.id),
      account,
    ].sort((a, b) => a.addedAt - b.addedAt);
    persist({ accounts, activeAccountId: get().activeAccountId });
    set({ accounts });
  },

  updateAccountTokens: (id, tokens) => {
    const accounts = get().accounts.map((a) =>
      a.id === id
        ? {
            ...a,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken ?? a.refreshToken,
          }
        : a,
    );
    persist({ accounts, activeAccountId: get().activeAccountId });
    set({ accounts });
  },

  setAccountWorkspaces: (id, workspaces) => {
    const current = get().accounts.find((a) => a.id === id);
    if (!current) return;
    // Skip a rewrite (and a localStorage hit) when nothing actually changed —
    // the active account's list re-resolves on every refetch.
    if (JSON.stringify(current.workspaces ?? []) === JSON.stringify(workspaces)) {
      return;
    }
    const accounts = get().accounts.map((a) =>
      a.id === id ? { ...a, workspaces } : a,
    );
    persist({ accounts, activeAccountId: get().activeAccountId });
    set({ accounts });
  },

  removeAccount: (id) => {
    const accounts = get().accounts.filter((a) => a.id !== id);
    const activeAccountId =
      get().activeAccountId === id ? null : get().activeAccountId;
    persist({ accounts, activeAccountId });
    set({ accounts, activeAccountId });
  },

  setActiveAccountId: (id) => {
    persist({ accounts: get().accounts, activeAccountId: id });
    set({ activeAccountId: id });
  },

  clearAll: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
    set({ accounts: [], activeAccountId: null });
  },
}));

/** Selectors — subscribe narrowly to avoid re-rendering on unrelated changes. */
export const selectAccounts = (state: AccountState) => state.accounts;
export const selectActiveAccountId = (state: AccountState) =>
  state.activeAccountId;
export const selectActiveAccount = (state: AccountState) =>
  state.accounts.find((a) => a.id === state.activeAccountId) ?? null;

/** The active account outside React (refresh provider, switch routine). */
export function getActiveAccount(): Account | null {
  const { accounts, activeAccountId } = useAccountStore.getState();
  return accounts.find((a) => a.id === activeAccountId) ?? null;
}

/**
 * Keeps the active account's row in step with {@link useAuthStore} when the
 * profile is edited or the access token is renewed. A no-op when there is no
 * multi-account state yet (the row is created on login / bootstrap instead), so
 * `auth.store` can call this unconditionally.
 */
export function syncActiveAccount(
  user: CurrentUser,
  accessToken: string,
): void {
  const { accounts, activeAccountId } = useAccountStore.getState();
  if (!activeAccountId || !accounts.some((a) => a.id === activeAccountId)) {
    return;
  }
  const next = accounts.map((a) =>
    a.id === activeAccountId ? { ...a, user, accessToken } : a,
  );
  persist({ accounts: next, activeAccountId });
  useAccountStore.setState({ accounts: next });
}

/*
 * Another tab switched account: its data, caches and routes are all for the
 * previous identity, and there is no safe partial re-render — the whole app is
 * account-scoped. A reload is what every comparable product (Slack, Google)
 * does here. Mirrors the token `storage` listener in the api-client.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || event.storageArea !== localStorage) return;
    let nextActive: string | null;
    try {
      nextActive = event.newValue
        ? (JSON.parse(event.newValue) as PersistedShape).activeAccountId
        : null;
    } catch {
      return;
    }
    if (nextActive !== useAccountStore.getState().activeAccountId) {
      window.location.reload();
    }
  });
}
