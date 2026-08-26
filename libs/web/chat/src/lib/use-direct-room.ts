import { matrixApi, queryKeys } from '@org/api-client';
import { useQuery } from '@tanstack/react-query';
import { useMatrix } from './matrix-provider.js';

/**
 * Resolves the Matrix room for a direct message with one peer — a teammate,
 * an AI agent (`agent-<id>`), or a connected app (`app-<id>`).
 *
 * Two steps, and the split is deliberate. The identity mapping is the server's
 * — the Matrix localpart is derived from our user/agent/integration id, and for
 * an agent or app it's provisioned lazily on first resolution (see
 * `MatrixAuthService.resolvePeerIdentity`) — while finding or opening the room
 * is the client's, because `getOrCreateDirectMessage` reuses a room the user is
 * already in and records `m.direct` under their own account so both ends group
 * the conversation the same way. Doing that server-side would mean
 * impersonating the user with admin credentials.
 *
 * Modelled as a query rather than a mutation: from the caller's point of view
 * "the room for this peer" is a stable resource, and re-selecting someone in
 * the list should be a cache hit, not another round of room creation. This is
 * agnostic to what kind of peer it is — `getOrCreateDirectMessage` only ever
 * needs a Matrix user id, human or bot.
 */
export function useDirectRoom(peerUserId: string | undefined) {
  const { client, enabled } = useMatrix();

  const query = useQuery({
    queryKey: queryKeys.matrix.peerIdentity(peerUserId ?? ''),
    queryFn: async () => {
      const { matrixUserId } = await matrixApi.peerIdentity(
        peerUserId as string,
      );
      return (client as NonNullable<typeof client>).getOrCreateDirectMessage(
        matrixUserId,
      );
    },
    enabled: !!peerUserId && enabled && !!client,
    // Neither the mapping nor the room changes for the life of the session.
    staleTime: Infinity,
    retry: 1,
  });

  return {
    roomId: query.data ?? null,
    isLoading: query.isLoading,
    error: query.isError ? 'This conversation could not be opened.' : null,
  };
}
