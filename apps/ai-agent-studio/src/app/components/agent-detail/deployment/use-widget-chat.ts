import { publicAgentApi } from '@org/api-client';
import type { AgentSessionAttachment, AgentSessionMessage, AgentWidgetConversation } from '@org/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from './use-deployment.js';
import { MAX_MESSAGE_ATTACHMENTS, type ChatMessage, type PendingAttachment, type WidgetHistory } from './widget-preview.js';

/**
 * The Studio preview's conversation with a live deployment, through the same
 * public session API the embed uses: new chats, the visitor's history and
 * file attachments all behave as they will on a customer's site.
 */

/** The API refuses larger uploads. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const visitorStorageKey = (publicKey: string) => `ot_studio_widget_visitor_${publicKey}`;

function readVisitorKey(publicKey: string): string | undefined {
  try {
    return localStorage.getItem(visitorStorageKey(publicKey)) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeVisitorKey(publicKey: string, key: string) {
  try {
    localStorage.setItem(visitorStorageKey(publicKey), key);
  } catch {
    /* private mode: history lasts as long as the tab */
  }
}

/** Stored session messages as the preview shows them; the greeting is drawn by the preview itself. */
export function toChatMessages(messages: AgentSessionMessage[]): ChatMessage[] {
  const first = messages.findIndex((m) => m.role === 'user');
  if (first < 0) return [];
  return messages
    .slice(first)
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      text: m.content,
      needsApproval: m.executionState === 'WAITING_FOR_APPROVAL',
      tools: m.toolCalls?.length,
      attachments: m.attachments,
    }));
}

