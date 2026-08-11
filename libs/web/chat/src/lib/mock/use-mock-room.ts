import type { Message } from '@org/matrix-client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildMockConversation,
  MOCK_USER_ID,
  type MockConversation,
} from './mock-conversation.js';

/**
 * A working conversation backed by local state instead of a homeserver.
 *
 * The return shape is deliberately the union of what `useRoom` and
 * `useRoomActions` give the panel, so `ChatPanel` can be handed either source
 * and render identically. Sending, editing, reacting, pinning and saving all
 * mutate local state — the interactions are real, only the transport is not.
 */
export interface MockRoom extends Omit<MockConversation, 'messages'> {
  messages: Message[];
  typingNames: string[];
  isLoading: boolean;
  isLoadingOlder: boolean;
  hasMore: boolean;
  error: string | null;
  loadOlder: () => Promise<void>;
  send: (body: string, threadRootId?: string) => Promise<void>;
  edit: (eventId: string, body: string) => Promise<void>;
  remove: (eventId: string) => Promise<void>;
  toggleReaction: (
    eventId: string,
    key: string,
    alreadyReacted: boolean,
  ) => Promise<void>;
  setTyping: (isTyping: boolean) => void;
  attach: (files: FileList, threadRootId?: string) => Promise<void>;
  togglePin: (eventId: string) => void;
  toggleSave: (eventId: string) => void;
  markAllRead: () => void;
}

export function useMockRoom(channelId: string, channelName: string): MockRoom {
  const conversation = useMemo(
    () => buildMockConversation(channelId, channelName),
    [channelId, channelName],
  );

  const [messages, setMessages] = useState<Message[]>(conversation.messages);
  const [pinnedIds, setPinnedIds] = useState<string[]>(conversation.pinnedIds);
  const [savedIds, setSavedIds] = useState<string[]>(conversation.savedIds);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(
    conversation.firstUnreadId,
  );
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Switching channels swaps the whole conversation, including what has been
  // read — otherwise the unread line from the previous channel bleeds through.
  useEffect(() => {
    setMessages(conversation.messages);
    setPinnedIds(conversation.pinnedIds);
    setSavedIds(conversation.savedIds);
    setFirstUnreadId(conversation.firstUnreadId);
    setHasMore(true);
    setIsLoading(true);

    // A beat of loading, so the skeleton and the empty-to-full transition are
    // reachable in the design rather than only in a real deployment.
    const timer = setTimeout(() => setIsLoading(false), 220);
    return () => clearTimeout(timer);
  }, [conversation]);

  // Someone types shortly after the room opens. It exercises the indicator's
  // reserved row, which is the part most likely to be got wrong in a static
  // mockup — nothing is added to the timeline when it stops.
  useEffect(() => {
    const person = conversation.members.find(
      (member) => member.userId !== MOCK_USER_ID,
    );
    if (!person) return;

    const start = setTimeout(() => setTypingNames([person.displayName]), 1600);
    const stop = setTimeout(() => setTypingNames([]), 5200);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
      setTypingNames([]);
    };
  }, [conversation]);

  const append = useCallback(
    (message: Message) => setMessages((current) => [...current, message]),
    [],
  );

  const send = useCallback(
    async (body: string, threadRootId?: string) => {
      append({
        id: `$local-${Date.now()}`,
        roomId: conversation.roomId,
        senderId: MOCK_USER_ID,
        senderName: 'You',
        kind: 'text',
        body,
        timestamp: Date.now(),
        reactions: [],
        isEdited: false,
        isRedacted: false,
        threadRootId,
        isEncrypted: true,
        sendState: 'sent',
      });
    },
    [append, conversation.roomId],
  );

  const edit = useCallback(async (eventId: string, body: string) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === eventId ? { ...message, body, isEdited: true } : message,
      ),
    );
  }, []);

  const remove = useCallback(async (eventId: string) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === eventId
          ? { ...message, isRedacted: true, body: '' }
          : message,
      ),
    );
  }, []);

  const toggleReaction = useCallback(
    async (eventId: string, key: string, alreadyReacted: boolean) => {
      setMessages((current) =>
        current.map((message) => {
          if (message.id !== eventId) return message;

          const existing = message.reactions.find(
            (reaction) => reaction.key === key,
          );

          if (!existing) {
            return {
              ...message,
              reactions: [
                ...message.reactions,
                { key, count: 1, reactedByMe: true, userIds: [MOCK_USER_ID] },
              ],
            };
          }

          const count = existing.count + (alreadyReacted ? -1 : 1);

          return {
            ...message,
            // A reaction nobody holds should disappear, not sit at zero.
            reactions:
              count <= 0
                ? message.reactions.filter((reaction) => reaction.key !== key)
                : message.reactions.map((reaction) =>
                    reaction.key === key
                      ? {
                          ...reaction,
                          count,
                          reactedByMe: !alreadyReacted,
                          userIds: alreadyReacted
                            ? reaction.userIds.filter(
                                (id) => id !== MOCK_USER_ID,
                              )
                            : [...reaction.userIds, MOCK_USER_ID],
                        }
                      : reaction,
                  ),
          };
        }),
      );
    },
    [],
  );

  const attach = useCallback(
    async (files: FileList, threadRootId?: string) => {
      for (const file of Array.from(files)) {
        const isImage = file.type.startsWith('image/');
        append({
          id: `$local-${Date.now()}-${file.name}`,
          roomId: conversation.roomId,
          senderId: MOCK_USER_ID,
          senderName: 'You',
          kind: isImage ? 'image' : 'file',
          body: file.name,
          timestamp: Date.now(),
          attachment: {
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            // A local object URL means the preview is the file the user just
            // picked, not a placeholder standing in for it.
            url: URL.createObjectURL(file),
          },
          reactions: [],
          isEdited: false,
          isRedacted: false,
          threadRootId,
          isEncrypted: true,
          sendState: 'sent',
        });
      }
    },
    [append, conversation.roomId],
  );

  const loadOlder = useCallback(async () => {
    setIsLoadingOlder(true);
    // One page of history exists; after that the room has reached its start.
    setTimeout(() => {
      setIsLoadingOlder(false);
      setHasMore(false);
    }, 500);
  }, []);

  const togglePin = useCallback((eventId: string) => {
    setPinnedIds((current) =>
      current.includes(eventId)
        ? current.filter((id) => id !== eventId)
        : [...current, eventId],
    );
  }, []);

  const toggleSave = useCallback((eventId: string) => {
    setSavedIds((current) =>
      current.includes(eventId)
        ? current.filter((id) => id !== eventId)
        : [...current, eventId],
    );
  }, []);

  return {
    ...conversation,
    messages,
    pinnedIds,
    savedIds,
    firstUnreadId,
    typingNames,
    isLoading,
    isLoadingOlder,
    hasMore,
    error: null,
    loadOlder,
    send,
    edit,
    remove,
    toggleReaction,
    setTyping: () => undefined,
    attach,
    togglePin,
    toggleSave,
    markAllRead: () => setFirstUnreadId(null),
  };
}
