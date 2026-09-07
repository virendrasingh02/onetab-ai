import { useEffect, useRef, useState } from 'react';
import { useMatrix } from './matrix-provider.js';

export interface MessagePreview {
  body: string;
  senderName: string;
  timestamp: number;
  isEdited?: boolean;
}

export interface RoomActivityEntry {
  unreadCount: number;
  mentionCount: number;
  latestPreview?: MessagePreview;
  typingUserIds?: string[];
}

export interface LiveRoomActivity {
  /** `channel`-kind rooms, keyed by lower-cased + trimmed room name. */
  byChannelName: Map<string, RoomActivityEntry>;
  /** `direct` (1:1) rooms, keyed by the peer's Matrix user id. */
  byDirectUserId: Map<string, RoomActivityEntry>;
  /** All rooms keyed by Matrix room id. */
  byRoomId: Map<string, RoomActivityEntry>;
}

const EMPTY: LiveRoomActivity = {
  byChannelName: new Map(),
  byDirectUserId: new Map(),
  byRoomId: new Map(),
};

/**
 * A live index of every joined room's unread / mention counts, typing indicators,
 * and latest message previews, read straight from the Matrix client with no polling.
 * The sidebar merges this over its feed-derived activity so channels, DMs, and groups
 * reflect instant updates the moment an event lands.
 */
export function useLiveRoomActivity(): LiveRoomActivity {
  const { client } = useMatrix();
  const [activity, setActivity] = useState<LiveRoomActivity>(EMPTY);
  const frame = useRef<number | null>(null);
  const typingByRoom = useRef<Map<string, string[]>>(new Map());

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
        const byRoomId = new Map<string, RoomActivityEntry>();

        for (const room of client.getRooms()) {
          const typingUsers = typingByRoom.current.get(room.id) ?? [];
          const entry: RoomActivityEntry = {
            unreadCount: room.unreadCount,
            mentionCount: room.highlightCount,
            typingUserIds: typingUsers,
          };

          try {
            const timeline = client.getTimeline(room.id);
            const latest = timeline.messages[timeline.messages.length - 1];
            if (latest) {
              entry.latestPreview = {
                body:
                  latest.body ||
                  (latest.attachment ? latest.attachment.name : ''),
                senderName: latest.senderName,
                timestamp: latest.timestamp,
                isEdited: latest.isEdited,
              };
            }
          } catch {
            // Ignored if timeline cannot be read yet
          }

          byRoomId.set(room.id, entry);

          if (room.kind === 'channel') {
            const key = room.name.toLowerCase().trim();
            if (key && !byChannelName.has(key)) byChannelName.set(key, entry);
          } else if (room.kind === 'direct' && room.directUserId) {
            if (!byDirectUserId.has(room.directUserId)) {
              byDirectUserId.set(room.directUserId, entry);
            }
          }
        }

        setActivity({ byChannelName, byDirectUserId, byRoomId });
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
        case 'message.updated':
        case 'message.redacted':
        case 'notifications':
        case 'receipt':
        case 'room.upserted':
        case 'room.removed':
          schedule();
          break;
        case 'typing':
          typingByRoom.current.set(event.update.roomId, event.update.userIds);
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
