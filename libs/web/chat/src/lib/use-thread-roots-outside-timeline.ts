import type { Message } from '@org/types';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useMatrix } from './matrix-provider.js';

const NONE: ReadonlyMap<string, Message> = new Map();

/**
 * A reply also sent to the channel shows "Replied to a thread: <author>
 * <snippet>", but its thread's root can be older than the loaded page of the
 * timeline. Fetches those roots so the line always names the thread.
 */
export function useThreadRootsOutsideTimeline(
  roomId: string | undefined,
  messages: Message[],
  loadedIds: { has(id: string): boolean },
): ReadonlyMap<string, Message> {
  const { client } = useMatrix();

  const missing = useMemo(() => {
    const ids = new Set<string>();
    for (const message of messages) {
      if (
        message.alsoSentToChannel &&
        message.threadRootId &&
        !loadedIds.has(message.threadRootId)
      ) {
        ids.add(message.threadRootId);
      }
    }
    return [...ids].sort();
  }, [messages, loadedIds]);

  const query = useQuery({
    queryKey: ['matrix', 'thread-roots', roomId, missing],
    enabled: !!client && !!roomId && missing.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!client || !roomId) return NONE;
      const roots = await Promise.all(
        missing.map((id) => client.fetchMessage(roomId, id)),
      );
      return new Map(
        roots
          .filter((root): root is Message => !!root)
          .map((root) => [root.id, root]),
      );
    },
  });

  return query.data ?? NONE;
}
