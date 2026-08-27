import { useReadReceipts } from '@org/common';
import type {
  Message,
  Presence,
  Room,
  RoomId,
  RoomMember,
  Thread,
} from '@org/matrix-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

/** Reads a room's current timeline and roster synchronously from the client. */
function loadRoomState(
  client: ReturnType<typeof useMatrix>['client'],
  roomId: RoomId | undefined,
): ChatState {
  if (!client || !roomId) {
    // `roomId` unset while its room is still resolving (a channel or DM being
    // opened) is "loading"; unset because there is simply no room to show
    // (chat disabled, nothing selected) is not.
    return {
      messages: [],
      members: [],
      typingUserIds: [],
      isLoading: !!roomId,
      isLoadingOlder: false,
      hasMore: false,
      error: null,
    };
  }

  try {
    const timeline = client.getTimeline(roomId);
    return {
      messages: timeline.messages,
      members: client.getMembers(roomId),
      typingUserIds: [],
      isLoading: false,
      isLoadingOlder: false,
      hasMore: timeline.hasMore,
      error: null,
    };
  } catch (error) {
    return {
      messages: [],
      members: [],
      typingUserIds: [],
      isLoading: false,
      isLoadingOlder: false,
      hasMore: false,
      error: error instanceof Error ? error.message : 'Failed to load.',
    };
  }
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
  const [state, setState] = useState<ChatState>(() =>
    loadRoomState(client, roomId),
  );

  /*
   * Resets `state` the moment `roomId` (or the client) changes, during render
   * rather than in an effect. An effect would commit and paint the *previous*
   * room's messages under the new room's header first and only correct it a
   * tick later — a one-frame flash of the wrong conversation on every switch.
   * This is React's documented pattern for resetting state when a prop
   * changes without needing to remount the component around a `key`, which is
   * what made that flash unavoidable here before: see `ChatPanel`.
   */
  const bound = useRef({ client, roomId });
  if (bound.current.client !== client || bound.current.roomId !== roomId) {
    bound.current = { client, roomId };
    setState(loadRoomState(client, roomId));
  }

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

  const readReceiptsEnabled = useReadReceipts();

  useEffect(() => {
    if (!client || !roomId || !readReceiptsEnabled) return;
    const latest = state.messages[state.messages.length - 1];
    if (latest && latest.sendState !== 'sending') {
      void client.markRead(roomId, latest.id);
    }
  }, [client, roomId, readReceiptsEnabled, state.messages]);

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

export interface RoomSummary {
  room: Room | null;
  members: RoomMember[];
}

/**
 * A room's name, kind and roster, kept live — without loading its timeline.
 *
 * `useRoom` is the whole conversation (messages, typing, pagination); this is
 * only what a title bar needs, so a group DM's header can react to a rename or
 * someone joining without paying for the message history.
 */
export function useRoomSummary(roomId: RoomId | undefined): RoomSummary {
  const { client } = useMatrix();

  const read = useCallback((): RoomSummary => {
    if (!client || !roomId) return { room: null, members: [] };
    try {
      return {
        room: client.getRoom(roomId),
        members: client.getMembers(roomId),
      };
    } catch {
      // Client present but not synced yet — `require()` throws.
      return { room: null, members: [] };
    }
  }, [client, roomId]);

  const [summary, setSummary] = useState<RoomSummary>(read);

  // Reset during render when the room or client changes — same reason as
  // `useRoom`: an effect would paint the previous room's roster first.
  const bound = useRef({ client, roomId });
  if (bound.current.client !== client || bound.current.roomId !== roomId) {
    bound.current = { client, roomId };
    setSummary(read());
  }

  useEffect(() => {
    if (!client || !roomId) return;
    return client.on((event) => {
      if (event.type === 'room.upserted' && event.room.id === roomId) {
        setSummary(read());
      }
    });
  }, [client, roomId, read]);

  return summary;
}

/**
 * A room's threads, kept live — each with its own reply count and read marker.
 *
 * The per-thread unread flag comes from the homeserver's thread notification
 * count (via `client.getThreads`), which is only meaningful once the reader has
 * posted in the thread; a thread they have never touched always reads as read.
 */
export function useRoomThreads(roomId: RoomId | undefined): Thread[] {
  const { client } = useMatrix();
  const [threads, setThreads] = useState<Thread[]>([]);

  useEffect(() => {
    if (!client || !roomId) {
      setThreads([]);
      return;
    }

    const collect = () => {
      // The client can be present but not yet synced; reading threads then
      // throws through `require()`. Treat it as "none yet".
      try {
        setThreads(client.getThreads(roomId));
      } catch {
        setThreads([]);
      }
    };
    collect();

    return client.on((event) => {
      if (
        event.type === 'thread.updated' ||
        (event.type === 'message.received' && event.message.roomId === roomId) ||
        (event.type === 'receipt' && event.roomId === roomId) ||
        (event.type === 'notifications' && event.roomId === roomId)
      ) {
        collect();
      }
    });
  }, [client, roomId]);

  return threads;
}

export interface GroupDirectMessageSummary {
  roomId: string;
  /** The room's name, or its members' names when it has none. */
  name: string;
  memberCount: number;
  unreadCount: number;
  mentionCount: number;
  lastActivityAt?: number;
  /** Up to three other members, for an avatar stack. */
  avatarMembers: {
    userId: string;
    displayName: string;
    avatarUrl?: string;
  }[];
}

function summariseGroup(
  room: Room,
  others: RoomMember[],
): GroupDirectMessageSummary {
  const names = others.map((member) => member.displayName || member.userId);
  return {
    roomId: room.id,
    name:
      room.name?.trim() ||
      (names.length ? names.slice(0, 3).join(', ') : 'Group message'),
    memberCount: room.memberCount,
    unreadCount: room.unreadCount,
    mentionCount: room.highlightCount,
    lastActivityAt: room.lastActivityAt,
    avatarMembers: others.slice(0, 3).map((member) => ({
      userId: member.userId,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
    })),
  };
}

/**
 * The reader's group direct messages, most-recent activity first, kept live.
 *
 * A 1:1 DM is still addressed by peer and listed from the workspace roster;
 * this is only the multi-person rooms, which have no single peer to list them
 * under and so need their own source.
 */
export function useGroupDirectMessages(): GroupDirectMessageSummary[] {
  const { client } = useMatrix();
  const [groups, setGroups] = useState<GroupDirectMessageSummary[]>([]);

  useEffect(() => {
    if (!client) {
      setGroups([]);
      return;
    }

    const collect = () => {
      try {
        const myUserId = client.getSession()?.userId;
        setGroups(
          client
            .getRooms()
            .filter((room) => room.kind === 'group')
            .map((room) =>
              summariseGroup(
                room,
                client
                  .getMembers(room.id)
                  .filter((member) => member.userId !== myUserId),
              ),
            )
            .sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0)),
        );
      } catch {
        // Client present but not synced yet — `require()` throws.
        setGroups([]);
      }
    };

    collect();
    return client.on((event) => {
      if (
        event.type === 'room.upserted' ||
        event.type === 'room.removed' ||
        event.type === 'message.received' ||
        event.type === 'notifications'
      ) {
        collect();
      }
    });
  }, [client]);

  return groups;
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
