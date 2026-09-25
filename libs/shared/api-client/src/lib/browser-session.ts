import type { CurrentUser } from '@org/types';
import { authApi } from './endpoints.js';
import { ApiError, getAccessToken, setAccessToken } from './http.js';

/**
 * Session restore for the platform's standalone browser apps (Admin, AI Agent
 * Studio). Both sign in through the main web app and come back either with
 * the shared refresh cookie or with a one-time `#token=` fragment — and both
 * had their own copy of this sequence.
 */

/** A definitive "not signed in", as opposed to the API being unreachable. */
function isSignedOut(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

/**
 * Takes the access token the web app handed over in the URL fragment
 * (`#token=…`, see `withHandoffToken` in `@org/auth`) and strips it from the
 * address bar and history immediately. A fragment never reaches a server log,
 * which is why the hand-off uses it rather than the query string.
 */
export function consumeHandoffToken(): boolean {
  if (typeof window === 'undefined' || !window.location.hash) return false;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token = params.get('token') ?? params.get('accessToken');
  if (!token) return false;
  setAccessToken(token);
  window.history.replaceState(
    window.history.state,
    document.title,
    `${window.location.pathname}${window.location.search}`,
  );
  return true;
}

/**
 * Resolves the signed-in user: hand-off fragment → in-memory token → refresh
 * cookie. Returns `null` when the visitor is signed out, and throws (an
 * `ApiError`) only when the API could not be reached — so callers can show
 * "sign in" for the first and "retry" for the second instead of treating an
 * outage as a sign-out.
 */
export async function restoreBrowserSession(): Promise<CurrentUser | null> {
  consumeHandoffToken();

  if (getAccessToken()) {
    try {
      return await authApi.me();
    } catch (error) {
      // An expired access token is expected here; the refresh below renews it.
      if (!isSignedOut(error)) throw error;
    }
  }

  try {
    const { accessToken } = await authApi.refresh();
    setAccessToken(accessToken);
    return await authApi.me();
  } catch (error) {
    if (isSignedOut(error)) {
      setAccessToken(null);
      return null;
    }
    throw error;
  }
}
