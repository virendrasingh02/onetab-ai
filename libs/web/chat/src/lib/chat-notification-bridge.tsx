import { notificationApi } from '@org/api-client';
import {
  claimNotification,
  notificationService,
  notificationSound,
} from '@org/notifications';
import { toPlatformUserId, type Message, type Room } from '@org/types';
import { toPlainMessageText } from '@org/utils';
import { useEffect, useRef } from 'react';
import {
  getActiveConversation,
  subscribeActiveConversation,
} from './active-conversation.js';
import { useMatrix } from './matrix-provider.js';

export interface ChatNotificationBridgeProps {
  /** Quiet hours: nothing from chat — no notification, no sound. */
  suppressed?: boolean;
  /**
   * The per-workspace "mute sounds" switch. Only the sound goes; the
   * notification still shows.
   */
  soundMuted?: boolean;
  /**
   * The workspace's "mentions only" delivery preference — when on, plain
   * channel messages stay quiet. Mentions, direct and group messages still get
   * through, as the setting says.
   */
  mentionsOnly?: boolean;
  /** Lower-cased names of channels this user has muted. */
  mutedChannelNames?: ReadonlySet<string>;
  /** Lower-cased display names of DM peers this user has muted. */
  mutedPeerNames?: ReadonlySet<string>;
  /**
   * Lower-cased names of channels whose own level is "Just mentions": the
   * channel-level counterpart of `mentionsOnly`.
   */
  mentionsOnlyChannelNames?: ReadonlySet<string>;
  /** Active workspace id: where chat rows are filed for the bell and phones. */
  workspaceId?: string;
  /** Active workspace slug, for building a conversation's route. */
  workspaceSlug?: string;
  /** Matrix room id → route, for this workspace's channels. */
  channelRoutes?: ReadonlyMap<string, string>;
  /** Opens a conversation when the user clicks a notification. */
  onNavigate?: (route: string) => void;
}

/**
 * How long a hidden tab waits before claiming a message, so a tab the user is
 * actually in always wins and the hidden one does not raise an OS notification
 * for something already on screen.
 */
const HIDDEN_TAB_CLAIM_DELAY_MS = 250;

/** What the notification says, without leaking a raw filename or a blank line. */
function previewOf(message: Message): string {
  if (message.decryptionError) return 'Sent an encrypted message';
  switch (message.kind) {
    case 'image':
      return 'Sent a photo';
    case 'video':
      return 'Sent a video';
    case 'audio':
      return 'Sent an audio file';
    case 'voice':
      return 'Sent a voice message';
    case 'file':
      return message.attachment?.name
        ? `Sent a file: ${message.attachment.name}`
        : 'Sent a file';
    default:
      break;
  }
  const text = toPlainMessageText(message.body ?? '').trim();
  if (text) return text;
  return message.forwarded ? 'Forwarded a message' : 'Sent a message';
}

function titleOf(message: Message, room: Room | null | undefined): string {
  if (!room || room.kind === 'direct') return message.senderName;
  const where = room.kind === 'channel' ? `#${room.name}` : room.name;
  if (message.isMention)
    return `${message.senderName} mentioned you in ${where}`;
  return message.threadRootId && !message.alsoSentToChannel
    ? `${message.senderName} replied in ${where}`
    : `${message.senderName} in ${where}`;
}

/**
 * Where a click lands. A channel from another workspace has no entry in
 * `channelRoutes`; its notification still shows, it just cannot open the channel.
 */
function routeOf(
  message: Message,
  room: Room | null | undefined,
  workspaceSlug: string | undefined,
  channelRoutes: ReadonlyMap<string, string> | undefined,
): string | undefined {
  let route = channelRoutes?.get(message.roomId);
  if (!route && workspaceSlug && room?.kind === 'direct' && room.directUserId) {
    route = `/w/${workspaceSlug}/dms/${toPlatformUserId(room.directUserId)}`;
  }
  if (!route && workspaceSlug && room?.kind === 'group') {
    route = `/w/${workspaceSlug}/dms?room=${encodeURIComponent(room.id)}`;
  }
  if (!route || !message.threadRootId || message.alsoSentToChannel)
    return route;
  const separator = route.includes('?') ? '&' : '?';
  return `${route}${separator}thread=${encodeURIComponent(message.threadRootId)}`;
}

