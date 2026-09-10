import type { MatrixClient as SdkClient, MatrixEvent } from 'matrix-js-sdk';
import type { MessageSearchResult, RoomId } from '../../types.js';

export class MatrixSearchService {
  constructor(private readonly getSdk: () => SdkClient | null) {}

  async searchMessages(
    query: string,
    roomId?: RoomId,
    limit = 25,
  ): Promise<MessageSearchResult[]> {
    const sdk = this.getSdk();
    if (!sdk) return [];
    const trimmed = query.trim();
    if (!trimmed) return [];

    try {
      const response = await sdk.searchMessageText({
        query: trimmed,
      });

      const results: MessageSearchResult[] = [];
      const roomEvents = response.search_categories.room_events;

      for (const item of roomEvents.results ?? []) {
        const event = item.result;
        const eventId = event.event_id;
        const targetRoomId = event.room_id || roomId;
        if (!eventId || !targetRoomId) continue;

        const content = event.content as { body?: string } | undefined;
        const body = content?.body ?? '';
        const senderId = event.sender ?? '';
        const profile = roomEvents.results?.find((r) => r.result.sender === senderId);
        const displayName =
          profile?.context?.profile_info?.[senderId]?.displayname ?? senderId;

        results.push({
          eventId,
          roomId: targetRoomId,
          body,
          senderId,
          senderName: displayName,
          timestamp: event.origin_server_ts ?? Date.now(),
        });
      }

      if (results.length > 0) return results;
    } catch {
      // Server search might not be configured on this homeserver or might fail;
      // fall back to local timeline search across loaded rooms.
    }

    return this.searchLocalRooms(sdk, trimmed, roomId, limit);
  }

  private searchLocalRooms(
    sdk: SdkClient,
    query: string,
    roomId?: RoomId,
    limit = 25,
  ): MessageSearchResult[] {
    const lower = query.toLowerCase();
    const rooms = roomId ? [sdk.getRoom(roomId)].filter(Boolean) : sdk.getRooms();
    const matches: MessageSearchResult[] = [];

    for (const room of rooms) {
      if (!room) continue;
      const timeline = room.getUnfilteredTimelineSet().getLiveTimeline();
      const events: MatrixEvent[] = timeline.getEvents();

      for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i];
        if (ev.getType() !== 'm.room.message') continue;
        const body = ev.getContent()?.body;
        if (typeof body === 'string' && body.toLowerCase().includes(lower)) {
          const sender = room.getMember(ev.getSender() ?? '');
          matches.push({
            eventId: ev.getId() ?? '',
            roomId: room.roomId,
            body,
            senderId: ev.getSender() ?? '',
            senderName: sender?.name ?? ev.getSender() ?? '',
            timestamp: ev.getTs(),
          });
          if (matches.length >= limit) return matches;
        }
      }
    }

    return matches;
  }
}
