/**
 * Token persistence and refresh for the mobile session. Platform-free: the
 * secure store and the refresh call are injected, so the rotation rules are
 * unit tested without a device.
 *
 * Browsers keep the refresh token in an httpOnly cookie; a phone has no shared
 * cookie jar, so — like the desktop shell — the app keeps the refresh token in
 * the OS keychain/keystore and presents it in the `/auth/refresh` body, which
 * the API already accepts. The access token lives in memory only.
 *
 * The web build (react-native-web) is a browser, so it does what the web app
 * does instead: the refresh token stays in the API's httpOnly cookie, out of
 * reach of page scripts, and only a non-secret "has a session" marker is
 * stored locally so a cold start knows whether to try refreshing.
 */

/**
 * `token`: the refresh token is stored (keychain/keystore) and sent in the
 * body. `cookie`: the browser's httpOnly cookie carries it; nothing secret is
 * stored.
 */
export type RefreshMode = 'token' | 'cookie';

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const STORAGE_KEYS = {
  refreshToken: 'onetab.refreshToken',
  userId: 'onetab.userId',
  workspaceId: 'onetab.workspaceId',
  biometricLock: 'onetab.biometricLock',
  pushRegistrationId: 'onetab.pushRegistrationId',
  matrixSession: 'onetab.matrixSession',
  /** Web only: a session cookie was issued. Not a credential. */
  cookieSession: 'onetab.cookieSession',
} as const;

export interface IssuedTokens {
  accessToken: string;
  refreshToken?: string;
}

/** Thrown when there is nothing to refresh with, or the API refused it. */
export class RefreshRejected extends Error {}

export async function persistTokens(
  store: KeyValueStore,
  tokens: IssuedTokens,
  mode: RefreshMode = 'token',
): Promise<void> {
  if (mode === 'cookie') {
    // The cookie holds the token; the body copy is deliberately dropped.
    await store.set(STORAGE_KEYS.cookieSession, '1');
    return;
  }
  if (tokens.refreshToken) {
    await store.set(STORAGE_KEYS.refreshToken, tokens.refreshToken);
  }
}

/** Whether a cold start has a session worth trying to restore. */
export async function hasStoredSession(
  store: KeyValueStore,
  mode: RefreshMode,
): Promise<boolean> {
  const key =
    mode === 'cookie' ? STORAGE_KEYS.cookieSession : STORAGE_KEYS.refreshToken;
  return Boolean(await store.get(key));
}

/** Everything tied to the signed-in person. The biometric choice is per device and stays. */
export async function clearSessionStorage(store: KeyValueStore): Promise<void> {
  await Promise.all([
    store.remove(STORAGE_KEYS.refreshToken),
    store.remove(STORAGE_KEYS.cookieSession),
    store.remove(STORAGE_KEYS.userId),
    store.remove(STORAGE_KEYS.workspaceId),
    store.remove(STORAGE_KEYS.pushRegistrationId),
    store.remove(STORAGE_KEYS.matrixSession),
  ]);
}

/**
 * Builds the function `@org/api-client` calls when an access token expires.
 *
 * The API rotates the refresh token on every use and treats a replayed one as
 * theft (revoking every session), so the rotated token must be persisted
 * before the new access token is handed back. `@org/api-client` already
 * serialises concurrent refreshes into one call.
 *
 * `isRejection` tells a definitive refusal (401/403) from a network blip: only
 * the former may sign the person out.
 */
export function createRefreshProvider(deps: {
  store: KeyValueStore;
  refresh: (refreshToken: string) => Promise<IssuedTokens>;
  isRejection: (error: unknown) => boolean;
  toRejection: (message: string) => Error;
}): () => Promise<string> {
  return async () => {
    const refreshToken = await deps.store.get(STORAGE_KEYS.refreshToken);
    if (!refreshToken) throw deps.toRejection('No stored session.');

    let tokens: IssuedTokens;
    try {
      tokens = await deps.refresh(refreshToken);
    } catch (error) {
      if (deps.isRejection(error)) {
        await deps.store.remove(STORAGE_KEYS.refreshToken);
        throw deps.toRejection('The session was revoked.');
      }
      throw error;
    }

    await persistTokens(deps.store, tokens);
    return tokens.accessToken;
  };
}

export function isAuthRejection(error: unknown): boolean {
  const status =
    (error as { status?: unknown } | null)?.status ??
    (error as { response?: { status?: unknown } } | null)?.response?.status;
  return status === 401 || status === 403;
}
