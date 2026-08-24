import { LoadingState } from '@org/ui';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from './auth.store.js';

/**
 * Gate for authenticated areas.
 *
 * `idle`/`authenticating` render a loader rather than redirecting: on a cold
 * load the session is still being restored from the refresh cookie, and
 * bouncing to /login there would sign the user out on every page refresh.
 */
export function ProtectedRoute() {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === 'idle' || status === 'authenticating') {
    return <LoadingState fullPage label="Loading your workspace…" />;
  }

  if (status !== 'authenticated') {
    // `state.from` lets the login page return the user where they meant to go.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

/** Inverse gate: keeps signed-in users off /login and /register, unless performing a desktop handoff. */
export function PublicOnlyRoute() {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isDesktopHandoff = searchParams.get('desktop') === 'true';

  if (status === 'authenticated' && !isDesktopHandoff) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
