import { app, safeStorage, shell } from 'electron';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  DesktopAuthFlowStatus,
  DesktopAuthSession,
  DesktopBrowserAuthIntent,
} from '../shared/ipc.js';
import { IPC_EVENT } from '../shared/ipc.js';
import { logger } from './logger.js';
import { getMainWindow, showMainWindow } from './window.js';

interface PendingPKCE {
  verifier: string;
  challenge: string;
  state: string;
  createdAt: number;
}

interface StoredEncryptedSession {
  user: DesktopAuthSession['user'];
  /**
   * @deprecated Pre-encryption plaintext field. Still *read* so an existing
   * install is migrated on its next save, never written any more.
   */
  accessToken?: string | null;
  encryptedAccessToken?: string; // base64 of safeStorage encrypted buffer
  plainAccessToken?: string; // read once to migrate old files, never written
  encryptedRefreshToken?: string; // base64 of safeStorage encrypted buffer
  plainRefreshToken?: string; // read once to migrate old files, never written
}

let pendingPKCE: PendingPKCE | null = null;
let currentSession: DesktopAuthSession | null = null;
/** Bumped on every sign-in/out so a slow disk read can tell it was overtaken. */
let sessionEpoch = 0;
let configuredApiUrl = 'http://localhost:3000/api/v1';

export function setApiUrlForAuth(url: string): void {
  configuredApiUrl = url;
}

function sessionFilePath(): string {
  return join(app.getPath('userData'), 'onetab-auth-session.json');
}

const REFRESH_COOKIE_NAME = 'onetab_rt';

