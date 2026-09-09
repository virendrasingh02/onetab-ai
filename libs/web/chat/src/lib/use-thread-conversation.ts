import type { Message } from '@org/matrix-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMatrix } from './matrix-provider.js';

export interface ThreadConversation {
  /** The thread's events, oldest first — the root followed by every reply. */
  messages: Message[];
  isLoading: boolean;
  /** True while a reply this client sent is still in flight. */
  isSending: boolean;
  /** Post a reply into the thread. Resolves once the echo is on the timeline. */
  send: (body: string) => Promise<void>;
  /** Catch the thread's read marker up to its latest reply. */
  markRead: () => void;
  /** Re-read the thread from the client (used after a send). */
  reload: () => void;
}

/**
 * One thread's messages, kept live, with a bound `send`.
 *
 * `useAllThreads` gives the cross-room list its counts and roots; this is the
 * companion that actually opens one — so the Threads page can show a thread's
 * replies and post into it without routing the reader into the channel. It
 * reads what the SDK already holds for the thread (`getThreadMessages`) and
 * re-reads on any event that could touch it, the same pattern `useRoom` uses
 * for a room timeline.
 */
export function useThreadConversation(
  roomId: string | undefined,
  rootId: string | undefined,
  options: { enabled?: boolean } = {},
): ThreadConversation {
  const enabled = options.enabled ?? true;
  const { client } = useMatrix();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Guards a stale async load from overwriting a newer one when the thread
  // this hook points at changes mid-flight.
  const token = useRef(0);

  const load = useCallback(async () => {
    if (!client || !roomId || !rootId) return;
    const mine = ++token.current;
    try {
      const list = await client.getThreadMessages(roomId, rootId);
      if (mine === token.current) setMessages(list);
    } catch {
      if (mine === token.current) setMessages([]);
    } finally {
      if (mine === token.current) setIsLoading(false);
    }
  }, [client, roomId, rootId]);

  useEffect(() => {
    if (!enabled || !client || !roomId || !rootId) return;

    setIsLoading(true);
    void load();

    return client.on((event) => {
      if (
        (event.type === 'message.received' &&
          event.message.roomId === roomId &&
          (event.message.threadRootId === rootId ||
            event.message.id === rootId)) ||
        (event.type === 'message.updated' && event.message.roomId === roomId) ||
        (event.type === 'message.redacted' && event.roomId === roomId) ||
        (event.type === 'thread.updated' && event.thread.rootId === rootId)
      ) {
        void load();
      }
    });
  }, [client, roomId, rootId, enabled, load]);

  const send = useCallback(
    async (body: string) => {
      const trimmed = body.trim();
      if (!client || !roomId || !rootId || !trimmed) return;
      setIsSending(true);
      try {
        await client.sendMessage(roomId, trimmed, { threadRootId: rootId });
        await load();
      } finally {
        setIsSending(false);
      }
    },
    [client, roomId, rootId, load],
  );

  const markRead = useCallback(() => {
    if (!client || !roomId || !rootId) return;
    void client.markThreadRead(roomId, rootId);
  }, [client, roomId, rootId]);

  return { messages, isLoading, isSending, send, markRead, reload: load };
}
