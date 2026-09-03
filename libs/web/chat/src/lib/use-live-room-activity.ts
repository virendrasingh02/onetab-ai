import { useEffect, useRef, useState } from 'react';
import { useMatrix } from './matrix-provider.js';

export interface RoomActivityEntry {
  unreadCount: number;
  mentionCount: number;
}

export interface LiveRoomActivity {
  /** `channel`-kind rooms, keyed by lower-cased + trimmed room name. */
  byChannelName: Map<string, RoomActivityEntry>;
  /** `direct` (1:1) rooms, keyed by the peer's Matrix user id. */
  byDirectUserId: Map<string, RoomActivityEntry>;
}

const EMPTY: LiveRoomActivity = {
  byChannelName: new Map(),
  byDirectUserId: new Map(),
};

/**
 * A live index of every joined room's unread / mention counts, read straight
 * from the Matrix client with no poll. The sidebar merges this over its
 * feed-derived activity so a channel row lights up the frame a message lands
 * rather than after the notifications feed next refetches.
 *
 * Channel rooms are keyed by name: the mapping from one of our channel ids to a
 * Matrix room id is a per-channel server round-trip, not something to pay for
 * every sidebar row, and channel names are unique within a workspace — the same
 * lookup `direct-messages-section` already relies on. `client.getRooms()` comes
 * back most-recently-active first, so on a cross-workspace name collision the
 * busier room wins.
 */
export function useLiveRoomActivity(): LiveRoomActivity {
  const { client } = useMatrix();
  const [activity, setActivity] = useState<LiveRoomActivity>(EMPTY);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!client) {
      setActivity(EMPTY);
      return;
    }

    const recompute = () => {
      frame.current = null;
      try {
        const byChannelName = new Map<string, RoomActivityEntry>();
        const byDirectUserId = new Map<string, RoomActivityEntry>();

        for (const room of client.getRooms()) {
          const entry: RoomActivityEntry = {
            unreadCount: room.unreadCount,
            mentionCount: room.highlightCount,
          };

          if (room.kind === 'channel') {
            const key = room.name.toLowerCase().trim();
            if (key && !byChannelName.has(key)) byChannelName.set(key, entry);
          } else if (room.kind === 'direct' && room.directUserId) {
            if (!byDirectUserId.has(room.directUserId)) {
              byDirectUserId.set(room.directUserId, entry);
            }
          }
        }

        setActivity({ byChannelName, byDirectUserId });
      } catch {
        // Client present but not synced yet — reading rooms throws through
        // `require()`. Keep the last good snapshot until the next event.
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
        case 'message.redacted':
        case 'notifications':
        case 'receipt':
        case 'room.upserted':
        case 'room.removed':
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
  }, [client]);

  return activity;
}
