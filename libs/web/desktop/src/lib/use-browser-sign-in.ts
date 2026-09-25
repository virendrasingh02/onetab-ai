import { useCallback, useEffect, useState } from 'react';
import {
  getDesktopApi,
  type DesktopAuthFlowStatus,
  type DesktopBrowserAuthIntent,
} from './desktop-api.js';

export type BrowserSignInState = 'idle' | 'opening' | DesktopAuthFlowStatus['state'];

export interface BrowserSignIn {
  state: BrowserSignInState;
  message?: string;
  /** Opens (or re-opens) the browser on the sign-in / sign-up page. */
  start: (intent?: DesktopBrowserAuthIntent) => Promise<void>;
  /** Abandons the pending attempt and returns to `idle`. */
  cancel: () => Promise<void>;
}

/**
 * State machine behind the desktop "Sign in with browser" screen.
 *
 * The desktop shell has no sign-in form of its own: it opens the system
 * browser on the web sign-in page with a PKCE challenge, and the main process
 * reports progress (`waiting` → `success` | `cancelled` | `expired` |
 * `timeout` | `error`) over the auth flow-status event. This hook turns that
 * stream into renderable state. Outside the shell it stays `idle`.
 */
export function useBrowserSignIn(): BrowserSignIn {
  const [status, setStatus] = useState<{ state: BrowserSignInState; message?: string }>({
    state: 'idle',
  });

  useEffect(() => {
    const api = getDesktopApi();
    return api?.auth.onFlowStatus((next) => setStatus(next));
  }, []);

  const start = useCallback(async (intent?: DesktopBrowserAuthIntent) => {
    const api = getDesktopApi();
    if (!api) return;
    setStatus({ state: 'opening' });
    try {
      const opened = await api.auth.startBrowserLogin(intent);
      // `false` arrives together with an `error` flow status carrying the
      // reason; only fill in a message if that event somehow did not.
      if (!opened) {
        setStatus((current) =>
          current.state === 'opening'
            ? { state: 'error', message: 'Could not open your browser.' }
            : current,
        );
      }
    } catch (error) {
      setStatus({
        state: 'error',
        message: error instanceof Error ? error.message : 'Could not open your browser.',
      });
    }
  }, []);

  const cancel = useCallback(async () => {
    await getDesktopApi()?.auth.cancelBrowserLogin();
    setStatus({ state: 'idle' });
  }, []);

  return { state: status.state, message: status.message, start, cancel };
}
