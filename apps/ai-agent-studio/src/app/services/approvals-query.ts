import { approvalsApi } from '@org/api-client';

export const workspaceApprovalsKey = (workspaceId: string, state: string) =>
  ['workspace-approvals', workspaceId, state] as const;

/**
 * Approvals for a workspace, from the API.
 *
 * Shared by the Approvals page and the sidebar's pending badge so both read
 * the same cache entry. There is no local fallback: an empty list means
 * nothing is waiting, and a failure is shown as one — sample approvals here
 * used to look like real requests waiting on someone.
 */
export async function fetchWorkspaceApprovals(workspaceId: string, state: string): Promise<any[]> {
  return approvalsApi.list(workspaceId, state === 'ALL' ? undefined : state);
}
