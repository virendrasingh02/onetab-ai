import { getAccessToken } from '@org/api-client';
import { LoadingState } from '@org/ui';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from './auth.store.js';

/**
 * Gate for authenticated areas.
 *
 * `idle`/`authenticating` render a loader rather than redirecting: on a cold
 * load the session is still being restored from the refresh cookie, and
 * bouncing to /login there would sign the user out on every page refresh.
 *
 * Once a user is known, a later `authenticating` (a background token refresh,
 * a desktop session re-check) must NOT swap `<Outlet/>` for the loader —
 * doing so unmounts and remounts the entire app, which reads as the whole
 * page reloading on every interaction. The loader is only for the cold start
 * where there is genuinely nothing to show yet.
 */
export function ProtectedRoute() {
  const status = useAuthStore((state) => state.status);
  const hasUser = useAuthStore((state) => state.user !== null);
  const location = useLocation();

  if ((status === 'idle' || status === 'authenticating') && !hasUser) {
    return <LoadingState fullPage label="Loading your workspace…" />;
  }

  if (status !== 'authenticated' && !hasUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

/** Inverse gate: keeps signed-in users off /login and /register, unless performing a desktop handoff or returnTo redirect. */
export function PublicOnlyRoute() {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isDesktopHandoff = searchParams.get('desktop') === 'true';
  const returnTo = searchParams.get('returnTo');

  if (status === 'authenticated' && !isDesktopHandoff) {
    if (returnTo) {
      try {
        const targetUrl = new URL(returnTo, window.location.origin);
        const isAllowed =
          targetUrl.origin === window.location.origin ||
          targetUrl.hostname === 'localhost' ||
          targetUrl.hostname === '127.0.0.1' ||
          (window.location.hostname.includes('.') &&
            targetUrl.hostname.endsWith(
              window.location.hostname.split('.').slice(-2).join('.'),
            ));

        if (isAllowed) {
          const currentToken = getAccessToken();
          if (currentToken && targetUrl.origin !== window.location.origin) {
            targetUrl.searchParams.set('token', currentToken);
          }
          window.location.href = targetUrl.toString();
          return null;
        }
      } catch {
        // Fall back to default navigate
      }
    }
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
