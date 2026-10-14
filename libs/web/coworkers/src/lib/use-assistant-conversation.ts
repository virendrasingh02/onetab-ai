import type { AITranscriptMessage } from '@org/chat-ui';
import type { Message } from '@org/types';
import {
  AI_MODELS,
  modelLabelFor,
  type AIModelValue,
} from '@org/web-ai';
import { useDirectRoom, useRoom, useRoomActions } from '@org/web-chat';
import { useCallback, useMemo, useState } from 'react';
import { useAssistantCoworker } from './assistant-conversation.js';
import { useCoworkerMutations } from './use-coworkers.js';

export interface UseAssistantConversationOptions {
  /** Seed an empty transcript with the Assistant's greeting (docked panel). */
  greeting?: boolean;
}

const WELCOME_ID = 'welcome-assistant';
const IN_FLIGHT = new Set(['queued', 'starting', 'running', 'waiting']);

const clearedKey = (workspaceId: string) =>
  `onetab:assistant-cleared:${workspaceId}`;

function readClearedAt(workspaceId: string | undefined): number {
  if (!workspaceId) return 0;
  try {
    return Number(localStorage.getItem(clearedKey(workspaceId))) || 0;
  } catch {
    return 0;
  }
}

/**
 * The AI Assistant conversation, backed by the Assistant coworker's Matrix DM
 * room instead of component state — same shape `useAIConversation` returned,
 * so the AI Home page and the docked panel render exactly as before while the
 * transcript now persists, syncs across devices and survives reloads.
 *
 * Replies come from the agent bridge as `mie.ai.agent` cards; a queued/running
 * card is surfaced as "thinking", a failed one as the error row, and only
 * completed ones appear as assistant turns.
 */
export function useAssistantConversation({
  greeting = false,
}: UseAssistantConversationOptions = {}) {
  const { assistant, workspaceId } = useAssistantCoworker();
  const mutations = useCoworkerMutations(workspaceId);
  const peerId = assistant ? `coworker-${assistant.id}` : undefined;
  const { roomId, error: roomError } = useDirectRoom(peerId);
  const room = useRoom(roomId ?? undefined);
  const actions = useRoomActions(roomId ?? undefined);

  const [resetToken, setResetToken] = useState(0);
  const [clearedAt, setClearedAt] = useState(() => readClearedAt(workspaceId));
  const [sendError, setSendError] = useState<Error | null>(null);

  const assistantSender = assistant?.matrixUserId;

  const main = useMemo<Message[]>(
    () =>
      room.messages.filter(
        (m) => !m.threadRootId && !m.isRedacted && m.timestamp > clearedAt,
      ),
    [room.messages, clearedAt],
  );

  const isAssistantTurn = useCallback(
    (m: Message) =>
      m.structuredEvent?.type === 'mie.ai.agent' ||
      (!!assistantSender && m.senderId === assistantSender),
    [assistantSender],
  );

  const last = main[main.length - 1];
  const lastCard =
    last?.structuredEvent?.type === 'mie.ai.agent'
      ? last.structuredEvent
      : undefined;

  const failure =
    lastCard?.status === 'failed'
      ? new Error(lastCard.errorMessage || 'The assistant could not answer.')
      : null;
  const error = failure ?? sendError ?? (roomError ? new Error(roomError) : null);

  const isThinking =
    !failure &&
    !!last &&
    (!isAssistantTurn(last) ||
      (lastCard !== undefined && IN_FLIGHT.has(lastCard.status)));

  const messages = useMemo<AITranscriptMessage[]>(() => {
    const out: AITranscriptMessage[] = [];
    for (const m of main) {
      const card = m.structuredEvent;
      if (card?.type === 'mie.ai.agent') {
        // Only finished answers are transcript turns; the in-flight and failed
        // states are shown by the thinking / error rows.
        if (card.status !== 'completed') continue;
        out.push({
          id: m.id,
          role: 'assistant',
          content: card.responseText || m.body,
          at: new Date(m.timestamp).toISOString(),
        });
        continue;
      }
      out.push({
        id: m.id,
        role: isAssistantTurn(m) ? 'assistant' : 'user',
        content: m.body,
        at: new Date(m.timestamp).toISOString(),
      });
    }
    if (greeting && out.length === 0 && assistant) {
      out.push({
        id: WELCOME_ID,
        role: 'assistant',
        content:
          assistant.welcomeMessage ||
          'Hi! Ask me about your workspace.',
        at: new Date().toISOString(),
      });
    }
    return out;
  }, [main, isAssistantTurn, greeting, assistant]);

  const model = useMemo<AIModelValue>(
    () =>
      AI_MODELS.find((o) => o.model && o.model === assistant?.model)?.value ??
      'auto',
    [assistant?.model],
  );

  const setModel = useCallback(
    (value: AIModelValue) => {
      if (!assistant) return;
      const option = AI_MODELS.find((o) => o.value === value);
      mutations.update.mutate({
        coworkerId: assistant.id,
        input: { model: option?.model ?? '' },
      });
    },
    [assistant, mutations.update],
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isThinking) return;
      setSendError(null);
      actions.send(trimmed).catch((e: unknown) => {
        setSendError(e instanceof Error ? e : new Error('Message failed to send.'));
      });
    },
    [actions, isThinking],
  );

  // Re-ask the last question; the failed card stays in history.
  const retry = useCallback(() => {
    const lastUser = [...main].reverse().find((m) => !isAssistantTurn(m));
    if (!lastUser) return;
    setSendError(null);
    actions.send(lastUser.body).catch((e: unknown) => {
      setSendError(e instanceof Error ? e : new Error('Message failed to send.'));
    });
  }, [main, isAssistantTurn, actions]);

  // Matrix history is not deleted; "new chat" starts a fresh view from now.
  const reset = useCallback(() => {
    const now = Date.now();
    setClearedAt(now);
    setSendError(null);
    setResetToken((t) => t + 1);
    if (workspaceId) {
      try {
        localStorage.setItem(clearedKey(workspaceId), String(now));
      } catch {
        /* storage unavailable — the view still resets for this session */
      }
    }
  }, [workspaceId]);

  return {
    messages,
    model,
    setModel,
    modelLabel: modelLabelFor(model),
    resetToken,
    isThinking,
    isError: !!error,
    error,
    isEmpty: messages.length === 0,
    send,
    retry,
    reset,
  };
}

