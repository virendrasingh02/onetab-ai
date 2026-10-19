import { useQuery } from '@tanstack/react-query';
import {
  directListFilter,
  toDirectRooms,
  unnamedPeers,
  type DirectRoom,
} from './direct-rooms';
import type { MatrixRestClient } from './matrix';

export const directRoomsKey = (userId: string | undefined) =>
  ['mobile', 'direct-rooms', userId] as const;

/**
 * The caller's DMs and group DMs. One filtered `/sync` (no long-poll — the
 * list refreshes on focus and pull-to-refresh); peers whose names the
 * lazy-loaded state did not carry are filled from the room's member list.
 */
export function useDirectRooms(client: MatrixRestClient | null) {
  return useQuery({
    queryKey: directRoomsKey(client?.userId),
    enabled: Boolean(client),
    queryFn: async (): Promise<DirectRoom[]> => {
      if (!client) return [];
      const sync = await client.sync({ filter: directListFilter() });
      const rooms = toDirectRooms(sync, client.userId);
      const missing = unnamedPeers(rooms);
      if (!missing.size) return rooms;

      const profiles = await Promise.all(
        [...missing.keys()].map(async (roomId) => {
          try {
            return [roomId, await client.joinedMembers(roomId)] as const;
          } catch {
            return [roomId, {}] as const;
          }
        }),
      );
      const byRoom = new Map(profiles);
      return rooms.map((room) => {
        const members = byRoom.get(room.roomId);
        if (!members) return room;
        const names = { ...room.names };
        const avatars = { ...room.avatars };
        for (const [id, profile] of Object.entries(members)) {
          names[id] ??= profile.displayName;
          if (profile.avatarMxc) avatars[id] ??= profile.avatarMxc;
        }
        return { ...room, names, avatars };
      });
    },
  });
}
