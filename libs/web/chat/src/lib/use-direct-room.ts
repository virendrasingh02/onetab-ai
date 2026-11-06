import { matrixApi, queryKeys } from '@org/api-client';
import type { RoomId } from '@org/types';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
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
 *
 * The cached answer can go stale in one way: two people who each started the
 * conversation hold two rooms until both have accepted the other's invite. The
 * open view follows `findDirectMessage` so both end up writing to the same one.
 */
export function useDirectRoom(peerUserId: string | undefined) {
  const { client, enabled } = useMatrix();

  const query = useQuery({
    queryKey: queryKeys.matrix.peerIdentity(peerUserId ?? ''),
    queryFn: async () => {
      const { matrixUserId } = await matrixApi.peerIdentity(
        peerUserId as string,
      );
      const roomId = await (
        client as NonNullable<typeof client>
      ).getOrCreateDirectMessage(matrixUserId);
      return { matrixUserId, roomId };
    },
    enabled: !!peerUserId && enabled && !!client,
    // Neither the mapping nor the room changes for the life of the session.
    staleTime: Infinity,
    retry: 1,
  });

  const peerMatrixId = query.data?.matrixUserId;
  const [liveRoomId, setLiveRoomId] = useState<RoomId | null>(null);

  useEffect(() => {
    setLiveRoomId(null);
    if (!client || !peerMatrixId) return;
    const refresh = () => {
      try {
        setLiveRoomId(client.findDirectMessage(peerMatrixId));
      } catch {
        // Client stopped; the resolved room stands until it reconnects.
      }
    };
    refresh();
    return client.on((event) => {
      if (
        event.type === 'room.upserted' ||
        event.type === 'room.removed' ||
        event.type === 'direct.updated' ||
        event.type === 'message.received'
      ) {
        refresh();
      }
    });
  }, [client, peerMatrixId]);

  return {
    // A room just created has not synced yet, so the lookup comes back empty.
    roomId: liveRoomId ?? query.data?.roomId ?? null,
    isLoading: query.isLoading,
    error: query.isError
      ? query.error instanceof Error && query.error.message
        ? `This conversation could not be opened (${query.error.message}).`
        : 'This conversation could not be opened.'
      : null,
  };
}
