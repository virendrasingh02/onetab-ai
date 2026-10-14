import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys.js';

/**
 * Every cached query that shows an AI agent. Agent data is read through
 * several key families (the Studio's own, the plan-first Studio's, the
 * workspace's AI hub, coworkers), so one change has to refresh all of them —
 * this is the one place that knows the list.
 *
 * Pass `agentId` to also refresh that agent's detail/version/connection pages;
 * lists are always refreshed.
 */
export function invalidateAgentCaches(
  queryClient: QueryClient,
  workspaceId: string,
  agentId?: string | null,
): void {
  const invalidate = (queryKey: readonly unknown[]) =>
    queryClient.invalidateQueries({ queryKey: queryKey as unknown[] });

  invalidate(queryKeys.agents.all(workspaceId));
  invalidate(queryKeys.agentStudio.all(workspaceId));
  invalidate(queryKeys.automations.all(workspaceId));
  invalidate(queryKeys.coworkers.all(workspaceId));
  invalidate(['ai-entities', workspaceId]);
  invalidate(['studio-agents', workspaceId]);
  invalidate(['workspace-agents']);
  invalidate(['channels', workspaceId]);

  if (agentId) {
    invalidate(['agent-detail', workspaceId, agentId]);
    invalidate(['agent-versions', workspaceId, agentId]);
    invalidate(['studio-agent', workspaceId, agentId]);
  }
}

/** What an agent run changes: run lists, the Studio home/list summaries, approvals. */
export function invalidateRunCaches(
  queryClient: QueryClient,
  workspaceId: string,
  opts: { workflowId?: string | null; status?: string } = {},
): void {
  const invalidate = (queryKey: readonly unknown[], refetchType?: 'active') =>
    queryClient.invalidateQueries({ queryKey: queryKey as unknown[], refetchType });

  invalidate(queryKeys.aiExecutions.all(workspaceId), 'active');
  invalidate(queryKeys.agentStudio.home(workspaceId));
  invalidate(queryKeys.agentStudio.list(workspaceId));
  if (opts.workflowId) invalidate(queryKeys.agentStudio.detail(workspaceId, opts.workflowId));
  if (opts.status && ['WAITING_APPROVAL', 'COMPLETED', 'FAILED'].includes(opts.status)) {
    invalidate(queryKeys.approvals.all(workspaceId));
  }
}

const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; ids: Set<string> }>();

/**
 * Coalesced `invalidateAgentCaches`: one publish emits several events within
 * milliseconds (updated + version + published), and each would otherwise
 * refetch every agent list. Events in the same burst share one refresh.
 */
export function scheduleAgentCacheRefresh(
  queryClient: QueryClient,
  workspaceId: string,
  agentId?: string | null,
  delayMs = 150,
): void {
  const slot = pending.get(workspaceId);
  if (slot) {
    if (agentId) slot.ids.add(agentId);
    return;
  }
  const ids = new Set<string>(agentId ? [agentId] : []);
  const timer = setTimeout(() => {
    pending.delete(workspaceId);
    if (ids.size === 0) invalidateAgentCaches(queryClient, workspaceId);
    for (const id of ids) invalidateAgentCaches(queryClient, workspaceId, id);
  }, delayMs);
  pending.set(workspaceId, { timer, ids });
}

const pendingRuns = new Map<string, { timer: ReturnType<typeof setTimeout>; workflows: Set<string>; status?: string }>();

/** Coalesced `invalidateRunCaches` — a running agent emits an update per step. */
export function scheduleRunCacheRefresh(
  queryClient: QueryClient,
  workspaceId: string,
  opts: { workflowId?: string | null; status?: string } = {},
  delayMs = 400,
): void {
  const slot = pendingRuns.get(workspaceId);
  if (slot) {
    if (opts.workflowId) slot.workflows.add(opts.workflowId);
    if (opts.status) slot.status = opts.status;
    return;
  }
  const workflows = new Set<string>(opts.workflowId ? [opts.workflowId] : []);
  const entry = { timer: setTimeout(() => {
    pendingRuns.delete(workspaceId);
    invalidateRunCaches(queryClient, workspaceId, { status: entry.status });
    for (const workflowId of workflows) invalidateRunCaches(queryClient, workspaceId, { workflowId });
  }, delayMs), workflows, status: opts.status };
  pendingRuns.set(workspaceId, entry);
}
