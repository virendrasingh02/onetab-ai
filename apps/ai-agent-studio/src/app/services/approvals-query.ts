import { approvalsApi } from '@org/api-client';
import { approvalService } from './approvalService.js';

export const workspaceApprovalsKey = (workspaceId: string, state: string) =>
  ['workspace-approvals', workspaceId, state] as const;

/**
 * Approvals for a workspace, live from the API with the local fallback list.
 *
 * Shared by the Approvals page and the sidebar's pending badge so both read
 * the same cache entry instead of the badge showing a hardcoded count.
 */
export async function fetchWorkspaceApprovals(
  workspaceId: string,
  state: string,
): Promise<any[]> {
  try {
    const live = await approvalsApi.list(
      workspaceId,
      state === 'ALL' ? undefined : state,
    );
    if (live && live.length > 0) return live;
  } catch {
    // Fallback
  }
  const mockList = await approvalService.getApprovals(state);
  return mockList.map((m: any) => ({
    id: m.id,
    state: m.status || m.state,
    actionType: m.category || m.title,
    entityType: m.agentName || 'Agent Workflow',
    entityId: m.agentId || 'agent-001',
    executionId: m.executionId,
    createdAt: m.createdAt,
    requester: { name: m.requestedBy || 'Supervisor Agent' },
    comment: m.decisionComment,
    proposedPayload: m.proposedPayload,
  }));
}
