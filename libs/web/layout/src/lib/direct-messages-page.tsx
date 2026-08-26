import {
  MembershipStatus,
  PresenceStatus,
  WorkspaceRole,
  type WorkspaceMember,
} from '@org/types';
import { useAgents } from '@org/web-agents';
import { DirectMessagesView } from '@org/web-chat';
import { useIntegrations } from '@org/web-integrations';
import { useCurrentWorkspace } from '@org/web-workspace';
import { useMemo } from 'react';

/**
 * The `dms` route's actual page.
 *
 * `DirectMessagesView` (in `web-chat`) knows nothing about agents or apps —
 * it only takes a list of extra `WorkspaceMember`-shaped peers. This is where
 * that list comes from: `web-agents` and `web-integrations` both already
 * depend on `web-chat` (for `ChatPanel`, which `AgentChatView`/`AppChatView`
 * reuse), so `web-chat` importing back from either would be circular.
 * `web-layout` sits above all three, so composing them happens here instead.
 */
export function DirectMessagesPage() {
  const { workspaceId } = useCurrentWorkspace();
  const agents = useAgents(workspaceId);
  const integrations = useIntegrations(workspaceId);

  const extraPeers = useMemo<WorkspaceMember[]>(() => {
    const now = new Date().toISOString();

    const agentPeers: WorkspaceMember[] = (agents.data ?? [])
      .filter((agent) => agent.isActive)
      .map((agent) => ({
        id: `agent-${agent.id}`,
        workspaceId: agent.workspaceId,
        role: WorkspaceRole.MEMBER,
        status: MembershipStatus.ACTIVE,
        joinedAt: agent.createdAt,
        user: {
          id: `agent-${agent.id}`,
          name: agent.name,
          displayName: agent.name,
          avatarUrl: agent.avatarUrl,
          presence: PresenceStatus.ONLINE,
          statusText: agent.role,
          statusEmoji: null,
          lastSeenAt: now,
          // A bot has no locale of its own; there is nothing truthful to put
          // here, so this is a placeholder rather than a real answer to "what
          // time is it where they are".
          timezone: 'UTC',
        },
      }));

    const appPeers: WorkspaceMember[] = (integrations.data ?? [])
      .filter((integration) => integration.status === 'CONNECTED')
      .map((integration) => ({
        id: `app-${integration.id}`,
        workspaceId: integration.workspaceId ?? workspaceId ?? '',
        role: WorkspaceRole.MEMBER,
        status: MembershipStatus.ACTIVE,
        joinedAt: integration.createdAt,
        user: {
          id: `app-${integration.id}`,
          name: integration.displayName ?? integration.provider,
          displayName: integration.displayName ?? integration.provider,
          avatarUrl: null,
          presence: PresenceStatus.ONLINE,
          statusText: integration.provider,
          statusEmoji: null,
          lastSeenAt: now,
          timezone: 'UTC',
        },
      }));

    return [...agentPeers, ...appPeers];
  }, [agents.data, integrations.data, workspaceId]);

  return <DirectMessagesView extraPeers={extraPeers} />;
}
