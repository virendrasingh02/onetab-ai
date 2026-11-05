import { remindersApi } from '@org/api-client';
import { describeReminderTime } from '@org/chat-ui';
import type { Message } from '@org/matrix-client';
import { toast } from '@org/ui';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  lazy,
  Suspense,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import type { ForwardMessageSource } from './forward-message-dialog.js';
import { useMatrix } from './matrix-provider.js';
import type { CrossRoomThread } from './use-all-threads.js';
import { useRoomSummary } from './use-chat.js';
import { useSavedIds, useToggleSaved } from './use-saved-messages.js';

const ForwardMessageDialog = lazy(() =>
  import('./forward-message-dialog.js').then((m) => ({
    default: m.ForwardMessageDialog,
  })),
);

const NO_IDS: readonly string[] = [];

/** `/w/acme/channels/general?thread=…` + `msg` → the message itself, highlighted. */
function messageHref(conversationLink: string, messageId: string): string {
  const url = new URL(conversationLink, window.location.origin);
  url.searchParams.set('msg', messageId);
  return `${url.pathname}${url.search}`;
}

/** The same link without `/w/:slug/` — the workspace-relative form saved items,
 *  reminders and forwards store. */
function workspaceRelative(href: string): string {
  return /^\/w\/[^/]+\/(.+)$/.exec(href)?.[1] ?? href;
}

/**
 * The hover-toolbar and "⋯" actions a message gets in the Threads inbox —
 * the same set the conversation itself offers (open where it lives, forward,
 * save, pin, mark unread, remind, reply notifications), resolved against the
 * thread's own room since this page lists threads from many rooms.
 *
 * `forwardDialog` must be rendered by the caller; it is empty until someone
 * forwards.
 */
