import { automationsApi, queryKeys } from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useWorkflows(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.automations.list(workspaceId ?? ''),
    queryFn: () => automationsApi.list(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

export function useWorkflowExecutions(
  workspaceId: string | undefined,
  workflowId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.automations.executions(
      workspaceId ?? '',
      workflowId ?? '',
    ),
    queryFn: () =>
      automationsApi.executions(workspaceId as string, workflowId as string),
    enabled: !!workspaceId && !!workflowId,
  });
}

/** Recent runs across every workflow — powers the execution-logs table. */
export function useWorkspaceExecutions(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.automations.workspaceExecutions(workspaceId ?? ''),
    queryFn: () => automationsApi.workspaceExecutions(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 15_000,
  });
}

export function useWorkflowMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.automations.all(workspaceId ?? ''),
    });

  const create = useMutation({
    mutationFn: (input: Parameters<typeof automationsApi.create>[1]) =>
      automationsApi.create(workspaceId as string, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      workflowId,
      input,
    }: {
      workflowId: string;
      input: Parameters<typeof automationsApi.update>[2];
    }) => automationsApi.update(workspaceId as string, workflowId, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (workflowId: string) =>
      automationsApi.remove(workspaceId as string, workflowId),
    onSuccess: invalidate,
  });

  /** A run appends an execution row, so the logs view goes stale too. */
  const trigger = useMutation({
    mutationFn: ({
      workflowId,
      payload,
    }: {
      workflowId: string;
      payload?: Record<string, unknown>;
    }) =>
      automationsApi.trigger(workspaceId as string, workflowId, payload ?? {}),
    onSuccess: invalidate,
  });

  return { create, update, remove, trigger };
}
