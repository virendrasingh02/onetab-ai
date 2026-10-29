import { AgentConnectNotice } from '@org/chat-ui';
import type { AgentAppConnectionNeed } from '@org/types';
import { useCurrentWorkspace } from '@org/web-workspace';
import type { ChatSurfaceTimelineRows } from '@org/web-chat';
import { useMemo, useState } from 'react';
import { useAgentConnections } from './use-agents.js';

const ROW_ID = 'agent-connect';

/** Agents whose prompt the viewer dismissed this session. */
const dismissedAgents = new Set<string>();

/**
 * The agent's "Only visible to you" message asking the signed-in member to
 * connect the apps it works in — the agent uses *their* accounts, so each
 * member connects once. It sits in the conversation like a Slack app's
 * sign-in prompt, not as a bar over it, and turns into a thank-you once
 * everything is connected. Nothing is added when all apps are set.
 */
export function useAgentConnectTimelineRow(agent: {
  id: string;
  name: string;
  avatarUrl?: string | null;
}): ChatSurfaceTimelineRows | undefined {
  const { workspaceId } = useCurrentWorkspace();
  const { data } = useAgentConnections(workspaceId, agent.id);
  const [dismissedTick, setDismissedTick] = useState(0);
  const dismissed = dismissedAgents.has(agent.id);
  // Snapshot of what was missing when the prompt was raised, so it stays put
  // (as a "connected" thank-you) after the person connects.
  const [snapshot, setRaised] = useState<{
    agentId: string;
    needs: AgentAppConnectionNeed[];
    at: number;
  } | null>(null);
  const raised = snapshot?.agentId === agent.id ? snapshot : null;

  const missing = useMemo<AgentAppConnectionNeed[]>(
    () =>
      (data ?? [])
        .filter((app) => !app.connected)
        .map((app) => ({
          provider: app.provider,
          label: app.label,
          reason: app.needsReconnect ? 'reconnect' : 'not_connected',
        })),
    [data],
  );
  if (!raised && missing.length > 0) setRaised({ agentId: agent.id, needs: missing, at: Date.now() });

  return useMemo(() => {
    if (!raised || dismissed) return undefined;
    const dismiss = () => {
      dismissedAgents.add(agent.id);
      setDismissedTick((n) => n + 1);
    };
    return {
      items: [{ id: ROW_ID, timestamp: raised.at }],
      render: (id: string) =>
        id === ROW_ID ? (
          <AgentConnectNotice
            agentId={agent.id}
            agentName={agent.name}
            agentAvatarUrl={agent.avatarUrl ?? undefined}
            needs={raised.needs}
            timestamp={raised.at}
            onDismiss={dismiss}
          />
        ) : null,
    };
    // `dismissedTick` re-runs this after a dismiss (the set is outside React).
  }, [raised, dismissed, dismissedTick, agent.id, agent.name, agent.avatarUrl]);
}
