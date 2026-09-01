import type { MatrixClient as SdkClient } from 'matrix-js-sdk';
import type { MatrixEvent } from 'matrix-js-sdk';
import { NotificationCountType } from 'matrix-js-sdk';
import type {
  Room as SdkRoom,
  RoomMember as SdkRoomMember,
  Thread as SdkThread,
} from 'matrix-js-sdk';
import {
  validateStructuredEvent,
  type Attachment,
  type Message,
  type MessageKind,
  type Presence,
  type PresenceState,
  type Reaction,
  type Room,
  type RoomKind,
  type RoomMember,
  type StructuredChatMessage,
  type Thread,
} from './types.js';

/**
 * The boundary between Matrix and the application model.
 *
 * Everything the SDK produces passes through here. Keeping the translation in
 * one module is what lets the rest of the codebase stay ignorant of Matrix —
 * and what makes swapping the transport a change to this file rather than a
 * rewrite.
 */

const MSGTYPE_TO_KIND: Record<string, MessageKind> = {
  'm.text': 'text',
  'm.emote': 'emote',
  'm.notice': 'notice',
  'm.image': 'image',
  'm.video': 'video',
  'm.audio': 'audio',
  'm.file': 'file',
};

interface MessageContentShape {
  msgtype?: string;
  body?: string;
  format?: string;
  formatted_body?: string;
  url?: string;
  file?: { url?: string };
  info?: {
    mimetype?: string;
    size?: number;
    w?: number;
    h?: number;
    duration?: number;
    thumbnail_url?: string;
  };
  'org.matrix.msc3245.voice'?: Record<string, unknown>;
  'org.matrix.msc1767.audio'?: { duration?: number; waveform?: number[] };
  'm.relates_to'?: {
    rel_type?: string;
    event_id?: string;
    key?: string;
    'm.in_reply_to'?: { event_id?: string };
  };
  'm.new_content'?: { body?: string; formatted_body?: string };
}

/**
 * Resolves an `mxc://` URI to something an <img> can load.
 *
 * Returns null rather than a broken URL when resolution fails, so callers must
 * decide what to render instead of silently emitting a 404.
 */
export function resolveMediaUrl(
  client: SdkClient,
  mxcUrl: string | undefined,
  options: { width?: number; height?: number } = {},
): string | null {
  if (!mxcUrl) return null;
  return client.mxcUrlToHttp(
    mxcUrl,
    options.width,
    options.height,
    options.width ? 'scale' : undefined,
    false,
    true,
    // Newer homeservers require auth on the media repo.
    true,
  );
}

function toAttachment(
  client: SdkClient,
  content: MessageContentShape,
  kind: MessageKind,
): Attachment | undefined {
  if (!['image', 'video', 'audio', 'voice', 'file'].includes(kind)) {
    return undefined;
  }

  // Encrypted attachments carry the URI under `file`, plaintext under `url`.
  const mxc = content.file?.url ?? content.url;
  const url = resolveMediaUrl(client, mxc);
  if (!url) return undefined;

  const audio = content['org.matrix.msc1767.audio'];

  return {
    name: content.body ?? 'attachment',
    mimeType: content.info?.mimetype ?? 'application/octet-stream',
    size: content.info?.size,
    url,
    thumbnailUrl:
      resolveMediaUrl(client, content.info?.thumbnail_url, { width: 480 }) ??
      undefined,
    width: content.info?.w,
    height: content.info?.h,
    duration: audio?.duration ?? content.info?.duration,
    waveform: normaliseWaveform(audio?.waveform),
  };
}

/**
 * MSC1767 waveforms are integers in 0..1024; the UI wants 0..1.
 * Values are clamped because homeservers do not enforce the range.
 */
function normaliseWaveform(waveform?: number[]): number[] | undefined {
  if (!waveform?.length) return undefined;
  return waveform.map((sample) => Math.min(1, Math.max(0, sample / 1024)));
}

export function toMessageKind(content: MessageContentShape): MessageKind {
  // Voice messages are audio with an MSC3245 marker.
  if (content.msgtype === 'm.audio' && content['org.matrix.msc3245.voice']) {
    return 'voice';
  }
  return MSGTYPE_TO_KIND[content.msgtype ?? ''] ?? 'unknown';
}

