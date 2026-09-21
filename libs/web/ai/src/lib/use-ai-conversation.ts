import type { AITranscriptMessage } from '@org/chat-ui';
import type { AIChatMessage } from '@org/types';
import { useState } from 'react';
import { modelLabelFor, type AIModelValue } from './ai-models.js';
import { useAIChat } from './use-ai.js';

/** The shape the shared transcript rows render. */
export type AIConversationMessage = AITranscriptMessage;

export interface UseAIConversationOptions {
  /** Seed the transcript with a greeting, as the docked assistant does. */
  greeting?: boolean;
}

/** "Good morning" at 3am was a bad look — the greeting follows the clock. */
function greetingPrefix(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const WELCOME_PREFIX = 'welcome-';

function welcomeMessage(): AIConversationMessage {
  return {
    id: `${WELCOME_PREFIX}${Date.now()}`,
    role: 'assistant',
    content: `${greetingPrefix()}! Ask me about your workspace, or type @ to pick a model and / for a command.`,
    at: new Date().toISOString(),
  };
}

/**
 * One AI conversation: transcript, model, and the turn in flight.
 *
 * Both the full-page view and the docked assistant run on this, so the two
 * surfaces cannot drift apart in behaviour the way they had — one swallowed
 * errors into the transcript as fake assistant replies while the other offered
 * a retry, and each rebuilt the outgoing transcript with slightly different
 * rules.
 *
 * The composer text itself is not state here — it lives inside the shared
 * `Composer` (Lexical + its own per-surface draft), which only hands this hook
 * the final body on send.
 */
export function useAIConversation({
  greeting = false,
}: UseAIConversationOptions = {}) {
  const [messages, setMessages] = useState<AIConversationMessage[]>(() =>
    greeting ? [welcomeMessage()] : [],
  );
  const [model, setModel] = useState<AIModelValue>('auto');
  /** Bumped on `reset()` so the host can force-remount the composer (`key=`),
   *  clearing its box the same way a fresh conversation should. */
  const [resetToken, setResetToken] = useState(0);

  const chat = useAIChat();

  const modelLabel = modelLabelFor(model);

  // The API holds no conversation state, so the transcript goes up in full on
  // every turn. The local greeting is dropped — the model never said it.
  const submit = (
    history: AIConversationMessage[],
    userMessage: AIConversationMessage,
  ) => {
    const transcript: AIChatMessage[] = [...history, userMessage]
      .filter((message) => !message.id.startsWith(WELCOME_PREFIX))
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    setMessages([...history, userMessage]);

    chat.mutate(
      { messages: transcript, model },
      {
        onSuccess: (response) => {
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              content: response.message.content,
              at: new Date().toISOString(),
            },
          ]);
        },
      },
    );
  };

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || chat.isPending) return;

    submit(messages, {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      at: new Date().toISOString(),
    });
  };

  /*
   * Replays the last question against the history *before* it. Rebuilding from
   * the live transcript instead would resend that question twice, since the
   * failed turn is still sitting in it.
   */
  const retry = () => {
    if (chat.isPending) return;

    const index = messages.map((message) => message.role).lastIndexOf('user');
    if (index === -1) return;

    chat.reset();
    submit(messages.slice(0, index), messages[index]);
  };

  const reset = () => {
    setMessages(greeting ? [welcomeMessage()] : []);
    setResetToken((token) => token + 1);
    chat.reset();
  };

  return {
    messages,
    model,
    setModel,
    modelLabel,
    resetToken,
    isThinking: chat.isPending,
    isError: chat.isError,
    error: chat.error,
    /** No question has been asked yet — the landing state. */
    isEmpty: messages.length === 0,
    send,
    retry,
    reset,
  };
}
