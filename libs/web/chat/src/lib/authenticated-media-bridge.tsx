import { configureAuthenticatedMediaFetcher } from '@org/hooks';
import { useEffect, useRef, type ReactNode } from 'react';
import { useMatrix } from './matrix-provider.js';

/**
 * Supplies `@org/hooks`' `useAuthenticatedMediaSrc` the one thing it cannot
 * get on its own: a way to fetch Matrix's authenticated media with the
 * current session's bearer token. `@org/hooks` is a dependency-free leaf
 * package (the same boundary `AvatarPresenceProvider` works around for live
 * presence in `@org/ui`), so the app wires the fetcher in here, once, where
 * the Matrix connection actually lives.
 *
 * The client instance changes across reconnects (a fresh `OneTabMatrixClient`
 * per `syncConnection()` in `MatrixProvider`), so the fetcher reads the
 * *current* client from a ref at call time rather than closing over a
 * specific instance — otherwise a resolve kicked off just before a
 * reconnect would keep using a stale, possibly-stopped client.
 */
export function AuthenticatedMediaBridge({
  children,
}: {
  children: ReactNode;
}) {
  const { client } = useMatrix();
  const clientRef = useRef(client);
  clientRef.current = client;

  useEffect(() => {
    configureAuthenticatedMediaFetcher((url) => {
      const token = clientRef.current?.getAccessToken();
      if (!token) {
        return Promise.reject(new Error('Not signed in to Matrix.'));
      }
      return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    });
    return () => configureAuthenticatedMediaFetcher(null);
  }, []);

  return <>{children}</>;
}
