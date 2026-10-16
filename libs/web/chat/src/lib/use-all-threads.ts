import type { Message, Room, RoomKind } from '@org/matrix-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMatrix } from './matrix-provider.js';

export interface ThreadParticipant {
  userId: string;
  name: string;
  avatarUrl?: string;
}

export interface CrossRoomThread {
  /** The thread root's event id — unique across rooms. */
  id: string;
  roomId: string;
  roomName: string;
  /** What the thread's room is, so the list can group channels apart from DMs. */
  roomKind: RoomKind;
  /** The other person's Matrix id, for a 1:1 DM — what its route is keyed on. */
  directUserId?: string;
  /** The message the thread hangs off, when it is in the loaded timeline. */
  root: Message | null;
  /** True once the server confirmed the root is deleted or unreadable. */
  rootUnavailable: boolean;
  title: string;
  authorName: string;
  replyCount: number;
  lastReplyAt: number | undefined;
  hasUnread: boolean;
  /** Everyone who has posted in the thread, for an avatar stack. */
  participants: ThreadParticipant[];
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
  /*
   * Roots that were not in the room's loaded timeline (an older message the
   * SDK only knows as a thread id), fetched from the server once each.
   * `null` means the server has no readable copy — don't ask again.
   */
  const fetchedRoots = useRef(new Map<string, Message | null>());
  const inFlight = useRef(new Set<string>());

  const collect = useCallback(() => {
    if (!client) return;

    const rooms: Room[] = client.getRooms();
    const collected: CrossRoomThread[] = [];

    for (const room of rooms) {
      // The timeline is already in memory; it is where the root message and
      // the sender's display name come from.
      const byId = new Map(
        client
          .getTimeline(room.id)
          .messages.map((message) => [message.id, message]),
      );
      const memberById = new Map(
        client.getMembers(room.id).map((member) => [member.userId, member]),
      );

      for (const thread of client.getThreads(room.id)) {
        const loadedRoot = byId.get(thread.rootId);
        if (loadedRoot) fetchedRoots.current.delete(thread.rootId);
        const root = loadedRoot ?? fetchedRoots.current.get(thread.rootId) ?? null;

        if (
          !root &&
          !fetchedRoots.current.has(thread.rootId) &&
          !inFlight.current.has(thread.rootId)
        ) {
          const rootId = thread.rootId;
          inFlight.current.add(rootId);
          void client
            .fetchMessage(room.id, rootId)
            .catch(() => null)
            .then((message) => {
              inFlight.current.delete(rootId);
              fetchedRoots.current.set(
                rootId,
                message && !message.isRedacted ? message : null,
              );
              collect();
            });
        }

        collected.push({
          id: thread.rootId,
          roomId: room.id,
          roomName: room.name,
          roomKind: room.kind,
          directUserId: room.directUserId,
          root,
          rootUnavailable:
            !root && fetchedRoots.current.get(thread.rootId) === null,
          title: root?.body || 'Thread',
          authorName: root?.senderName ?? 'Someone',
          replyCount: thread.replyCount,
          lastReplyAt: thread.latestReplyAt,
          hasUnread: thread.hasUnread,
          participants: thread.participantIds.slice(0, 5).map((userId) => {
            const member = memberById.get(userId);
            return {
              userId,
              name: member?.displayName ?? userId,
              avatarUrl: member?.avatarUrl,
            };
          }),
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
      // Keep a fetched root current when it is edited, reacted to or deleted.
      if (
        event.type === 'message.updated' &&
        fetchedRoots.current.has(event.message.id)
      ) {
        fetchedRoots.current.set(event.message.id, event.message);
      } else if (
        event.type === 'message.redacted' &&
        fetchedRoots.current.has(event.eventId)
      ) {
        fetchedRoots.current.set(event.eventId, null);
      }

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
