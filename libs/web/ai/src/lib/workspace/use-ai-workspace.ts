import {
  agentsApi,
  aiEntitiesApi,
  aiExecutionsApi,
  approvalsApi,
  automationsApi,
  mcpApi,
  queryKeys,
} from '@org/api-client';
import type { AIExecutionFilter } from '@org/types';
import { toast } from '@org/ui';
import { useCurrentWorkspace } from '@org/web-workspace';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

/** What a run's `entityId` points at, for labelling and linking it. */
export interface RunSubject {
  name: string;
  kind: 'agent' | 'coworker' | 'workflow';
}

/**
 * Names for everything a run can belong to. Runs only store ids, so the lists
 * are fetched once and shared by the overview, the Runs section and the
 * approvals list (React Query dedupes the requests).
 */
export function useRunSubjects(workspaceId: string | undefined) {
  const entities = useQuery({
    queryKey: ['ai-entities', workspaceId, 'all'],
    queryFn: () => aiEntitiesApi.list(workspaceId as string),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });
  const workflows = useQuery({
    queryKey: queryKeys.automations.list(workspaceId ?? ''),
    queryFn: () => automationsApi.list(workspaceId as string),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });
  return useMemo(() => {
    const map = new Map<string, RunSubject>();
    for (const e of entities.data ?? []) {
      map.set(e.id, { name: e.name, kind: e.type === 'coworker' ? 'coworker' : 'agent' });
    }
    for (const w of workflows.data ?? []) map.set(w.id, { name: w.name, kind: 'workflow' });
    return map;
  }, [entities.data, workflows.data]);
}

export function useAIRuns(workspaceId: string | undefined, filters: AIExecutionFilter) {
  return useQuery({
    queryKey: queryKeys.aiExecutions.list(workspaceId ?? '', filters as Record<string, unknown>),
    queryFn: () => aiExecutionsApi.list(workspaceId as string, filters),
    enabled: Boolean(workspaceId),
    // A run in progress changes status on its own; keep the list honest.
    refetchInterval: (query) =>
      query.state.data?.some((r) => r.status === 'RUNNING') ? 4_000 : 30_000,
  });
}

export function useAIRun(workspaceId: string | undefined, runId: string | null) {
  return useQuery({
    queryKey: queryKeys.aiExecutions.detail(workspaceId ?? '', runId ?? ''),
    queryFn: () => aiExecutionsApi.get(workspaceId as string, runId as string),
    enabled: Boolean(workspaceId && runId),
    refetchInterval: (query) => (query.state.data?.status === 'RUNNING' ? 3_000 : false),
  });
}

export function useAIRunActions(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.aiExecutions.all(workspaceId ?? '') });

  const retry = useMutation({
    mutationFn: (runId: string) => aiExecutionsApi.retry(workspaceId as string, runId),
    onSuccess: (result) => {
      toast.success('Run started again', {
        description:
          result.status === 'RUNNING'
            ? 'It is running now — follow it in Runs.'
            : result.status === 'WAITING_APPROVAL'
              ? 'It is waiting for an approval.'
              : `Finished: ${String(result.status).toLowerCase().replace('_', ' ')}.`,
      });
      void refresh();
    },
    onError: (err) => toast.error('Could not retry this run', { description: errorText(err) }),
  });

  const cancel = useMutation({
    mutationFn: (runId: string) => aiExecutionsApi.cancel(workspaceId as string, runId),
    onSuccess: (run) => {
      toast.success(run.status === 'CANCELLED' && !run.finishedAt ? 'Cancelling — it stops after the current step' : 'Run cancelled', {
        description: 'Its pending approvals were withdrawn.',
      });
      void refresh();
      void queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all(workspaceId ?? '') });
    },
    onError: (err) => toast.error('Could not cancel this run', { description: errorText(err) }),
  });

  const pause = useMutation({
    mutationFn: (runId: string) => aiExecutionsApi.pause(workspaceId as string, runId),
    onSuccess: () => {
      toast.success('Pausing', { description: 'It stops after the step in progress. Resume it any time.' });
      void refresh();
    },
    onError: (err) => toast.error('Could not pause this run', { description: errorText(err) }),
  });

  const resume = useMutation({
    mutationFn: (runId: string) => aiExecutionsApi.resume(workspaceId as string, runId),
    onSuccess: () => {
      toast.success('Resumed', { description: 'It carries on from where it stopped.' });
      void refresh();
    },
    onError: (err) => toast.error('Could not resume this run', { description: errorText(err) }),
  });

  const restart = useMutation({
    mutationFn: (input: { runId: string; stepId: string }) =>
      aiExecutionsApi.restart(workspaceId as string, input.runId, input.stepId),
    onSuccess: () => {
      toast.success('Started again from that step', { description: 'A new run reuses what the earlier steps produced.' });
      void refresh();
    },
    onError: (err) => toast.error('Could not restart from that step', { description: errorText(err) }),
  });

  return { retry, cancel, pause, resume, restart };
}

export function useApprovals(workspaceId: string | undefined, state?: string) {
  return useQuery({
    queryKey: queryKeys.approvals.list(workspaceId ?? '', state),
    queryFn: () => approvalsApi.list(workspaceId as string, state),
    enabled: Boolean(workspaceId),
    refetchInterval: 30_000,
  });
}

export function useDecideApproval(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      decision: 'APPROVED' | 'REJECTED';
      comment?: string;
      /** The run context with the approver's edit to the reviewed draft. */
      revisedPayload?: Record<string, unknown>;
    }) =>
      approvalsApi.decide(workspaceId as string, input.id, {
        decision: input.decision,
        ...(input.comment ? { comment: input.comment } : {}),
        ...(input.revisedPayload ? { revisedPayload: input.revisedPayload } : {}),
      }),
    onSuccess: (_row, input) => {
      toast.success(input.decision === 'APPROVED' ? 'Approved — the action will run' : 'Rejected');
      void queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all(workspaceId ?? '') });
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiExecutions.all(workspaceId ?? '') });
    },
    onError: (err) => toast.error('Could not record the decision', { description: errorText(err) }),
  });
}

export function useBuiltinTools(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.agents.tools(workspaceId ?? ''),
    queryFn: () => agentsApi.listMcpTools(workspaceId as string),
    enabled: Boolean(workspaceId),
    staleTime: 5 * 60_000,
  });
}

export function useMcpConnections(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.mcp.connections(workspaceId ?? ''),
    queryFn: () => mcpApi.listConnections(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
}

/** The current workspace id and slug, for sections that only need those. */
export function useWorkspaceIds() {
  const { workspaceId, slug } = useCurrentWorkspace();
  return { workspaceId, slug };
}

export function errorText(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return 'Something went wrong. Try again.';
}
