import { createContext, useContext } from 'react';

/**
 * Resolves an agent's *current* uploaded avatar by id.
 *
 * Structured agent events freeze `agentAvatarUrl` at send time, so an avatar
 * uploaded later (or missing when the reply was sent) never reached old
 * messages. The app feeds this from its live agent list instead.
 */
export type AgentAvatarResolver = (agentId: string) => string | undefined;

const AgentAvatarContext = createContext<AgentAvatarResolver | null>(null);

export const AgentAvatarProvider = AgentAvatarContext.Provider;

export function useAgentAvatar(agentId?: string): string | undefined {
  const resolve = useContext(AgentAvatarContext);
  return agentId && resolve ? resolve(agentId) : undefined;
}
