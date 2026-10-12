import { LoadingState } from '@org/ui';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLogout } from '../use-auth.js';

/**
 * `/logout`: ends the whole platform session, then shows the sign-in page.
 *
 * Other browser apps (Agent Studio, Admin) have no session of their own — they
 * share this app's. Signing out of one therefore has to end it here too, or
 * this app's sign-in page would see a live session and sign the user straight
 * back in. `returnTo` is carried to the sign-in page, which validates it
 * before using it.
 */
export function LogoutPage() {
  const [searchParams] = useSearchParams();
  const logout = useLogout();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice
    started.current = true;
    logout.mutate({ returnTo: searchParams.get('returnTo') ?? undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on arrival
  }, []);

  return <LoadingState fullPage label="Signing you out…" />;
}