/**
 * Files the message in the user's bell and on their phones. The server works
 * out a room's workspace, so a channel elsewhere is filed there; without a route
 * here it builds the link itself. Message text stays on this device for an
 * encrypted room, and when previews are off: push passes through a third party.
 */
function reportToApi(
  message: Message,
  room: Room | null | undefined,
  route: string | undefined,
  workspaceId: string | undefined,
  workspaceSlug: string | undefined,
): void {
  const prefix = `/w/${workspaceSlug}/`;
  const { showContentPreview } = notificationService.getPreferences();
  void notificationApi
    .reportChatMessage({
      roomId: message.roomId,
      eventId: message.id,
      title: showContentPreview ? titleOf(message, room) : 'New message',
      body:
        showContentPreview && !room?.isEncrypted ? previewOf(message) : null,
      deepLink: route?.startsWith(prefix) ? route.slice(prefix.length) : null,
      threadRootId: message.alsoSentToChannel ? null : message.threadRootId,
      senderId: toPlatformUserId(message.senderId),
      isMention: message.isMention,
      isGroup: room?.kind === 'group',
      workspaceId,
    })
    .catch(() => {
      // The native notification already showed; the bell can miss this one.
    });
}

/**
 * Turns incoming Matrix chat traffic into notifications.
 *
 * Chat is Matrix-native: plain messages and DMs never reach the server's
 * `notification.created` stream, and a channel mention only does when the
 * homeserver's appservice push reaches the API. So this bridge owns every chat
 * notification, mentions included — it has the sender and the text, which the server
 * deliberately never sees. `RealtimeNotificationsBridge` keeps tasks, invites,
 * calls and the like, and stands in for mentions only when no Matrix client is
 * running. Each message goes through {@link notificationService}, so it gets the
 * same OS notification, preview privacy, call suppression and sound as
 * everything else.
 *
 *  - never for the user's own messages, local echoes, edits/redactions
 *  - never for backfill during the initial sync (only events newer than mount)
 *  - never for system rows ("X joined the channel")
 *  - never for a muted channel / muted DM / quiet hours
 *  - only the existing sound rule when the user is looking at that conversation
 *  - a native OS notification otherwise, even with the app focused on another
 *    conversation: there is no in-app toast to fall back on
 *  - one notification per conversation: a burst updates it instead of stacking
 *  - one tab per browser acts on a given message
 *  - each notified message is reported to the API for the bell and phones, and
 *    opening the conversation clears that row
 *
 * Renders nothing.
 */
