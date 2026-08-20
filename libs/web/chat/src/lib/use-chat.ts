import type { Message, Presence, RoomId, RoomMember } from '@org/matrix-client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMatrix } from './matrix-provider.js';

interface ChatState {
  messages: Message[];
  members: RoomMember[];
  typingUserIds: string[];
  isLoading: boolean;
  isLoadingOlder: boolean;
  hasMore: boolean;
  error: string | null;
}

/**
 * Live view of one room.
 *
 * State is kept in a reducer-like local store rather than TanStack Query: a
 * Matrix timeline is a push stream, not a cache to invalidate, and modelling
 * it as a query would mean refetching a room every time an event arrives.
 */
export function useRoom(roomId: RoomId | undefined) {
  const { client } = useMatrix();
  const [state, setState] = useState<ChatState>({
    messages: [],
    members: [],
    typingUserIds: [],
    isLoading: true,
    isLoadingOlder: false,
    hasMore: false,
    error: null,
  });

  // Initial load whenever the room changes.
  useEffect(() => {
    if (!client || !roomId) {
      setState((current) => ({ ...current, isLoading: !!roomId }));
      return;
    }

    let cancelled = false;
    setState((current) => ({ ...current, isLoading: true, error: null }));

    try {
      const timeline = client.getTimeline(roomId);
      const members = client.getMembers(roomId);
      if (cancelled) return;

      setState({
        messages: timeline.messages,
        members,
        typingUserIds: [],
        isLoading: false,
        isLoadingOlder: false,
        hasMore: timeline.hasMore,
        error: null,
      });
    } catch (error) {
      if (!cancelled) {
        setState((current) => ({
          ...current,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load.',
        }));
      }
    }

    return () => {
      cancelled = true;
    };
  }, [client, roomId]);

  // Live updates.
  useEffect(() => {
    if (!client || !roomId) return;

    return client.on((event) => {
      switch (event.type) {
        case 'message.received':
          if (event.message.roomId !== roomId) return;
          setState((current) =>
            // The SDK can replay an event; never append a duplicate.
            current.messages.some((m) => m.id === event.message.id)
              ? current
              : { ...current, messages: [...current.messages, event.message] },
          );
          break;

        case 'message.updated':
          if (event.message.roomId !== roomId) return;
          setState((current) => ({
            ...current,
            messages: current.messages.map((message) =>
              message.id === event.message.id ? event.message : message,
            ),
          }));
          break;

        case 'message.redacted':
          if (event.roomId !== roomId) return;
          setState((current) => ({
            ...current,
            messages: current.messages.map((message) =>
              message.id === event.eventId
                ? { ...message, isRedacted: true, body: '' }
                : message,
            ),
          }));
          break;

        case 'typing':
          if (event.update.roomId !== roomId) return;
          setState((current) => ({
            ...current,
            typingUserIds: event.update.userIds,
          }));
          break;

        default:
          break;
      }
    });
  }, [client, roomId]);

  const loadOlder = useCallback(async () => {
    if (!client || !roomId) return;
    setState((current) => ({ ...current, isLoadingOlder: true }));

    try {
      const page = await client.loadOlderMessages(roomId);
      setState((current) => ({
        ...current,
        // Prepend: this page is older than everything already loaded.
        messages: [...page.messages, ...current.messages],
        hasMore: page.hasMore,
        isLoadingOlder: false,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        isLoadingOlder: false,
        error: error instanceof Error ? error.message : 'Failed to load more.',
      }));
    }
  }, [client, roomId]);

  const typingNames = useMemo(
    () =>
      state.typingUserIds.map(
        (userId) =>
          state.members.find((member) => member.userId === userId)
            ?.displayName ?? userId,
      ),
    [state.typingUserIds, state.members],
  );

  return { ...state, typingNames, loadOlder };
}

/** Message actions for a room, with the room id already bound. */
export function useRoomActions(roomId: RoomId | undefined) {
  const { client } = useMatrix();

  const send = useCallback(
    async (body: string, threadRootId?: string) => {
      if (!client || !roomId) return;
      await client.sendMessage(roomId, body, { threadRootId });
    },
    [client, roomId],
  );

  const edit = useCallback(
    async (eventId: string, body: string) => {
      if (!client || !roomId) return;
      await client.editMessage(roomId, eventId, body);
    },
    [client, roomId],
  );

  const remove = useCallback(
    async (eventId: string) => {
      if (!client || !roomId) return;
      await client.deleteMessage(roomId, eventId);
    },
    [client, roomId],
  );

  /** Adds the reaction, or removes it when the user already reacted. */
  const toggleReaction = useCallback(
    async (eventId: string, key: string, alreadyReacted: boolean) => {
      if (!client || !roomId) return;
      if (alreadyReacted) {
        await client.removeReaction(roomId, eventId, key);
      } else {
        await client.react(roomId, eventId, key);
      }
    },
    [client, roomId],
  );

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!client || !roomId) return;
      void client.setTyping(roomId, isTyping);
    },
    [client, roomId],
  );

  const markRead = useCallback(
    (eventId: string) => {
      if (!client || !roomId) return;
      void client.markRead(roomId, eventId);
    },
    [client, roomId],
  );

  const attach = useCallback(
    async (files: FileList, threadRootId?: string) => {
      if (!client || !roomId) return;
      for (const file of Array.from(files)) {
        await client.sendFile(roomId, file, { threadRootId });
      }
    },
    [client, roomId],
  );

  return { send, edit, remove, toggleReaction, setTyping, markRead, attach };
}

export function usePresence(userIds: string[]) {
  const { client } = useMatrix();
  const [presence, setPresence] = useState<Record<string, Presence>>({});

  useEffect(() => {
    if (!client) return;

    setPresence(
      Object.fromEntries(
        userIds.map((userId) => [userId, client.getPresence(userId)]),
      ),
    );

    return client.on((event) => {
      if (event.type !== 'presence') return;
      setPresence((current) => ({
        ...current,
        [event.presence.userId]: event.presence,
      }));
    });
    // `userIds` is a new array each render; join it so the effect is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, userIds.join(',')]);

  return useCallback(
    (userId: string) => presence[userId]?.state ?? 'offline',
    [presence],
  );
}
