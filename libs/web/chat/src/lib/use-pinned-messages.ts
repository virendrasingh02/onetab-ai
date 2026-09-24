import type { Message } from '@org/types';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useMatrix } from './matrix-provider.js';

const NONE: Message[] = [];

/**
 * Pins can point anywhere in a room's history, but the timeline only holds the
 * latest page. Fetches the pinned messages that are not loaded, so the Pinned
 * panel lists every pin rather than just the recent ones.
 */
export function usePinnedOutsideTimeline(
  roomId: string | undefined,
  pinnedIds: string[],
  loaded: Message[],
): Message[] {
  const { client } = useMatrix();

  const missing = useMemo(() => {
    const loadedIds = new Set(loaded.map((message) => message.id));
    return pinnedIds.filter((id) => !loadedIds.has(id)).sort();
  }, [pinnedIds, loaded]);

  const query = useQuery({
    queryKey: ['matrix', 'pinned-messages', roomId, missing],
    enabled: !!client && !!roomId && missing.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!client || !roomId) return NONE;
      const messages = await Promise.all(
        missing.map((id) => client.fetchMessage(roomId, id)),
      );
      return messages.filter((message): message is Message => !!message);
    },
  });

  return query.data ?? NONE;
}