export function ChatNotificationBridge({
  suppressed = false,
  soundMuted = false,
  mentionsOnly = false,
  mutedChannelNames,
  mutedPeerNames,
  mentionsOnlyChannelNames,
  workspaceId,
  workspaceSlug,
  channelRoutes,
  onNavigate,
}: ChatNotificationBridgeProps) {
  const { client } = useMatrix();

  // Keep the latest gate values in a ref so the Matrix subscription does not
  // need to be town down and rebuilt every time a preference changes.
  const gates = {
    suppressed,
    soundMuted,
    mentionsOnly,
    mutedChannelNames,
    mutedPeerNames,
    mentionsOnlyChannelNames,
    workspaceId,
    workspaceSlug,
    channelRoutes,
    onNavigate,
  };
  const gate = useRef(gates);
  gate.current = gates;

  useEffect(() => {
    if (!client) return;

    // Anything with a timestamp at or before this is history the sync replayed,
    // not something that just happened.
    const readyAt = Date.now();
    const myUserId = client.getSession()?.userId ?? null;

    const unsubscribe = client.on((event) => {
      try {
        if (event.type !== 'message.received') return;
        const message = event.message;

        // Own message / local echo / not-yet-acked send.
        if (myUserId && message.senderId === myUserId) return;
        if (message.sendState && message.sendState !== 'sent') return;
        if (message.transactionId) return;

        // Edits and redactions arrive as `message.received` for some servers —
        // guard on the flags the domain model exposes.
        if (message.isRedacted || message.isEdited) return;

        // Backfill from the initial sync.
        if (
          typeof message.timestamp === 'number' &&
          message.timestamp <= readyAt
        ) {
          return;
        }

        // "X joined the channel" and friends are a timeline row, not a message
        // anyone sent you.
        if (message.structuredEvent?.type === 'mie.system_event') return;

        const {
          suppressed: isSuppressed,
          soundMuted: isSoundMuted,
          mentionsOnly: onlyMentions,
          mutedChannelNames: mutedChannels,
          mutedPeerNames: mutedPeers,
          mentionsOnlyChannelNames: mentionsOnlyChannels,
          workspaceId: activeWorkspaceId,
          workspaceSlug: slug,
          channelRoutes: routes,
          onNavigate: navigate,
        } = gate.current;

        if (isSuppressed) return;

        // Replies in a thread the reader turned notifications off for — only an
        // @mention still gets through.
        if (
          message.threadRootId &&
          !message.isMention &&
          client.isThreadMuted(message.roomId, message.threadRootId)
        ) {
          return;
        }

        const room = client.getRoom(message.roomId);
        const roomName = room?.name?.toLowerCase().trim() ?? '';
        const isDirect = room?.kind === 'direct';
        const isChannel = !!room && room.kind === 'channel';

        // Muted conversation.
        if (isDirect) {
          if (mutedPeers && roomName && mutedPeers.has(roomName)) return;
        } else if (mutedChannels && roomName && mutedChannels.has(roomName)) {
          return;
        }

        // "Mentions only" — workspace-wide, or this channel's own level. It
        // quiets channel traffic; a mention, direct or group message is still
        // for you.
        const channelMentionsOnly =
          !isDirect && !!roomName && !!mentionsOnlyChannels?.has(roomName);
        if (
          !message.isMention &&
          ((onlyMentions && isChannel) || channelMentionsOnly)
        ) {
          return;
        }

        const visible =
          typeof document !== 'undefined' &&
          document.visibilityState === 'visible';
        const focused = visible && document.hasFocus();
        const isViewingConversation =
          focused && getActiveConversation() === message.roomId;
        // A DM keeps its own cue: every message in one is already "for you".
        const cue = isDirect ? 'dm' : message.isMention ? 'mention' : 'message';
        const claimKey = `chat:${message.id}`;

        // On screen already: no notification. Claiming still matters — it stops a
        // hidden tab raising an OS notification for what the user is reading.
        if (isViewingConversation) {
          if (claimNotification(claimKey) && !isSoundMuted) {
            notificationSound.play(cue, {
              dedupeKey: message.id,
              isViewingConversation,
            });
          }
          return;
        }

        const route = routeOf(message, room, slug, routes);
        const deliver = () => {
          if (!claimNotification(claimKey)) return;
          void notificationService.notify({
            id: message.id,
            tag: `chat:${message.roomId}`,
            title: titleOf(message, room),
            body: previewOf(message),
            type: 'message',
            priority: message.isMention ? 'high' : 'normal',
            soundEvent: isSoundMuted ? 'none' : cue,
            route,
            onActivate: route && navigate ? () => navigate(route) : undefined,
            skipTaskbarFlash: focused,
          });
          reportToApi(message, room, route, activeWorkspaceId, slug);
        };

        if (visible) deliver();
        else setTimeout(deliver, HIDDEN_TAB_CLAIM_DELAY_MS);
      } catch {
        // A notification must never be able to break message delivery.
      }
    });

    return unsubscribe;
  }, [client]);

  // Reading a conversation clears its row. Focus counts too: a message that
  // landed while the user was away from an open conversation was reported.
  useEffect(() => {
    const markRead = () => {
      const roomId = getActiveConversation();
      if (!roomId) return;
      void notificationApi.markChatRoomRead(roomId).catch(() => undefined);
    };
    markRead();
    const unsubscribe = subscribeActiveConversation(markRead);
    window.addEventListener('focus', markRead);
    return () => {
      unsubscribe();
      window.removeEventListener('focus', markRead);
    };
  }, []);

  return null;
}
