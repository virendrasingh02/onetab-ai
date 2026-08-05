import { analyticsApi, queryKeys } from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Platform-operations data for the admin console.
 *
 * Every hook here reads the API process itself — its latency, its memory, its
 * dependencies, its captured failures. None of them takes a workspace, which
 * is what makes them belong to the admin console: the workspace-scoped
 * aggregates (usage, storage, AI spend, reports) stay in `@org/web-analytics`
 * where a workspace is actually in scope.
 */

/** Live screens poll; they are showing "now", not a cached snapshot. */
const LIVE_REFETCH_MS = 15_000;

export function usePerformanceMetrics(live = true) {
  return useQuery({
    queryKey: queryKeys.analytics.performance(),
    queryFn: () => analyticsApi.performance(),
    refetchInterval: live ? LIVE_REFETCH_MS : false,
  });
}

export function useHealthStatus(live = true) {
  return useQuery({
    queryKey: queryKeys.analytics.health(),
    queryFn: () => analyticsApi.health(),
    refetchInterval: live ? LIVE_REFETCH_MS : false,
  });
}

/**
 * Failures across the whole API process rather than one workspace's — the
 * console has no workspace in scope, and a platform view is useful precisely
 * when the request that failed belonged to someone else's workspace.
 */
export function usePlatformErrorTracking(hours: number) {
  return useQuery({
    queryKey: queryKeys.analytics.platformErrors(hours),
    queryFn: () => analyticsApi.platformErrors(hours),
    refetchInterval: LIVE_REFETCH_MS,
  });
}

export function useClearPlatformErrors() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => analyticsApi.clearPlatformErrors(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}