export function useThreadMessageActions(
  thread: CrossRoomThread,
  conversationLink: string,
  isPrivate: boolean | undefined,
) {
  const navigate = useNavigate();
  const { client } = useMatrix();
  const { workspaceId } = useCurrentWorkspace();
  const { room } = useRoomSummary(thread.roomId);
  const savedIds = useSavedIds(thread.roomId);
  const setSaved = useToggleSaved();
  const [forwardSource, setForwardSource] =
    useState<ForwardMessageSource | null>(null);

  const isChannel = thread.roomKind === 'channel';
  const pinnedIds = room?.pinnedEventIds ?? NO_IDS;
  const mutedThreadRootIds = room?.mutedThreadRootIds ?? NO_IDS;
  const canPin = room?.canPin ?? false;

  const openInConversation = useCallback(
    (message: Message) => navigate(messageHref(conversationLink, message.id)),
    [navigate, conversationLink],
  );

  const forward = useCallback(
    (message: Message) =>
      setForwardSource({
        message,
        roomKind: thread.roomKind,
        roomName: isChannel ? thread.roomName : undefined,
        isPrivate: !isChannel || (isPrivate ?? false),
        link: workspaceRelative(messageHref(conversationLink, message.id)),
      }),
    [thread.roomKind, thread.roomName, isChannel, isPrivate, conversationLink],
  );

  const isSaved = useCallback(
    (messageId: string) => savedIds.includes(messageId),
    [savedIds],
  );

  const toggleSave = useCallback(
    (message: Message) => {
      const href = messageHref(conversationLink, message.id);
      setSaved(
        {
          id: message.id,
          roomId: thread.roomId,
          channelName: thread.roomName,
          senderId: message.senderId,
          senderName: message.senderName,
          senderAvatarUrl: message.senderAvatarUrl,
          body: message.body || message.attachment?.name || '',
          sentAt: message.timestamp,
          savedAt: Date.now(),
          channelSlug: isChannel
            ? /^\/w\/[^/]+\/c\/([^/?#]+)/.exec(href)?.[1]
            : undefined,
          href: workspaceRelative(href),
        },
        savedIds.includes(message.id),
      );
    },
    [
      conversationLink,
      setSaved,
      thread.roomId,
      thread.roomName,
      isChannel,
      savedIds,
    ],
  );

  const isPinned = useCallback(
    (messageId: string) => pinnedIds.includes(messageId),
    [pinnedIds],
  );

  const togglePin = useCallback(
    async (message: Message) => {
      if (!client) return;
      const pin = !pinnedIds.includes(message.id);
      try {
        await client.setMessagePinned(thread.roomId, message.id, pin);
        toast.success(pin ? 'Pinned for everyone here' : 'Unpinned');
      } catch {
        toast.error(
          pin ? 'Could not pin the message.' : 'Could not unpin the message.',
        );
      }
    },
    [client, thread.roomId, pinnedIds],
  );

  const markUnread = useCallback(
    async (message: Message) => {
      if (!client) return;
      try {
        await client.markUnread(thread.roomId, message.id);
        toast.success('Marked unread', {
          description: 'It stays unread until you come back to it.',
        });
      } catch {
        toast.error('Could not mark the message unread.');
      }
    },
    [client, thread.roomId],
  );

  const remind = useCallback(
    async (message: Message, remindAt: Date) => {
      if (!workspaceId) return;
      try {
        const reminder = await remindersApi.create(workspaceId, {
          roomId: thread.roomId,
          eventId: message.id,
          remindAt: remindAt.toISOString(),
          deepLink: workspaceRelative(
            messageHref(conversationLink, message.id),
          ),
          snippet: (message.body || message.attachment?.name || '').slice(
            0,
            140,
          ),
        });
        toast.success(`I'll remind you ${describeReminderTime(remindAt)}`, {
          action: {
            label: 'Undo',
            onClick: () => {
              void remindersApi
                .cancel(workspaceId, reminder.id)
                .then(() => toast.success('Reminder cancelled'))
                .catch(() => toast.error('Could not cancel the reminder.'));
            },
          },
        });
      } catch {
        toast.error('Could not set the reminder.');
      }
    },
    [workspaceId, thread.roomId, conversationLink],
  );

  const replyNotificationsMuted = mutedThreadRootIds.includes(thread.id);

  const toggleReplyNotifications = useCallback(async () => {
    if (!client) return;
    const mute = !replyNotificationsMuted;
    try {
      await client.setThreadNotificationsMuted(thread.roomId, thread.id, mute);
      toast.success(
        mute
          ? "You won't be notified about replies — @mentions still reach you."
          : "You'll be notified about new replies.",
      );
    } catch {
      toast.error('Could not update reply notifications.');
    }
  }, [client, thread.roomId, thread.id, replyNotificationsMuted]);

  // Fetched the first time someone forwards, not with the page.
  const forwardDialog: ReactNode = forwardSource ? (
    <Suspense fallback={null}>
      <ForwardMessageDialog
        source={forwardSource}
        onOpenChange={(open) => {
          if (!open) setForwardSource(null);
        }}
        onCopyLink={(message) => {
          const url = new URL(
            messageHref(conversationLink, message.id),
            window.location.origin,
          );
          void navigator.clipboard
            ?.writeText(url.toString())
            .then(() => toast.success('Link copied'))
            .catch(() => toast.error('Could not copy the link.'));
        }}
      />
    </Suspense>
  ) : null;

  return useMemo(
    () => ({
      openInConversation,
      forward,
      isSaved,
      toggleSave,
      isPinned,
      togglePin: canPin ? togglePin : undefined,
      markUnread,
      remind: workspaceId ? remind : undefined,
      replyNotificationsMuted,
      toggleReplyNotifications,
      forwardDialog,
    }),
    [
      openInConversation,
      forward,
      isSaved,
      toggleSave,
      isPinned,
      canPin,
      togglePin,
      markUnread,
      workspaceId,
      remind,
      replyNotificationsMuted,
      toggleReplyNotifications,
      forwardDialog,
    ],
  );
}

export type ThreadMessageActions = ReturnType<typeof useThreadMessageActions>;