export function toReactions(
  client: SdkClient,
  room: SdkRoom | null,
  eventId: string,
): Reaction[] {
  const relations = room
    ?.getUnfilteredTimelineSet()
    .relations?.getChildEventsForEvent(eventId, 'm.annotation', 'm.reaction');

  if (!relations) return [];

  const myUserId = client.getUserId();
  const byKey = new Map<string, { userIds: string[] }>();

  for (const event of relations.getRelations()) {
    if (event.isRedacted()) continue;
    const key = event.getRelation()?.key;
    const sender = event.getSender();
    if (!key || !sender) continue;

    const entry = byKey.get(key) ?? { userIds: [] };
    if (!entry.userIds.includes(sender)) entry.userIds.push(sender);
    byKey.set(key, entry);
  }

  return [...byKey.entries()].map(([key, { userIds }]) => ({
    key,
    count: userIds.length,
    reactedByMe: !!myUserId && userIds.includes(myUserId),
    userIds,
  }));
}

export function extractStructuredEvent(
  event: MatrixEvent,
  content: MessageContentShape,
): StructuredChatMessage | undefined {
  const eventType =
    typeof event?.getType === 'function'
      ? event.getType()
      : typeof (event as any)?.type === 'string'
        ? (event as any).type
        : '';

  // 1. Event type itself is structured (e.g. mie.ai.agent, mie.app.response, etc.)
  if (eventType.startsWith('mie.') || eventType.startsWith('org.onetab.')) {
    const validated = validateStructuredEvent({
      ...content,
      type: eventType,
    });
    if (validated.valid && validated.event) return validated.event;
  }

  // 2. Embedded inside content object
  const anyContent = content as Record<string, unknown>;
  const nested =
    anyContent['mie_event'] ||
    anyContent['mie.ai.agent'] ||
    anyContent['org.onetab.ai.agent'] ||
    anyContent['mie.app.response'] ||
    anyContent['mie.approval'] ||
    anyContent['mie.form'] ||
    anyContent['mie.workflow'] ||
    anyContent['structuredEvent'];

  if (nested && typeof nested === 'object') {
    const validated = validateStructuredEvent(nested);
    if (validated.valid && validated.event) return validated.event;
  }

  // 3. Custom msgtype (e.g. msgtype: "org.onetab.ai.agent" or "mie.app.response")
  if (
    content.msgtype &&
    (content.msgtype.startsWith('mie.') ||
      content.msgtype.startsWith('org.onetab.'))
  ) {
    const validated = validateStructuredEvent(content);
    if (validated.valid && validated.event) return validated.event;
  }

  // 4. JSON body if plain text starts with structured JSON
  if (
    content.body &&
    typeof content.body === 'string' &&
    content.body.trim().startsWith('{') &&
    content.body.includes('"type"')
  ) {
    try {
      const parsed = JSON.parse(content.body.trim());
      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof parsed.type === 'string' &&
        (parsed.type.startsWith('mie.') || parsed.type.startsWith('org.onetab.'))
      ) {
        const validated = validateStructuredEvent(parsed);
        if (validated.valid && validated.event) return validated.event;
      }
    } catch {
      // Not valid JSON, ignore
    }
  }

  return undefined;
}

export function toMessage(
  client: SdkClient,
  event: MatrixEvent,
  room: SdkRoom | null,
): Message | null {
  const id = event.getId();
  const roomId = event.getRoomId();
  const senderId = event.getSender();
  if (!id || !roomId || !senderId) return null;

  const content = event.getContent<MessageContentShape>();
  const relation = content['m.relates_to'];

  // A replacement carries the new body under `m.new_content`; the SDK applies
  // it to the original event, so an edit event itself is not a timeline entry.
  const isReplacement = relation?.rel_type === 'm.replace';
  if (isReplacement) return null;

  const kind = toMessageKind(content);
  const member = room?.getMember(senderId);
  const decryptionFailed = event.isDecryptionFailure();

  return {
    id,
    roomId,
    senderId,
    senderName: member?.name ?? senderId,
    senderAvatarUrl:
      resolveMediaUrl(client, member?.getMxcAvatarUrl() ?? undefined, {
        width: 64,
        height: 64,
      }) ?? undefined,
    kind,
    body: decryptionFailed ? '' : (content.body ?? ''),
    formattedBody:
      content.format === 'org.matrix.custom.html'
        ? content.formatted_body
        : undefined,
    timestamp: event.getTs(),
    attachment: decryptionFailed
      ? undefined
      : toAttachment(client, content, kind),
    reactions: toReactions(client, room, id),
    isEdited: !!event.replacingEvent(),
    isRedacted: event.isRedacted(),
    threadRootId:
      relation?.rel_type === 'm.thread' ? relation.event_id : undefined,
    replyToId: relation?.['m.in_reply_to']?.event_id,
    isEncrypted: event.isEncrypted(),
    decryptionError: decryptionFailed
      ? 'This message could not be decrypted. The sender may not have shared keys with this device.'
      : undefined,
    structuredEvent: extractStructuredEvent(event, content),
  };
}

