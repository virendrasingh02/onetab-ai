import type { MatrixClient as SdkClient } from 'matrix-js-sdk';
import type { MatrixEvent } from 'matrix-js-sdk';
import { NotificationCountType } from 'matrix-js-sdk';
import type {
  Room as SdkRoom,
  RoomMember as SdkRoomMember,
} from 'matrix-js-sdk';
import type {
  Attachment,
  Message,
  MessageKind,
  Presence,
  PresenceState,
  Reaction,
  Room,
  RoomKind,
  RoomMember,
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
  };
}

export function toRoomKind(room: SdkRoom, client: SdkClient): RoomKind {
  // A DM is recorded in m.direct account data, not on the room itself.
  const directRoomIds = new Set<string>(
    Object.values(
      (client.getAccountData('m.direct' as never)?.getContent() ??
        {}) as Record<string, string[]>,
    ).flat(),
  );

  if (directRoomIds.has(room.roomId)) return 'direct';
  return room.getJoinedMemberCount() > 2 ? 'channel' : 'group';
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
