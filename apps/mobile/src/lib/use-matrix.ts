import { matrixApi } from '@org/api-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { MatrixRestClient, type MatrixSession } from './matrix';
import { secureStore } from './secure-store';
import { useSession } from './session';
import { STORAGE_KEYS } from './session-core';

const MATRIX_KEY = ['mobile', 'matrix-session'] as const;

/**
 * The signed-in person's Matrix client.
 *
 * Every `POST /matrix/session` registers a new homeserver device, so the
 * session is kept in the keychain and reused; it is minted again only when
 * there is none or the homeserver rejects the stored token.
 */
export function useMatrixClient() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...MATRIX_KEY, user?.id],
    enabled: Boolean(user),
    staleTime: Infinity,
    queryFn: async () => {
      const config = await matrixApi.config();
      if (!config.enabled) return null;

      const stored = await secureStore.get(STORAGE_KEYS.matrixSession);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as MatrixSession & {
            ownerId?: string;
          };
          if (parsed.ownerId === user?.id) return new MatrixRestClient(parsed);
        } catch {
          // Fall through and mint a fresh session.
        }
      }

      const session = await matrixApi.session();
      await secureStore.set(
        STORAGE_KEYS.matrixSession,
        JSON.stringify({ ...session, ownerId: user?.id }),
      );
      return new MatrixRestClient(session);
    },
  });

  /** Drops a session the homeserver no longer accepts and mints a new one. */
  const resetSession = useCallback(async () => {
    await secureStore.remove(STORAGE_KEYS.matrixSession);
    await queryClient.invalidateQueries({ queryKey: MATRIX_KEY });
  }, [queryClient]);

  return { ...query, client: query.data ?? null, resetSession };
}