/**
 * The `m.direct` account-data map: peer user id → ids of rooms marked as a
 * direct message with them.
 *
 * This is the authoritative record of which rooms are DMs and with whom — it
 * lives in account data, not on the room, so a user's own devices and the
 * other party all agree on it.
 */
export function readDirectMap(client: SdkClient): Record<string, string[]> {
  return (client.getAccountData('m.direct' as never)?.getContent() ??
    {}) as Record<string, string[]>;
}

export function toRoomKind(room: SdkRoom, client: SdkClient): RoomKind {
  // A DM is recorded in m.direct account data, not on the room itself — and it
  // stays there whatever the headcount, so a group DM is simply a DM with more
  // than two people in it. Only a room not in the map is classified as a channel.
  const directRoomIds = new Set<string>(
    Object.values(readDirectMap(client)).flat(),
  );

  if (directRoomIds.has(room.roomId)) {
    return room.getJoinedMemberCount() > 2 ? 'group' : 'direct';
  }
  return 'channel';
}

/** Memberships that mean the room is the caller's to open: joined, or invited and not yet accepted. */
const OPEN_MEMBERSHIPS = new Set(['join', 'invite']);

/**
 * An existing direct-message room shared with `peerUserId`, or `null`.
 *
 * `m.direct` is consulted first, and is the only thing consulted for a room the
 * caller has merely been invited to — its member list has not synced yet, so
 * the scan below cannot see it, and skipping the map here is what produced a
 * duplicate room for every pending DM invite.
 *
 * The fallback scan — for a DM created before this client maintained the map —
 * is deliberately narrow so a two-person *channel* is never taken for a DM
 * (audit B4): the room must be nameless, hold exactly the caller and the peer
 * (an unaccepted invite on either side still counts), and not already be
 * tagged as someone else's DM.
 */
export function resolveDirectMessageRoom(
  client: SdkClient,
  peerUserId: string,
): string | null {
  const directMap = readDirectMap(client);
  const myUserId = client.getUserId();

  for (const roomId of directMap[peerUserId] ?? []) {
    const room = client.getRoom(roomId);
    if (room && OPEN_MEMBERSHIPS.has(room.getMyMembership() ?? '')) {
      return roomId;
    }
  }

  const taggedForSomeoneElse = new Set(
    Object.entries(directMap)
      .filter(([userId]) => userId !== peerUserId)
      .flatMap(([, roomIds]) => roomIds),
  );

  for (const room of client.getRooms()) {
    if (taggedForSomeoneElse.has(room.roomId)) continue;
    if (!OPEN_MEMBERSHIPS.has(room.getMyMembership() ?? '')) continue;
    // A DM is created without a name; a named room is a channel or a group.
    if (room.currentState.getStateEvents('m.room.name', '')) continue;

    const parties = room
      .getMembers()
      .filter((member) => OPEN_MEMBERSHIPS.has(member.membership ?? ''))
      .map((member) => member.userId);

    if (
      parties.length === 2 &&
      parties.includes(peerUserId) &&
      (!myUserId || parties.includes(myUserId))
    ) {
      return room.roomId;
    }

    // A note-to-self DM: the caller is the peer, and the only party is them.
    if (
      peerUserId === myUserId &&
      parties.length === 1 &&
      parties[0] === myUserId
    ) {
      return room.roomId;
    }
  }

  return null;
}

