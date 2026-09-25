import { authApi } from '@org/api-client';

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

/** Mints the one-time code for the current browser session. */
export async function authorizeDesktopHandoff(handoff: DesktopHandoff): Promise<string> {
  const { code } = await authApi.authorizeDesktop({
    state: handoff.state,
    codeChallenge: handoff.codeChallenge,
  });
  return desktopCallbackUrl(code, handoff.state);
}