export function useWidgetChat(publicKey: string, { onOriginBlocked }: { onOriginBlocked: (blocked: boolean) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<AgentWidgetConversation[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const session = useRef<{ id: string; token: string } | null>(null);
  // Bumped on every switch, so a reply or upload from an earlier conversation is dropped.
  const epoch = useRef(0);

  const clear = useCallback(() => {
    epoch.current++;
    setMessages([]);
    setAttachments([]);
    setSending(false);
  }, []);

  // A different deployment is a different visitor.
  useEffect(() => {
    session.current = null;
    clear();
    setConversations(null);
    setHistoryOpen(false);
  }, [publicKey, clear]);

  const fail = (err: unknown, fallback: string) => {
    const msg = errorMessage(err, fallback);
    if (/origin/i.test(msg)) onOriginBlocked(true);
    return msg;
  };

  const ensureSession = async () => {
    if (session.current) return session.current;
    onOriginBlocked(false);
    const init = await publicAgentApi.initSession(publicKey, { preview: true }, { visitorKey: readVisitorKey(publicKey) });
    writeVisitorKey(publicKey, init.visitorKey);
    session.current = { id: init.sessionId, token: init.sessionToken };
    return session.current;
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const s = await ensureSession();
      setConversations(await publicAgentApi.listConversations(s.id, s.token));
    } catch (err) {
      setHistoryError(fail(err, 'Conversations could not be loaded.'));
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleHistory = () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next) void loadHistory();
  };

  const newChat = async () => {
    setHistoryOpen(false);
    const current = session.current;
    // An untouched conversation is already a new one.
    if (!current || !messages.some((m) => m.role === 'user')) {
      clear();
      return;
    }
    clear();
    try {
      const next = await publicAgentApi.createConversation(current.id, current.token);
      session.current = { id: next.sessionId, token: next.sessionToken };
    } catch {
      // The old session may have expired; the next message starts a fresh one.
      session.current = null;
    }
  };

  const openConversation = async (id: string) => {
    const current = session.current;
    if (!current) return;
    setHistoryOpen(false);
    if (id === current.id) return;
    clear();
    const mine = epoch.current;
    setSending(true);
    try {
      const next = await publicAgentApi.openConversation(current.id, current.token, id);
      session.current = { id: next.sessionId, token: next.sessionToken };
      const stored = await publicAgentApi.getMessages(next.sessionId, next.sessionToken);
      if (epoch.current === mine) setMessages(toChatMessages(stored));
    } catch (err) {
      if (epoch.current === mine) {
        setMessages([{ id: `e-${Date.now()}`, role: 'assistant', text: fail(err, 'That conversation could not be opened.') }]);
      }
    } finally {
      if (epoch.current === mine) setSending(false);
    }
  };

  const deleteConversation = async (id: string) => {
    const current = session.current;
    if (!current) return;
    setConversations((list) => list?.filter((c) => c.id !== id) ?? null);
    try {
      await publicAgentApi.deleteConversation(current.id, current.token, id);
      if (id === current.id) {
        session.current = null;
        clear();
        setConversations(null);
        void loadHistory();
      }
    } catch (err) {
      setHistoryError(fail(err, 'That conversation could not be deleted.'));
      void loadHistory();
    }
  };

  const attach = async (files: File[]) => {
    const room = MAX_MESSAGE_ATTACHMENTS - attachments.length;
    const picked = files.slice(0, Math.max(0, room));
    if (!picked.length) return;
    const mine = epoch.current;
    const pending: PendingAttachment[] = picked.map((file, i) => ({
      localId: `f-${Date.now()}-${i}`,
      name: file.name,
      size: file.size,
      status: file.size > MAX_ATTACHMENT_BYTES ? 'error' : 'uploading',
      error: file.size > MAX_ATTACHMENT_BYTES ? 'Larger than 10 MB' : undefined,
    }));
    setAttachments((a) => [...a, ...pending]);
    const update = (localId: string, next: Partial<PendingAttachment>) => {
      if (epoch.current === mine) setAttachments((a) => a.map((x) => (x.localId === localId ? { ...x, ...next } : x)));
    };
    let s: { id: string; token: string };
    try {
      s = await ensureSession();
    } catch (err) {
      const msg = fail(err, 'Upload failed');
      pending.forEach((p) => update(p.localId, { status: 'error', error: msg }));
      return;
    }
    await Promise.all(
      picked.map(async (file, i) => {
        const p = pending[i]!;
        if (p.status === 'error') return;
        try {
          const uploaded: AgentSessionAttachment = await publicAgentApi.uploadAttachment(s.id, s.token, file);
          update(p.localId, { status: 'ready', attachment: uploaded });
        } catch (err) {
          update(p.localId, { status: 'error', error: errorMessage(err, 'Upload failed') });
        }
      }),
    );
  };

  const removeAttachment = (localId: string) => setAttachments((a) => a.filter((x) => x.localId !== localId));

  const send = async (text: string) => {
    const message = text.trim();
    const ready = attachments.filter((a) => a.status === 'ready' && a.attachment).map((a) => a.attachment!);
    if ((!message && !ready.length) || sending || attachments.some((a) => a.status === 'uploading')) return;
    const mine = epoch.current;
    setHistoryOpen(false);
    setAttachments([]);
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: 'user', text: message, attachments: ready }]);
    setSending(true);
    onOriginBlocked(false);
    try {
      const s = await ensureSession();
      const run = await publicAgentApi.sendMessage(s.id, s.token, message, undefined, ready.map((a) => a.id));
      if (epoch.current !== mine) return;
      setMessages((m) => [
        ...m,
        {
          id: run.runId || `a-${Date.now()}`,
          role: 'assistant',
          text: run.output || (run.error ? `Error: ${run.error}` : 'The agent finished without a reply.'),
          needsApproval: run.status === 'WAITING_FOR_APPROVAL',
          tools: run.toolExecutions?.length,
        },
      ]);
      // The history list now has this conversation's title.
      if (conversations) setConversations(null);
    } catch (err) {
      if (epoch.current === mine) {
        setMessages((m) => [...m, { id: `e-${Date.now()}`, role: 'assistant', text: fail(err, 'The agent could not answer.') }]);
      }
    } finally {
      if (epoch.current === mine) setSending(false);
    }
  };

  return {
    messages,
    sending,
    send,
    newChat,
    attachments,
    attach,
    removeAttachment,
    history: {
      isOpen: historyOpen,
      toggle: toggleHistory,
      items: conversations,
      loading: historyLoading,
      error: historyError,
      select: openConversation,
      remove: deleteConversation,
    } satisfies WidgetHistory,
  };
}

