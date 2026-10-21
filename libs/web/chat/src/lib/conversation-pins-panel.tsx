import { PinnedPanel } from '@org/chat-ui';
import type { Message } from '@org/types';
import { EmptyState, SkeletonList, toast } from '@org/ui';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { MessageSquareOff, Pin } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useMatrix } from './matrix-provider.js';
import { useRoomActions, useRoomSummary } from './use-chat.js';

const NO_PINS: string[] = [];

const pinnedMessageKey = (roomId: string | undefined, eventId: string) =>
  ['matrix', 'pinned-message', roomId, eventId] as const;

/**
 * How many messages are pinned in a room — `m.room.pinned_events` state, so it
 * updates live for everyone in the room. Drives the Pins tab's count badge.
 */
export function useConversationPinCount(roomId: string | null | undefined): number {
  const { room } = useRoomSummary(roomId ?? undefined);
  return room?.pinnedEventIds?.length ?? 0;
}

export interface ConversationPinsPanelProps {
  /** The Matrix room whose pins are listed. */
  roomId: string | null | undefined;
  /** Switches the page back to its Messages tab — called after a jump. */
  onShowInChat: () => void;
}

/**
 * A conversation's Pins tab — channels and DMs alike.
 *
 * Pins are `m.room.pinned_events` room state (the same list the in-chat
 * "Pinned messages" panel and banner read), so pinning from a message's menu
 * lands here immediately and is shared with everyone in the room. Each pinned
 * event is fetched on its own and cached per id, so pinning one more message
 * fetches only that one.
 */
export function ConversationPinsPanel({ roomId, onShowInChat }: ConversationPinsPanelProps) {
  const { client, configStatus } = useMatrix();
  const { room } = useRoomSummary(roomId ?? undefined);
  const actions = useRoomActions(roomId ?? undefined);
  const queryClient = useQueryClient();
  const [, setSearchParams] = useSearchParams();
  const location = useLocation();

  const pinnedIds = room?.pinnedEventIds ?? NO_PINS;
  const canPin = room?.canPin ?? false;

  const queries = useQueries({
    queries: pinnedIds.map((eventId) => ({
      queryKey: pinnedMessageKey(roomId ?? undefined, eventId),
      enabled: !!client && !!roomId,
      staleTime: 5 * 60_000,
      queryFn: async () =>
        client && roomId ? ((await client.fetchMessage(roomId, eventId)) ?? null) : null,
    })),
  });

  // Newest pin first, matching the in-chat panel. A pin whose event can no
  // longer be fetched (redacted, or history the reader cannot see) is skipped.
  const messages = useMemo(
    () =>
      queries
        .map((query) => query.data)
        .filter((message): message is Message => !!message)
        .reverse(),
    [queries],
  );
  const loading = queries.some((query) => query.isLoading);

  const linkParams = useCallback((message: Message) => {
    const params = new URLSearchParams();
    if (message.threadRootId) params.set('thread', message.threadRootId);
    params.set('msg', message.id);
    return params;
  }, []);

  /* The chat reads `?msg=` (and `?thread=`) when it mounts and scrolls to the
     message, paging older history in if it has to — the same path a
     notification deep link takes. */
  const showInChat = useCallback(
    (messageId: string, threadRootId?: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('thread');
        if (threadRootId) next.set('thread', threadRootId);
        next.set('msg', messageId);
        return next;
      });
      onShowInChat();
    },
    [setSearchParams, onShowInChat],
  );

  const handleJump = useCallback(
    (messageId: string) => {
      const message = messages.find((entry) => entry.id === messageId);
      showInChat(messageId, message?.threadRootId);
    },
    [messages, showInChat],
  );

  const handleUnpin = useCallback(
    async (messageId: string) => {
      if (!client || !roomId) return;
      try {
        await client.setMessagePinned(roomId, messageId, false);
        toast.success('Unpinned');
      } catch {
        toast.error('Could not unpin the message.');
      }
    },
    [client, roomId],
  );

  const handleReact = useCallback(
    async (messageId: string, key: string, reactedByMe: boolean) => {
      try {
        await actions.toggleReaction(messageId, key, reactedByMe);
      } finally {
        // Fetched messages are a snapshot; refetch so the pill reflects it.
        void queryClient.invalidateQueries({
          queryKey: pinnedMessageKey(roomId ?? undefined, messageId),
        });
      }
    },
    [actions, queryClient, roomId],
  );

  const handleCopyLink = useCallback(
    async (message: Message) => {
      const url = `${window.location.origin}${location.pathname}?${linkParams(message).toString()}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied');
      } catch {
        toast.error('Could not copy the link.');
      }
    },
    [location.pathname, linkParams],
  );

  if (configStatus === 'disabled') {
    return (
      <EmptyState
        icon={<MessageSquareOff />}
        title="Chat is not configured"
        description="Pins are part of the conversation, which needs a Matrix homeserver."
      />
    );
  }

  if (!roomId || (loading && messages.length === 0)) {
    return (
      <div className="px-4 py-4 sm:px-6">
        <SkeletonList rows={3} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-4 border-b border-border/40 pt-3 pb-2.5 sm:mx-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Pin className="size-4 text-primary" />
          <span>Pinned messages</span>
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {canPin
            ? 'Pin a message from its menu to keep it here for everyone in this conversation.'
            : 'Messages pinned for everyone in this conversation.'}
        </p>
      </div>
      <PinnedPanel
        messages={messages}
        onJump={handleJump}
        onUnpin={canPin ? (id) => void handleUnpin(id) : undefined}
        onReact={(id, key, reactedByMe) => void handleReact(id, key, reactedByMe)}
        onOpenThread={(id) => showInChat(id, id)}
        onCopyLink={(message) => void handleCopyLink(message)}
      />
    </div>
  );
}
