import { ApiError, authApi, refreshSession, toApiError } from '@org/api-client';

/**
 * The browser half of "Sign in with browser" for the desktop app.
 *
 * The desktop shell opens `/login?desktop=true&state=…&code_challenge=…` (or
 * `/register?…`) in the system browser. Once the browser has a session it asks
 * the API for a one-time code bound to that PKCE challenge and hands it back
 * to the app through `onetab://auth/callback`. These helpers are the only
 * place that URL shape and those query parameters are spelled out.
 */

const DESKTOP_PROTOCOL = 'onetab';
const HANDOFF_KEYS = ['desktop', 'state', 'code_challenge', 'code_challenge_method'] as const;

export interface DesktopHandoff {
  state: string;
  codeChallenge: string;
}

/** The pending hand-off described by the current URL, if any. */
export function readDesktopHandoff(params: URLSearchParams): DesktopHandoff | null {
  if (params.get('desktop') !== 'true') return null;
  const state = params.get('state');
  const codeChallenge = params.get('code_challenge');
  return state && codeChallenge ? { state, codeChallenge } : null;
}

/**
 * Carries the hand-off parameters onto another auth page (login ↔ register),
 * so switching pages mid-flow still ends with the session going to the app.
 */
export function withDesktopHandoff(path: string, params: URLSearchParams): string {
  if (!readDesktopHandoff(params)) return path;
  const next = new URLSearchParams();
  for (const key of HANDOFF_KEYS) {
    const value = params.get(key);
    if (value) next.set(key, value);
  }
  return `${path}?${next.toString()}`;
}

export function desktopCallbackUrl(code: string, state: string): string {
  return `${DESKTOP_PROTOCOL}://auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
}

/** Tells the waiting desktop app the user abandoned sign-in in the browser. */
export function desktopCancelUrl(state: string): string {
  return `${DESKTOP_PROTOCOL}://auth/callback?error=cancelled&state=${encodeURIComponent(state)}`;
}

/**
 * HTTP status of a failed API call. `authApi` methods already throw an
 * `ApiError`, and `toApiError` only understands axios failures — handed an
 * `ApiError` it returns status 0 — so the error has to be read directly.
 */
function statusOf(error: unknown): number {
  return error instanceof ApiError ? error.status : toApiError(error).status;
}

/**
 * Mints the one-time code for the current browser session.
 *
 * The page treats a cached user as signed in the instant it loads, so this runs
 * with whatever access token the browser kept — and those last 15 minutes. The
 * 401 interceptor deliberately never retries `/auth/*` calls, so without the
 * renewal below a tab that had merely been idle failed with a bare
 * "Unauthorized" while its refresh cookie was perfectly good. A 401 that
 * survives the renewal is a genuinely signed-out browser and is rethrown as such.
 */
export async function authorizeDesktopHandoff(handoff: DesktopHandoff): Promise<string> {
  const mint = async () => {
    const { code } = await authApi.authorizeDesktop({
      state: handoff.state,
      codeChallenge: handoff.codeChallenge,
    });
    return desktopCallbackUrl(code, handoff.state);
  };

  try {
    return await mint();
  } catch (error) {
    if (statusOf(error) !== 401) throw error;
    await refreshSession();
    return mint();
  }
}

/** Whether a failed hand-off means this browser has no usable session left. */
export function isSignedOutError(error: unknown): boolean {
  return statusOf(error) === 401;
}
