import type { Message, Room } from '@org/matrix-client';
import { useCallback, useEffect, useState } from 'react';
import { useMatrix } from './matrix-provider.js';

export interface CrossRoomThread {
  /** The thread root's event id — unique across rooms. */
  id: string;
  roomId: string;
  roomName: string;
  /** The message the thread hangs off, when it is in the loaded timeline. */
  root: Message | null;
  title: string;
  authorName: string;
  replyCount: number;
  lastReplyAt: number | undefined;
  hasUnread: boolean;
}

/**
 * Every thread the reader can see, across all their rooms.
 *
 * Threads are not a server resource we can page through — the SDK derives them
 * from each room's timeline as it syncs — so this reads what the client already
 * holds and re-reads it when anything arrives. That means the list grows as
 * sync catches up rather than arriving complete, which is why "no threads" is
 * only reported once the client is connected.
 */
export function useAllThreads() {
  const { client, enabled } = useMatrix();
  const [threads, setThreads] = useState<CrossRoomThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const collect = useCallback(() => {
    if (!client) return;

    const rooms: Room[] = client.getRooms();
    const collected: CrossRoomThread[] = [];

    for (const room of rooms) {
      // The timeline is already in memory; it is where the root message and
      // the sender's display name come from.
      const byId = new Map(
        client.getTimeline(room.id).messages.map((message) => [
          message.id,
          message,
        ]),
      );

      for (const thread of client.getThreads(room.id)) {
        const root = byId.get(thread.rootId) ?? null;

        collected.push({
          id: thread.rootId,
          roomId: room.id,
          roomName: room.name,
          root,
          title: root?.body || 'Thread',
          authorName: root?.senderName ?? 'Someone',
          replyCount: thread.replyCount,
          lastReplyAt: thread.latestReplyAt,
          hasUnread: thread.hasUnread,
        });
      }
    }

    collected.sort((a, b) => (b.lastReplyAt ?? 0) - (a.lastReplyAt ?? 0));
    setThreads(collected);
    setIsLoading(false);
  }, [client]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    if (!client) return;

    collect();

    /*
     * Recollected on any timeline change rather than on a timer: a reply lands
     * as one event, and rebuilding the list is cheap next to leaving the reader
     * looking at a stale count.
     */
    return client.on((event) => {
      if (
        event.type === 'message.received' ||
        event.type === 'message.updated' ||
        event.type === 'message.redacted' ||
        event.type === 'thread.updated' ||
        event.type === 'room.upserted'
      ) {
        collect();
      }
    });
  }, [client, collect, enabled]);

  return { threads, isLoading: enabled && !client ? true : isLoading };
}