/**
 * An existing room whose members are exactly the caller plus `peerUserIds`, or
 * `null` — so a group conversation reuses what already exists instead of making
 * a duplicate.
 *
 * By default only `m.direct`-tagged rooms are considered. With
 * `includeChannels`, every room the caller is in is fair game: if those exact
 * people already share a private channel, that channel is returned rather than
 * a fresh group-DM room. The match is naturally narrow — a busy channel's
 * member set never equals a handful of hand-picked people.
 */
export function resolveGroupDirectMessageRoom(
  client: SdkClient,
  peerUserIds: string[],
  options: { includeChannels?: boolean } = {},
): string | null {
  const wanted = new Set(peerUserIds);
  if (wanted.size < 2) return null;

  const myUserId = client.getUserId();

  const rooms = options.includeChannels
    ? client.getRooms()
    : [
        ...new Set<string>(Object.values(readDirectMap(client)).flat()),
      ]
        .map((roomId) => client.getRoom(roomId))
        .filter((room): room is NonNullable<typeof room> => room != null);

  for (const room of rooms) {
    if (!OPEN_MEMBERSHIPS.has(room.getMyMembership() ?? '')) continue;

    const others = room
      .getMembers()
      .filter((member) => OPEN_MEMBERSHIPS.has(member.membership ?? ''))
      .map((member) => member.userId)
      .filter((userId) => userId !== myUserId);

    if (
      others.length === wanted.size &&
      others.every((userId) => wanted.has(userId))
    ) {
      return room.roomId;
    }
  }

  return null;
}

export function toRoom(client: SdkClient, room: SdkRoom): Room {
  const kind = toRoomKind(room, client);
  const myUserId = client.getUserId();

  const directUserId =
    kind === 'direct'
      ? room.getJoinedMembers().find((member) => member.userId !== myUserId)
          ?.userId
      : undefined;

  return {
    id: room.roomId,
    kind,
    name: room.name,
    topic: room.currentState.getStateEvents('m.room.topic', '')?.getContent()
      ?.topic,
    avatarUrl:
      resolveMediaUrl(client, room.getMxcAvatarUrl() ?? undefined, {
        width: 96,
        height: 96,
      }) ?? undefined,
    // Room encryption is state, so this is synchronous and safe to read here.
    isEncrypted: !!room.currentState.getStateEvents('m.room.encryption', ''),
    unreadCount: room.getUnreadNotificationCount() ?? 0,
    highlightCount:
      room.getUnreadNotificationCount(NotificationCountType.Highlight) ?? 0,
    lastActivityAt: room.getLastActiveTimestamp(),
    memberCount: room.getJoinedMemberCount(),
    directUserId,
  };
}

/**
 * One threaded conversation, rolled up to the counts a list needs.
 *
 * `hasUnread` is only meaningful once the reader has posted in the thread — the
 * homeserver does not track a per-thread read marker for threads you have never
 * touched, so those always report read.
 */
export function toThread(room: SdkRoom, thread: SdkThread): Thread {
  return {
    rootId: thread.id,
    roomId: room.roomId,
    replyCount: thread.length,
    latestReplyAt: thread.replyToEvent?.getTs(),
    participantIds: [
      ...new Set(
        thread.events
          .map((event) => event.getSender())
          .filter((id): id is string => !!id),
      ),
    ],
    hasUnread: thread.hasCurrentUserParticipated
      ? (room.getThreadUnreadNotificationCount(thread.id) ?? 0) > 0
      : false,
  };
}

export function toRoomMember(
  client: SdkClient,
  member: SdkRoomMember,
): RoomMember {
  return {
    userId: member.userId,
    displayName: member.name,
    avatarUrl:
      resolveMediaUrl(client, member.getMxcAvatarUrl() ?? undefined, {
        width: 64,
        height: 64,
      }) ?? undefined,
    powerLevel: member.powerLevel,
    membership: (member.membership ?? 'leave') as RoomMember['membership'],
  };
}

const PRESENCE_MAP: Record<string, PresenceState> = {
  online: 'online',
  unavailable: 'unavailable',
  offline: 'offline',
};

export function toPresence(
  userId: string,
  presence: string | undefined,
  lastActiveAgo?: number,
  statusMessage?: string,
): Presence {
  return {
    userId,
    state: PRESENCE_MAP[presence ?? 'offline'] ?? 'offline',
    lastActiveAgoMs: lastActiveAgo,
    statusMessage,
  };
}
