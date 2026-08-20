import type { AITranscriptMessage } from '@org/chat-ui';
import { useMemo, useState } from 'react';
import { useAgentLogs, useAgentMutations } from './use-agents.js';

/** The shape the shared transcript rows render. */
export type AgentConversationMessage = AITranscriptMessage;

/**
 * One agent's conversation, backed by its execution log.
 *
 * An agent has no Matrix identity, so an agent chat is not a room: the server
 * records every run as an `AgentExecutionLog` holding the prompt and the
 * output, and that log *is* the transcript. Reading it back means a
 * conversation survives a reload and follows the user between devices, which a
 * room the agent cannot join never would.
 *
 * The turn in flight is held locally because the log row does not exist until
 * the run returns. On success the log query is invalidated and the pair arrives
 * from the server, so the optimistic copy is dropped rather than merged — that
 * way the transcript has exactly one source of truth once the turn settles.
 */
export function useAgentConversation(
  workspaceId: string | undefined,
  agentId: string | undefined,
) {
  const logs = useAgentLogs(workspaceId, agentId);
  const { execute } = useAgentMutations(workspaceId);

  const [input, setInput] = useState('');
  /** The optimistic user message, held only while its run is in flight. */
  const [inFlight, setInFlight] = useState<AgentConversationMessage | null>(
    null,
  );

  const rawLogs = logs.data;

  /*
   * The API returns newest-first and capped, so the transcript is reversed to
   * read top-to-bottom. Each run expands to the two messages it represents.
   */
  const history = useMemo<AgentConversationMessage[]>(() => {
    if (!rawLogs) return [];
    return [...rawLogs]
      .reverse()
      .flatMap((log) => [
        {
          id: `${log.id}-prompt`,
          role: 'user' as const,
          content: log.promptText,
          at: log.executedAt,
        },
        {
          id: `${log.id}-output`,
          role: 'assistant' as const,
          content: log.outputResult,
          at: log.executedAt,
        },
      ]);
  }, [rawLogs]);

  const messages = useMemo(
    () => (inFlight ? [...history, inFlight] : history),
    [history, inFlight],
  );

  const run = (text: string) => {
    if (!workspaceId || !agentId) return;

    const userMessage: AgentConversationMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      at: new Date().toISOString(),
    };
    setInFlight(userMessage);

    execute.mutate(
      { agentId, promptText: text },
      {
        // The invalidated log query supplies both halves of the turn.
        onSuccess: () => setInFlight(null),
        /*
         * A failed run is left in place: the question stays on screen next to
         * the error so `retry` has something to resend, rather than the message
         * vanishing and the user having to retype it.
         */
      },
    );
  };

  const send = () => {
    const text = input.trim();
    if (!text || execute.isPending) return;
    setInput('');
    run(text);
  };

  /** Replays the failed turn. The question is still `inFlight`. */
  const retry = () => {
    if (execute.isPending || !inFlight) return;
    execute.reset();
    run(inFlight.content);
  };

  return {
    messages,
    input,
    setInput,
    send,
    retry,
    isThinking: execute.isPending,
    isLoadingHistory: logs.isLoading,
    historyError: logs.error instanceof Error ? logs.error.message : null,
    error: execute.error instanceof Error ? execute.error.message : null,
  };
}
