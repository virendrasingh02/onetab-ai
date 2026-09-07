import type { UnreadMention } from '@org/matrix-client';
import { useEffect, useRef, useState } from 'react';
import { useMatrix } from './matrix-provider.js';

export interface UnreadMentionsState {
  /**
   * Event ids of the unread `@mentions` currently resolvable in the loaded
   * timeline, oldest first — feed straight into `scrollToMessage` / `?msg=`.
   */
  ids: string[];
  /** The same mentions as full records, oldest first. */
  mentions: UnreadMention[];
  /**
   * Authoritative total for the conversation, from the room's Matrix highlight
   * count. May exceed `ids.length` when mentions sit further back than the
   * loaded page; equals `ids.length` in thread scope.
   */
  count: number;
  /** Unread mentions older than the loaded window (`count - ids.length`). */
  unloadedCount: number;
}

const EMPTY: UnreadMentionsState = {
  ids: [],
  mentions: [],
  count: 0,
  unloadedCount: 0,
};

export interface UseUnreadMentionsOptions {
  /**
   * Restrict to mentions inside this thread. Omitted / `null` scopes to the
   * main timeline only (thread mentions are excluded so the channel pill and
   * the thread-panel pill never double-count the same message).
   */
  threadRootId?: string | null;
}

/**
 * The reader's unread `@mentions` in one conversation, kept live off the Matrix
 * client — no poll, no second store. Recomputes on a coalesced frame whenever a
 * message lands, a receipt moves the read marker, or the room's counts change,
 * so the set drains as the reader catches up and the pill disappears on its own
 * once every mention has been read.
 *
 * Mirrors {@link useLiveRoomActivity}: the client is the source of truth, this
 * just projects it for a view.
 */
export function useUnreadMentions(
  roomId: string | undefined,
  options: UseUnreadMentionsOptions = {},
): UnreadMentionsState {
  const { client } = useMatrix();
  const threadRootId = options.threadRootId ?? null;
  const [state, setState] = useState<UnreadMentionsState>(EMPTY);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!client || !roomId) {
      setState(EMPTY);
      return;
    }

    const recompute = () => {
      frame.current = null;
      try {
        const all = client.getUnreadMentions(roomId);
        const scoped = all.filter((mention) =>
          threadRootId === null
            ? !mention.threadRootId
            : mention.threadRootId === threadRootId,
        );
        const ids = scoped.map((mention) => mention.eventId);

        // Only the main-timeline pill can speak for the whole room; a thread
        // pill knows exactly what it can see.
        const highlight =
          threadRootId === null
            ? client.getNotificationCounts(roomId).highlight
            : ids.length;

        setState({
          ids,
          mentions: scoped,
          count: Math.max(highlight, ids.length),
          unloadedCount: Math.max(0, highlight - ids.length),
        });
      } catch {
        // Client present but not synced yet — keep the last good snapshot.
      }
    };

    const schedule = () => {
      if (frame.current != null) return;
      frame.current = requestAnimationFrame(recompute);
    };

    recompute();

    const unsubscribe = client.on((event) => {
      switch (event.type) {
        case 'message.received':
        case 'message.updated':
        case 'message.redacted':
        case 'receipt':
        case 'notifications':
        case 'room.upserted':
          schedule();
          break;
        default:
          break;
      }
    });

    return () => {
      unsubscribe();
      if (frame.current != null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
    };
  }, [client, roomId, threadRootId]);

  return state;
}

/**
 * The next unread mention to jump to, walking `ids` (oldest → newest) from the
 * reader's current anchor in the given direction. `ids` is already ordered and
 * shrinks as mentions are read, so this is a plain step rather than a wrapping
 * cycle: when the last one is consumed the caller's `ids` is empty and the pill
 * is gone.
 */
export function selectNextUnreadMention(
  ids: readonly string[],
  anchorId: string | null | undefined,
  direction: 'up' | 'down',
): string | undefined {
  if (ids.length === 0) return undefined;
  if (!anchorId) {
    return direction === 'down' ? ids[0] : ids[ids.length - 1];
  }

  const index = ids.indexOf(anchorId);
  if (index === -1) {
    // Anchor is not itself a mention — pick the nearest one past it by order.
    return direction === 'down' ? ids[0] : ids[ids.length - 1];
  }
  return direction === 'down'
    ? (ids[index + 1] ?? ids[ids.length - 1])
    : (ids[index - 1] ?? ids[0]);
}