/** Pulls the rotated refresh-token value out of a `Set-Cookie` response. */
function extractRefreshToken(response: Response): string | null {
  const getSetCookie = (
    response.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie?.bind(response.headers);
  const cookies = getSetCookie
    ? getSetCookie()
    : [response.headers.get('set-cookie') ?? ''];

  for (const cookie of cookies) {
    const match = new RegExp(`(?:^|;\\s*)${REFRESH_COOKIE_NAME}=([^;]+)`).exec(
      cookie,
    );
    if (match) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
  }
  return null;
}

/** Generates high-entropy PKCE pair (RFC 7636 S256). */
export function generatePKCE(): {
  verifier: string;
  challenge: string;
  state: string;
} {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(24).toString('base64url');
  return { verifier, challenge, state };
}

/**
 * On Linux with no keyring Electron reports encryption as available but uses a
 * hardcoded password (the `basic_text` backend), which protects nothing.
 */
async function hasRealEncryption(): Promise<boolean> {
  if (!(await safeStorage.isAsyncEncryptionAvailable())) return false;
  return (
    process.platform !== 'linux' ||
    safeStorage.getSelectedStorageBackend() !== 'basic_text'
  );
}

/** Safely encrypts a secret using Electron's native OS credential store. */
async function encryptSecret(
  plaintext: string,
): Promise<{ encrypted?: string }> {
  try {
    if (await hasRealEncryption()) {
      const buffer = await safeStorage.encryptStringAsync(plaintext);
      return { encrypted: buffer.toString('base64') };
    }
  } catch (err) {
    logger.warn('Auth', 'safeStorage encryption failed', err);
  }
  // Never written in the clear: the session then lasts until the app quits.
  return {};
}

/**
 * Safely decrypts a secret using Electron's native OS credential store.
 * `reEncrypt` is set when the OS key rotated and the stored value should be rewritten.
 */
async function decryptSecret(record: {
  encrypted?: string;
  plain?: string;
}): Promise<{ value: string | null; reEncrypt?: boolean }> {
  if (record.encrypted) {
    try {
      if (await safeStorage.isAsyncEncryptionAvailable()) {
        const buffer = Buffer.from(record.encrypted, 'base64');
        const { result, shouldReEncrypt } =
          await safeStorage.decryptStringAsync(buffer);
        return { value: result, reEncrypt: shouldReEncrypt };
      }
    } catch (err) {
      logger.error(
        'Auth',
        'Failed to decrypt secure token with safeStorage',
        err,
      );
    }
  }
  return { value: record.plain ?? null };
}

/** Writes are serialised so an older, slower encryption can never land after a newer one. */
let writeChain: Promise<void> = Promise.resolve();

async function persistSession(session: DesktopAuthSession): Promise<void> {
  try {
    const refreshRecord = session.refreshToken
      ? await encryptSecret(session.refreshToken)
      : {};
    // The access token is short-lived but was previously written to disk in
    // clear text — encrypt it at rest too (DPAPI / Keychain / libsecret) so
    // nothing sensitive sits plainly in `onetab-auth-session.json`.
    const accessRecord = session.accessToken
      ? await encryptSecret(session.accessToken)
      : {};

    // Signed out (or replaced) while encrypting: this write is stale.
    if (currentSession !== session) return;

    const payload: StoredEncryptedSession = {
      user: session.user,
      encryptedAccessToken: accessRecord.encrypted,
      encryptedRefreshToken: refreshRecord.encrypted,
    };

    writeFileSync(sessionFilePath(), JSON.stringify(payload, null, 2), 'utf8');
    logger.info('Auth', 'Secure session persisted successfully');
  } catch (error) {
    logger.error('Auth', 'Failed to persist secure session', error);
  }
}

/** Updates the in-memory session at once; resolves when it is on disk. */
export function saveSecureSession(session: DesktopAuthSession): Promise<void> {
  currentSession = session;
  sessionEpoch += 1;
  writeChain = writeChain.then(() => persistSession(session));
  return writeChain;
}

let loading: Promise<DesktopAuthSession | null> | null = null;

export function loadSecureSession(): Promise<DesktopAuthSession | null> {
  if (currentSession) return Promise.resolve(currentSession);
  // Concurrent callers at startup share one read/decrypt.
  loading ??= readSessionFromDisk().finally(() => {
    loading = null;
  });
  return loading;
}

async function readSessionFromDisk(): Promise<DesktopAuthSession | null> {
  const epoch = sessionEpoch;
  const path = sessionFilePath();
  if (!existsSync(path)) return null;

  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as StoredEncryptedSession;

    const refresh = await decryptSecret({
      encrypted: parsed.encryptedRefreshToken,
      plain: parsed.plainRefreshToken,
    });
    const access = await decryptSecret({
      encrypted: parsed.encryptedAccessToken,
      plain: parsed.plainAccessToken,
    });

    // Signed in or out while this was decrypting: the newer state wins.
    if (epoch !== sessionEpoch) return currentSession;

    const session: DesktopAuthSession = {
      user: parsed.user,
      // Migrate a file written before the access token was encrypted.
      accessToken: access.value ?? parsed.accessToken ?? null,
      refreshToken: refresh.value,
    };
    currentSession = session;

    // A file from an older build may hold tokens in the clear, or the OS key
    // may have rotated: rewrite it now.
    if (
      parsed.plainRefreshToken ||
      parsed.plainAccessToken ||
      parsed.accessToken ||
      refresh.reEncrypt ||
      access.reEncrypt
    ) {
      void saveSecureSession(session);
    }

    logger.info('Auth', 'Secure session loaded from disk');
    return session;
  } catch (error) {
    logger.warn('Auth', 'Could not read stored session, starting fresh', error);
    return null;
  }
}

export function clearSecureSession(): void {
  currentSession = null;
  sessionEpoch += 1;
  const path = sessionFilePath();
  try {
    if (existsSync(path)) {
      unlinkSync(path);
    }
    logger.info('Auth', 'Secure session cleared');
  } catch (error) {
    logger.error('Auth', 'Error deleting session file', error);
  }
}

let refreshInFlight: Promise<DesktopAuthSession | null> | null = null;

/**
 * Renews the stored session's access token via the stored refresh token.
 *
 * `/auth/refresh` only ever reads its refresh token from an httpOnly cookie —
 * there is no request-body alternative — so the only way to present ours
 * (persisted from the original `/auth/desktop/exchange`, never seen by any
 * browser) is to set the `Cookie` header ourselves. The endpoint always
 * rotates the token on success, so the rotated value out of `Set-Cookie` has
 * to be captured and persisted too: resending the spent one on the next
 * refresh reads as a stolen token and revokes every session for the user, not
 * just this one.
 *
 * That replay check is also why concurrent callers must share one in-flight
 * request rather than each firing their own: the bootstrap effect, the chat
 * provider's own retry, and any other 401 all reach for this at once, and two
 * requests racing on the same still-unrotated token would make the second one
 * look exactly like a replay — the whole point this function exists to avoid.
 *
 * Returns `null` for anything that isn't a definitive rejection (offline, API
 * mid-restart) so the caller can leave the stored session alone and try
 * again later; throws only when the API actually refused the refresh token.
 */
