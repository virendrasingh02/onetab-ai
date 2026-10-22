import type { AiEntityKind } from '@org/ui';
import { createContext, useContext } from 'react';

/** What the live workspace knows about an AI coworker/agent. */
export interface AiEntityIdentity {
  kind: AiEntityKind;
  name: string;
  avatarUrl?: string;
}

/**
 * Resolves an AI entity's *current* identity by id or, for bot-posted Matrix
 * messages that only carry a display name, by name.
 *
 * Structured agent events freeze `agentAvatarUrl` at send time, so an avatar
 * uploaded later (or missing when the reply was sent) never reached old
 * messages. The app feeds this from its live coworker/agent lists instead, so a
 * coworker looks the same in the sidebar, headers and every message.
 */
export type AiEntityResolver = (ref: {
  id?: string;
  name?: string;
}) => AiEntityIdentity | undefined;

/** @deprecated use {@link AiEntityResolver}. */
export type AgentAvatarResolver = AiEntityResolver;

const AiEntityContext = createContext<AiEntityResolver | null>(null);

export const AgentAvatarProvider = AiEntityContext.Provider;

export function useAiEntity(id?: string, name?: string): AiEntityIdentity | undefined {
  const resolve = useContext(AiEntityContext);
  return resolve && (id || name) ? resolve({ id, name }) : undefined;
}

export function useAgentAvatar(agentId?: string): string | undefined {
  return useAiEntity(agentId)?.avatarUrl;
}
