import type { Room, RoomKind } from '@org/matrix-client';
import { useCallback, useEffect, useState } from 'react';
import { useMatrix } from './matrix-provider.js';

/** One file shared in a Matrix room — a chat attachment, not an `Upload` row. */
export interface RoomFile {
  /** The message's event id — unique across rooms. */
  id: string;
  roomId: string;
  roomName: string;
  /** `channel` vs `direct`/`group`, so the hub can badge it as a channel or DM. */
  roomKind: RoomKind;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string;
  /** True when the reader sent this file — powers the "Uploaded by you" tab. */
  isMine: boolean;
  name: string;
  mimeType: string;
  size: number;
  /** Resolved HTTP (or blob) URL — ready to open or download. */
  url: string;
  thumbnailUrl?: string;
  /** Epoch ms. */
  timestamp: number;
}

/**
 * Every file the reader can see across all their Matrix rooms — channels and
 * DMs alike.
 *
 * Chat attachments are Matrix media, never `Upload` rows, so the "All Files"
 * hub can only *reflect* them: preview and download work, central delete/rename
 * do not. Like `useAllThreads`, this reads what the client already holds in its
 * in-memory timelines and re-reads on every timeline change, so the list fills
 * in as sync catches up rather than arriving complete.
 */
export function useWorkspaceRoomFiles() {
  const { client, enabled } = useMatrix();
  const [files, setFiles] = useState<RoomFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const collect = useCallback(() => {
    if (!client) return;

    const myUserId = client.getSession()?.userId ?? null;
    const rooms: Room[] = client.getRooms();
    const collected: RoomFile[] = [];

    for (const room of rooms) {
      for (const message of client.getTimeline(room.id).messages) {
        if (!message.attachment || message.isRedacted) continue;
        collected.push({
          id: message.id,
          roomId: room.id,
          roomName: room.name,
          roomKind: room.kind,
          senderId: message.senderId,
          senderName: message.senderName,
          senderAvatarUrl: message.senderAvatarUrl,
          isMine: !!myUserId && message.senderId === myUserId,
          name: message.attachment.name,
          mimeType: message.attachment.mimeType,
          size: message.attachment.size ?? 0,
          url: message.attachment.url,
          thumbnailUrl: message.attachment.thumbnailUrl,
          timestamp: message.timestamp,
        });
      }
    }

    collected.sort((a, b) => b.timestamp - a.timestamp);
    setFiles(collected);
    setIsLoading(false);
  }, [client]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    if (!client) return;

    collect();

    return client.on((event) => {
      if (
        event.type === 'message.received' ||
        event.type === 'message.updated' ||
        event.type === 'message.redacted' ||
        event.type === 'room.upserted'
      ) {
        collect();
      }
    });
  }, [client, collect, enabled]);

  return { files, isLoading: enabled && !client ? true : isLoading, enabled };
}
