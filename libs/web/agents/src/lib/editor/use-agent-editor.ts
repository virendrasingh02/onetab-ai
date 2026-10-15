import { aiExecutionsApi, queryKeys } from '@org/api-client';
import { useQuery } from '@tanstack/react-query';

/** This agent's runs from the unified run history. */
export function useAgentRuns(workspaceId: string | undefined, agentId: string | undefined, enabled = true) {
  const filters = { entityId: agentId, limit: 50 };
  return useQuery({
    queryKey: queryKeys.aiExecutions.list(workspaceId ?? '', filters),
    queryFn: () => aiExecutionsApi.list(workspaceId as string, filters),
    enabled: Boolean(workspaceId && agentId && enabled),
    refetchInterval: (query) => (query.state.data?.some((r) => r.status === 'RUNNING') ? 4_000 : false),
  });
}
