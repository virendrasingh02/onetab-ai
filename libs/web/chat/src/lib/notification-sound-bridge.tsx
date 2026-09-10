import { notificationSound } from '@org/notifications';
import { useEffect, useRef } from 'react';
import { getActiveConversation } from './active-conversation.js';
import { useMatrix } from './matrix-provider.js';

export interface NotificationSoundBridgeProps {
  /**
   * Suppress every non-critical chat sound: per-workspace sound mute, quiet
   * hours, or Focus Mode. Mentions still route through the server notification
   * path, which has its own gate.
   */
  suppressed?: boolean;
  /**
   * The workspace's "mentions only" delivery preference — when on, plain
   * channel / DM messages get no sound (only the mention cue, via the server
   * notification path).
   */
  mentionsOnly?: boolean;
  /** Lower-cased names of channels this user has muted. */
  mutedChannelNames?: ReadonlySet<string>;
  /** Lower-cased display names of DM peers this user has muted. */
  mutedPeerNames?: ReadonlySet<string>;
}

/**
 * Turns incoming Matrix chat traffic into calm audio cues.
 *
 * Chat messages and DMs never reach the server's `notification.created` stream
 * (they are Matrix-native), so `RealtimeNotificationsBridge` — which owns the
 * sound for mentions, tasks, invites, calls and so on — cannot see them. This
 * bridge is their counterpart: it listens to the one Matrix client and asks
 * {@link notificationSound} for a `dm` / `message` cue, with every "should this
 * make a sound at all" rule applied first:
 *
 *  - never for the user's own messages, local echoes, edits/redactions
 *  - never for backfill during the initial sync (only events newer than mount)
 *  - never for a hidden tab (the OS notification carries the background sound)
 *  - never for a muted channel / muted DM / suppressed workspace
 *  - reduced or skipped when the user is already looking at that conversation
 *
 * Grouping, de-duplication, per-event opt-out, volume and the master switch are
 * all handled inside `notificationSound`. Renders nothing.
 */
export function NotificationSoundBridge({
  suppressed = false,
  mentionsOnly = false,
  mutedChannelNames,
  mutedPeerNames,
}: NotificationSoundBridgeProps) {
  const { client } = useMatrix();

  // Keep the latest gate values in a ref so the Matrix subscription does not
  // need to be town down and rebuilt every time a preference changes.
  const gate = useRef({ suppressed, mentionsOnly, mutedChannelNames, mutedPeerNames });
  gate.current = { suppressed, mentionsOnly, mutedChannelNames, mutedPeerNames };

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
        if (typeof message.timestamp === 'number' && message.timestamp <= readyAt) {
          return;
        }

        const {
          suppressed: isSuppressed,
          mentionsOnly: onlyMentions,
          mutedChannelNames: mutedChannels,
          mutedPeerNames: mutedPeers,
        } = gate.current;

        if (isSuppressed) return;

        const room = client.getRoom(message.roomId);
        const roomName = room?.name?.toLowerCase().trim() ?? '';
        const isDirect = room?.kind === 'direct';

        // Muted conversation.
        if (isDirect) {
          if (mutedPeers && roomName && mutedPeers.has(roomName)) return;
        } else if (mutedChannels && roomName && mutedChannels.has(roomName)) {
          return;
        }

        // A channel message that mentions the user is owned by the server
        // `notification.created` (MENTION) path, which plays the distinct
        // mention cue. Playing the plain "message" tick here as well would
        // double up. A DM keeps its `dm` cue regardless — DMs never raise a
        // server notification.
        if (!isDirect && message.isMention) return;

        // "Mentions only" — a plain message gets no cue (the mention cue still
        // comes from the server path above).
        if (onlyMentions && !message.isMention) return;

        const isViewingConversation =
          getActiveConversation() === message.roomId &&
          typeof document !== 'undefined' &&
          document.visibilityState === 'visible' &&
          document.hasFocus();

        notificationSound.play(isDirect ? 'dm' : 'message', {
          dedupeKey: message.id,
          isViewingConversation,
        });
      } catch {
        // A sound must never be able to break message delivery.
      }
    });

    return unsubscribe;
  }, [client]);

  return null;
}
