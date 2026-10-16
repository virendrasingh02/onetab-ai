import { normalizeAvatarSeed } from '@org/design-system';
import { useEffect, useMemo, useReducer } from 'react';
import { useMatrix } from './matrix-provider.js';

/**
 * Which Matrix room backs each 1:1 DM, and which rooms this user has muted —
 * read live from the Matrix client.
 *
 * Keys are the ids the DM UI uses: a peer's workspace user id for a 1:1 DM
 * (Matrix ids are mapped with `normalizeAvatarSeed`), or the room id itself for
 * a group DM.
 */
export interface DirectRoomIndex {
  /** Resolves a DM key to its room id; undefined while no room exists yet. */
  roomFor: (id: string) => string | undefined;
  /** Every DM key whose room carries a mute push rule. */
  mutedIds: string[];
  /** Whether the room for this key carries a mute push rule. */
  isRoomMuted: (roomId: string) => boolean;
  /** False until the client has synced; nothing can be resolved before. */
  ready: boolean;
}

const NOT_READY: DirectRoomIndex = {
  roomFor: () => undefined,
  mutedIds: [],
  isRoomMuted: () => false,
  ready: false,
};

export function useDirectRoomIndex(): DirectRoomIndex {
  const { client, status } = useMatrix();
  // Bumps on any change that can move a room or a mute.
  const [version, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!client) return;
    return client.on((event) => {
      if (
        event.type === 'room.upserted' ||
        event.type === 'room.removed' ||
        event.type === 'direct.updated' ||
        event.type === 'pushrules.updated'
      ) {
        bump();
      }
    });
  }, [client]);

  return useMemo(() => {
    if (!client || status.state !== 'connected') return NOT_READY;
    let rooms: ReturnType<typeof client.getRooms>;
    let directMap: Record<string, string[]>;
    try {
      rooms = client.getRooms();
      directMap = client.getDirectRoomIds();
    } catch {
      return NOT_READY;
    }

    const roomIds = new Set(rooms.map((r) => r.id));
    const directRoomIds = new Set(
      rooms.filter((r) => r.kind === 'direct').map((r) => r.id),
    );
    const peerToRoom = new Map<string, string>();
    const roomToPeers = new Map<string, string[]>();
    const link = (peerId: string, roomId: string) => {
      if (peerToRoom.has(peerId)) return;
      peerToRoom.set(peerId, roomId);
      roomToPeers.set(roomId, [...(roomToPeers.get(roomId) ?? []), peerId]);
    };

    // A joined peer first (rooms come newest first, so a duplicate DM keeps the
    // live one), then `m.direct`, which also knows a DM the peer was only
    // invited to. `m.direct` lists group DMs under every member, so only 1:1
    // rooms count here.
    for (const room of rooms) {
      if (room.kind === 'direct' && room.directUserId) {
        link(normalizeAvatarSeed(room.directUserId), room.id);
      }
    }
    for (const [matrixUserId, ids] of Object.entries(directMap)) {
      const roomId = ids.find((id) => directRoomIds.has(id));
      if (roomId) link(normalizeAvatarSeed(matrixUserId), roomId);
    }

    const isRoomMuted = (roomId: string) => {
      try {
        return client.isRoomMuted(roomId);
      } catch {
        return false;
      }
    };

    const mutedIds: string[] = [];
    for (const room of rooms) {
      if (!isRoomMuted(room.id)) continue;
      mutedIds.push(room.id, ...(roomToPeers.get(room.id) ?? []));
    }

    return {
      roomFor: (id: string) =>
        id.startsWith('!')
          ? roomIds.has(id)
            ? id
            : undefined
          : peerToRoom.get(id),
      mutedIds,
      isRoomMuted,
      ready: true,
    };
    // `version` stands in for the client state read above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, status.state, version]);
}
