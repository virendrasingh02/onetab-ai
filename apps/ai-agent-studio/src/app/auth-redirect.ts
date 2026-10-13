/**
 * Where Agent Studio sends a visitor who isn't signed in, and the guard that
 * keeps that from turning into a redirect loop.
 *
 * Studio has no sign-in form of its own: the platform's web app owns every
 * sign-in method (password, magic link, SSO, 2FA). A signed-out visitor is
 * sent there with `returnTo` set to the page they asked for, and the web app
 * either shows its form or — when they are already signed in — bounces them
 * straight back with the session attached.
 */

export const WEB_APP_URL: string =
  (import.meta.env?.['VITE_WEB_APP_URL'] as string | undefined) ??
  'http://localhost:4200';

const MARK_KEY = 'onetab_studio_login_redirect_at';
const ENTERED_KEY = 'onetab_studio_entered_via_main_app';

/**
 * How long after leaving for sign-in a signed-out return counts as "the
 * sign-in didn't carry over" rather than a fresh visit. Long enough for a
 * slow sign-in with two-factor, short enough that coming back to a stale tab
 * later still redirects on its own.
 */
export const LOGIN_RETURN_WINDOW_MS = 3 * 60_000;

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null; // blocked by policy
  }
}

/** The web app's sign-in URL, returning here (the current page by default). */
export function buildLoginUrl(
  returnTo: string = typeof window === 'undefined' ? '' : window.location.href,
  webAppUrl: string = WEB_APP_URL,
): string {
  const base = webAppUrl.replace(/\/+$/, '');
  return returnTo
    ? `${base}/login?returnTo=${encodeURIComponent(returnTo)}`
    : `${base}/login`;
}

/**
 * The web app's sign-out URL. The session is shared, so signing out has to end
 * it there too — otherwise its sign-in page finds a live session and returns
 * the visitor straight back in.
 */
export function buildLogoutUrl(
  returnTo: string = typeof window === 'undefined' ? '' : `${window.location.origin}/`,
  webAppUrl: string = WEB_APP_URL,
): string {
  const base = webAppUrl.replace(/\/+$/, '');
  return returnTo
    ? `${base}/logout?returnTo=${encodeURIComponent(returnTo)}`
    : `${base}/logout`;
}

/** Remembers that this tab just left for sign-in. */
export function markLoginRedirect(now: number = Date.now()): void {
  try {
    storage()?.setItem(MARK_KEY, String(now));
  } catch {
    // Without storage the guard is off; the redirect still works.
  }
}

/** Whether this tab left for sign-in a moment ago and came back signed out. */
export function cameBackFromLogin(now: number = Date.now()): boolean {
  try {
    const at = Number(storage()?.getItem(MARK_KEY));
    return Number.isFinite(at) && at > 0 && now - at >= 0 && now - at < LOGIN_RETURN_WINDOW_MS;
  } catch {
    return false;
  }
}

export function clearLoginRedirect(): void {
  try {
    storage()?.removeItem(MARK_KEY);
  } catch {
    // ignore
  }
}

/**
 * Whether this tab has already been through the main web app. Studio always
 * starts there — signed in or not — so a fresh tab without this mark is sent
 * to the web app first; a reload inside the same tab is not.
 */
export function enteredViaMainApp(): boolean {
  try {
    return storage()?.getItem(ENTERED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markEnteredViaMainApp(): void {
  try {
    storage()?.setItem(ENTERED_KEY, '1');
  } catch {
    // Without storage every load starts at the web app, which is still correct.
  }
}

/** The web app's hand-off carries the session back in `#token=` (see `withHandoffToken`). */
export function hasHandoffFragment(hash: string = typeof window === 'undefined' ? '' : window.location.hash): boolean {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return Boolean(params.get('token') ?? params.get('accessToken'));
}

let leaving = false;

/** True once this tab has started navigating to the web app's sign-in. */
export function isLeavingForLogin(): boolean {
  return leaving;
}

/**
 * Sends the tab to the web app's sign-in. Safe to call from several places at
 * once (a burst of 401s all reporting an expired session): only the first
 * navigates. `replace` keeps the dead page out of the back-button history.
 */
export function redirectToLogin(returnTo?: string): void {
  if (leaving || typeof window === 'undefined') return;
  leaving = true;
  markLoginRedirect();
  window.location.replace(buildLoginUrl(returnTo));
}

/** Ends the platform session via the web app, which sends the visitor to sign in again. */
export function redirectToLogout(): void {
  if (leaving || typeof window === 'undefined') return;
  leaving = true;
  // Not a "went to sign in" mark: signing out leaves a signed-out visitor on purpose.
  clearLoginRedirect();
  window.location.replace(buildLogoutUrl());
}