export function refreshSecureSession(): Promise<DesktopAuthSession | null> {
  refreshInFlight ??= doRefreshSecureSession().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefreshSecureSession(): Promise<DesktopAuthSession | null> {
  const stored = await loadSecureSession();
  if (!stored?.refreshToken) return null;

  let response: Response;
  try {
    response = await fetch(
      `${configuredApiUrl.replace(/\/+$/, '')}/auth/refresh`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${REFRESH_COOKIE_NAME}=${stored.refreshToken}`,
        },
      },
    );
  } catch (error) {
    logger.warn(
      'Auth',
      'Desktop session refresh could not reach the API',
      error,
    );
    return null;
  }

  if (response.status === 401 || response.status === 403) {
    logger.warn(
      'Auth',
      'Desktop refresh token was rejected; clearing stored session',
    );
    clearSecureSession();
    throw new Error(`Refresh rejected with status ${response.status}`);
  }

  if (!response.ok) {
    logger.warn(
      'Auth',
      `Desktop session refresh failed with status ${response.status}`,
    );
    return null;
  }

  try {
    const data = (await response.json()) as { accessToken: string };
    const rotatedRefreshToken =
      extractRefreshToken(response) ?? stored.refreshToken;

    const session: DesktopAuthSession = {
      user: stored.user,
      accessToken: data.accessToken,
      refreshToken: rotatedRefreshToken,
    };

    await saveSecureSession(session);
    logger.info('Auth', 'Desktop session refreshed successfully');
    return session;
  } catch (error) {
    logger.warn(
      'Auth',
      'Desktop session refresh returned an unreadable response',
      error,
    );
    return null;
  }
}

/**
 * How long a browser sign-in may take. Past this the pending PKCE pair is
 * dropped: a callback that arrives later is treated as expired rather than
 * silently accepted, and the sign-in screen stops saying "waiting".
 */
export const BROWSER_LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

let pendingTimer: ReturnType<typeof setTimeout> | null = null;
/** When the last browser sign-in completed, to recognise a duplicate callback. */
let lastLoginSucceededAt = 0;
const DUPLICATE_CALLBACK_WINDOW_MS = 30_000;

function emitFlowStatus(status: DesktopAuthFlowStatus): void {
  const window = getMainWindow();
  if (window && !window.isDestroyed()) {
    window.webContents.send(IPC_EVENT.authFlowStatus, status);
  }
}

function clearPendingLogin(): void {
  pendingPKCE = null;
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}

/**
 * Opens the user's default browser on the web sign-in page with a fresh PKCE
 * challenge. The browser is the only sign-in surface: every method the web
 * app supports (password, magic link, SSO, 2FA, passkeys) works there without
 * the desktop shell re-implementing any of it. A second call replaces the
 * pending attempt, so "Open browser again" never leaves two valid challenges.
 */
export async function startBrowserLogin(
  webAppUrl: string,
  intent: DesktopBrowserAuthIntent = 'sign-in',
): Promise<boolean> {
  clearPendingLogin();
  const pkce = generatePKCE();
  pendingPKCE = { ...pkce, createdAt: Date.now() };
  pendingTimer = setTimeout(() => {
    if (!pendingPKCE) return;
    logger.warn('Auth', 'Browser login timed out waiting for the callback');
    clearPendingLogin();
    emitFlowStatus({
      state: 'timeout',
      message: 'Sign-in timed out. Start again when you are ready.',
    });
  }, BROWSER_LOGIN_TIMEOUT_MS);

  const targetUrl = new URL(
    intent === 'sign-up' ? '/register' : '/login',
    webAppUrl,
  );
  targetUrl.searchParams.set('desktop', 'true');
  targetUrl.searchParams.set('state', pkce.state);
  targetUrl.searchParams.set('code_challenge', pkce.challenge);
  targetUrl.searchParams.set('code_challenge_method', 'S256');

  logger.info('Auth', 'Starting browser login flow', {
    url: targetUrl.origin + targetUrl.pathname,
  });
  try {
    await shell.openExternal(targetUrl.toString());
  } catch (error) {
    logger.error(
      'Auth',
      'Could not open the system browser for sign-in',
      error,
    );
    clearPendingLogin();
    emitFlowStatus({
      state: 'error',
      message:
        'Could not open your browser. Check that a default browser is set.',
    });
    return false;
  }

  emitFlowStatus({ state: 'waiting' });
  return true;
}

/** Abandons the pending browser sign-in (the "Cancel" on the waiting screen). */
export function cancelBrowserLogin(): void {
  if (!pendingPKCE) return;
  clearPendingLogin();
  logger.info('Auth', 'Browser login cancelled from the desktop app');
  emitFlowStatus({ state: 'cancelled' });
}

/**
 * The browser reported that sign-in did not complete
 * (`onetab://auth/callback?error=…&state=…`), e.g. the user pressed "Cancel"
 * on the hand-off page. A mismatched state belongs to some other attempt and
 * is ignored.
 */
export function handleAuthCallbackError(
  error: string,
  state: string | undefined,
): void {
  if (!pendingPKCE || (state && pendingPKCE.state !== state)) {
    logger.warn(
      'Auth',
      'Ignoring an auth error callback for no pending attempt',
    );
    return;
  }
  clearPendingLogin();
  const cancelled = error === 'cancelled' || error === 'access_denied';
  logger.info('Auth', `Browser login ended without a session: ${error}`);
  emitFlowStatus(
    cancelled
      ? { state: 'cancelled', message: 'Sign-in was cancelled in the browser.' }
      : {
          state: 'error',
          message: 'Sign-in could not be completed in the browser.',
        },
  );
}

/** Handles the desktop authorization callback deep-link (e.g. onetab://auth/callback?code=...&state=...) */
export async function handleAuthCallback(
  code: string,
  state: string,
  apiBaseUrl: string,
): Promise<boolean> {
  logger.info('Auth', 'Handling auth callback in main process');

  if (!pendingPKCE) {
    // A second copy of a callback that just succeeded (a re-clicked "Open
    // Onetab AI Desktop", a browser that fired the link twice): the app is
    // already signed in, so reporting "expired" would only confuse.
    if (Date.now() - lastLoginSucceededAt < DUPLICATE_CALLBACK_WINDOW_MS) {
      logger.info(
        'Auth',
        'Ignoring a duplicate callback for a completed sign-in',
      );
      return false;
    }
    // Already consumed, timed out, or from a previous launch of the app.
    logger.warn('Auth', 'No pending PKCE state found for callback');
    emitFlowStatus({
      state: 'expired',
      message:
        'That sign-in link has expired or was already used. Start again from the app.',
    });
    return false;
  }

  if (pendingPKCE.state !== state) {
    // Leave the pending attempt intact: this callback belongs to another one.
    logger.warn('Auth', 'State mismatch in callback');
    emitFlowStatus({
      state: 'error',
      message:
        'That sign-in link belongs to a different attempt. Use the most recent browser tab.',
    });
    return false;
  }

  if (Date.now() - pendingPKCE.createdAt > BROWSER_LOGIN_TIMEOUT_MS) {
    clearPendingLogin();
    emitFlowStatus({
      state: 'expired',
      message: 'That sign-in took too long. Start again.',
    });
    return false;
  }

  const verifier = pendingPKCE.verifier;
  clearPendingLogin(); // Consume PKCE — a code is single-use either way.

  try {
    const exchangeUrl = `${apiBaseUrl.replace(/\/+$/, '')}/auth/desktop/exchange`;
    const response = await fetch(exchangeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        codeVerifier: verifier,
        state,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      logger.error(
        'Auth',
        `Exchange failed with status ${response.status}: ${errBody}`,
      );
      const expired = [400, 401, 403, 404, 410].includes(response.status);
      emitFlowStatus(
        expired
          ? {
              state: 'expired',
              message:
                'That sign-in code expired before the app could use it. Start again.',
            }
          : {
              state: 'error',
              message:
                'The server could not complete sign-in. Try again in a moment.',
            },
      );
      return false;
    }

    const data = (await response.json()) as {
      user: DesktopAuthSession['user'];
      accessToken: string;
      refreshToken: string;
    };

    const session: DesktopAuthSession = {
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };

    await saveSecureSession(session);

    showMainWindow();
    const window = getMainWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send(IPC_EVENT.authSessionChanged, session);
    }
    lastLoginSucceededAt = Date.now();
    emitFlowStatus({ state: 'success' });

    logger.info('Auth', 'Browser login completed successfully for desktop');
    return true;
  } catch (error) {
    logger.error('Auth', 'Failed to exchange auth code with API', error);
    emitFlowStatus({
      state: 'error',
      message:
        'Could not reach the server to finish signing in. Check your connection and try again.',
    });
    return false;
  }
}
