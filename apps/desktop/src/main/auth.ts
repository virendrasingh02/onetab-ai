import { app, safeStorage, shell } from 'electron';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DesktopAuthSession } from '../shared/ipc.js';
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
  accessToken: string | null;
  encryptedRefreshToken?: string; // base64 of safeStorage encrypted buffer
  plainRefreshToken?: string; // fallback if safeStorage is unavailable in environment
}

let pendingPKCE: PendingPKCE | null = null;
let currentSession: DesktopAuthSession | null = null;
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
  const cookies = getSetCookie ? getSetCookie() : [response.headers.get('set-cookie') ?? ''];

  for (const cookie of cookies) {
    const match = new RegExp(`(?:^|;\\s*)${REFRESH_COOKIE_NAME}=([^;]+)`).exec(cookie);
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
export function generatePKCE(): { verifier: string; challenge: string; state: string } {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(24).toString('base64url');
  return { verifier, challenge, state };
}

/** Safely encrypts a secret using Electron's native OS credential store. */
function encryptSecret(plaintext: string): { encrypted?: string; plain?: string } {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = safeStorage.encryptString(plaintext);
      return { encrypted: buffer.toString('base64') };
    }
  } catch (err) {
    logger.warn('Auth', 'safeStorage encryption failed, using fallback protection', err);
  }
  return { plain: plaintext };
}

/** Safely decrypts a secret using Electron's native OS credential store. */
function decryptSecret(record: { encrypted?: string; plain?: string }): string | null {
  if (record.encrypted) {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const buffer = Buffer.from(record.encrypted, 'base64');
        return safeStorage.decryptString(buffer);
      }
    } catch (err) {
      logger.error('Auth', 'Failed to decrypt secure token with safeStorage', err);
    }
  }
  return record.plain ?? null;
}

export function saveSecureSession(session: DesktopAuthSession): void {
  currentSession = session;
  const path = sessionFilePath();

  try {
    let encryptedRecord: { encrypted?: string; plain?: string } = {};
    if (session.refreshToken) {
      encryptedRecord = encryptSecret(session.refreshToken);
    }

    const payload: StoredEncryptedSession = {
      user: session.user,
      accessToken: session.accessToken,
      encryptedRefreshToken: encryptedRecord.encrypted,
      plainRefreshToken: encryptedRecord.plain,
    };

    writeFileSync(path, JSON.stringify(payload, null, 2), 'utf8');
    logger.info('Auth', 'Secure session persisted successfully');
  } catch (error) {
    logger.error('Auth', 'Failed to persist secure session', error);
  }
}

export function loadSecureSession(): DesktopAuthSession | null {
  if (currentSession) return currentSession;

  const path = sessionFilePath();
  if (!existsSync(path)) return null;

  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as StoredEncryptedSession;

    const refreshToken = decryptSecret({
      encrypted: parsed.encryptedRefreshToken,
      plain: parsed.plainRefreshToken,
    });

    currentSession = {
      user: parsed.user,
      accessToken: parsed.accessToken,
      refreshToken,
    };

    logger.info('Auth', 'Secure session loaded from disk');
    return currentSession;
  } catch (error) {
    logger.warn('Auth', 'Could not read stored session, starting fresh', error);
    return null;
  }
}

export function clearSecureSession(): void {
  currentSession = null;
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
  const stored = loadSecureSession();
  if (!stored?.refreshToken) return null;

  let response: Response;
  try {
    response = await fetch(`${configuredApiUrl.replace(/\/+$/, '')}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${REFRESH_COOKIE_NAME}=${stored.refreshToken}`,
      },
    });
  } catch (error) {
    logger.warn('Auth', 'Desktop session refresh could not reach the API', error);
    return null;
  }

  if (response.status === 401 || response.status === 403) {
    logger.warn('Auth', 'Desktop refresh token was rejected; clearing stored session');
    clearSecureSession();
    throw new Error(`Refresh rejected with status ${response.status}`);
  }

  if (!response.ok) {
    logger.warn('Auth', `Desktop session refresh failed with status ${response.status}`);
    return null;
  }

  try {
    const data = (await response.json()) as { accessToken: string };
    const rotatedRefreshToken = extractRefreshToken(response) ?? stored.refreshToken;

    const session: DesktopAuthSession = {
      user: stored.user,
      accessToken: data.accessToken,
      refreshToken: rotatedRefreshToken,
    };

    saveSecureSession(session);
    logger.info('Auth', 'Desktop session refreshed successfully');
    return session;
  } catch (error) {
    logger.warn('Auth', 'Desktop session refresh returned an unreadable response', error);
    return null;
  }
}

export async function startBrowserLogin(webAppUrl: string): Promise<boolean> {
  const pkce = generatePKCE();
  pendingPKCE = { ...pkce, createdAt: Date.now() };

  const targetUrl = new URL('/login', webAppUrl);
  targetUrl.searchParams.set('desktop', 'true');
  targetUrl.searchParams.set('state', pkce.state);
  targetUrl.searchParams.set('code_challenge', pkce.challenge);
  targetUrl.searchParams.set('code_challenge_method', 'S256');

  logger.info('Auth', 'Starting browser login flow', { url: targetUrl.origin + targetUrl.pathname });
  await shell.openExternal(targetUrl.toString());
  return true;
}

/** Handles the desktop authorization callback deep-link (e.g. onetab://auth/callback?code=...&state=...) */
export async function handleAuthCallback(
  code: string,
  state: string,
  apiBaseUrl: string,
): Promise<boolean> {
  logger.info('Auth', 'Handling auth callback in main process');

  if (!pendingPKCE) {
    logger.warn('Auth', 'No pending PKCE state found for callback');
    return false;
  }

  if (pendingPKCE.state !== state) {
    logger.warn('Auth', 'State mismatch in callback');
    return false;
  }

  const verifier = pendingPKCE.verifier;
  pendingPKCE = null; // Consume PKCE

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
      logger.error('Auth', `Exchange failed with status ${response.status}: ${errBody}`);
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

    saveSecureSession(session);

    showMainWindow();
    const window = getMainWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send(IPC_EVENT.authSessionChanged, session);
    }

    logger.info('Auth', 'Browser login completed successfully for desktop');
    return true;
  } catch (error) {
    logger.error('Auth', 'Failed to exchange auth code with API', error);
    return false;
  }
}
