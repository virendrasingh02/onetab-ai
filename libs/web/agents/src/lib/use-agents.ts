import { agentsApi, queryKeys } from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/** The workspace's own agents. */
export function useAgents(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.agents.list(workspaceId ?? ''),
    queryFn: () => agentsApi.list(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

/**
 * The installable agent catalogue.
 *
 * Platform-wide rather than workspace data, so it needs no workspace and is
 * cached for longer — it only changes when the platform ships new templates.
 */
export function useAgentCatalogue() {
  return useQuery({
    queryKey: queryKeys.agents.catalogue(),
    queryFn: () => agentsApi.catalogue(),
    staleTime: 5 * 60_000,
  });
}

export function useAgentLogs(
  workspaceId: string | undefined,
  agentId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.agents.logs(workspaceId ?? '', agentId ?? ''),
    queryFn: () => agentsApi.logs(workspaceId as string, agentId as string),
    enabled: !!workspaceId && !!agentId,
  });
}

/** Recent executions across every agent — powers the telemetry table. */
export function useWorkspaceAgentLogs(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.agents.workspaceLogs(workspaceId ?? ''),
    queryFn: () => agentsApi.workspaceLogs(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 15_000,
  });
}

export function useAgentMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.agents.all(workspaceId ?? ''),
    });

  const create = useMutation({
    mutationFn: (input: Parameters<typeof agentsApi.create>[1]) =>
      agentsApi.create(workspaceId as string, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      agentId,
      input,
    }: {
      agentId: string;
      input: Parameters<typeof agentsApi.update>[2];
    }) => agentsApi.update(workspaceId as string, agentId, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (agentId: string) =>
      agentsApi.remove(workspaceId as string, agentId),
    onSuccess: invalidate,
  });

  /** Running an agent writes an execution log, so the log view goes stale. */
  const execute = useMutation({
    mutationFn: ({
      agentId,
      promptText,
    }: {
      agentId: string;
      promptText: string;
    }) => agentsApi.execute(workspaceId as string, agentId, promptText),
    onSuccess: invalidate,
  });

  return { create, update, remove, execute };
}
