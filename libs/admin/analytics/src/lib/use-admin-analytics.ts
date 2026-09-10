import { adminApi, analyticsApi, queryKeys } from '@org/api-client';
import type { AdminAnalyticsFilter } from '@org/types';
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

/* ==========================================================================
 * Platform Intelligence & Analytics Hooks
 * ========================================================================== */

export function useAdminOverviewAnalytics(
  filter?: AdminAnalyticsFilter,
  live = false,
) {
  return useQuery({
    queryKey: queryKeys.admin.analytics.overview(filter as Record<string, unknown>),
    queryFn: () => adminApi.analytics.overview(filter),
    refetchInterval: live ? LIVE_REFETCH_MS : false,
  });
}

export function useAdminUserAnalytics(filter?: AdminAnalyticsFilter) {
  return useQuery({
    queryKey: queryKeys.admin.analytics.users(filter as Record<string, unknown>),
    queryFn: () => adminApi.analytics.users(filter),
  });
}

export function useAdminPlatformUsageAnalytics(filter?: AdminAnalyticsFilter) {
  return useQuery({
    queryKey: queryKeys.admin.analytics.platformUsage(
      filter as Record<string, unknown>,
    ),
    queryFn: () => adminApi.analytics.platformUsage(filter),
  });
}

export function useAdminWorkspaceAnalytics(params?: {
  range?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: queryKeys.admin.analytics.workspaces(
      params as Record<string, unknown>,
    ),
    queryFn: () => adminApi.analytics.workspaces(params),
  });
}

export function useAdminWorkspaceDetailAnalytics(
  workspaceId: string,
  filter?: AdminAnalyticsFilter,
) {
  return useQuery({
    queryKey: queryKeys.admin.analytics.workspaceDetail(
      workspaceId,
      filter as Record<string, unknown>,
    ),
    queryFn: () => adminApi.analytics.workspaceDetail(workspaceId, filter),
    enabled: !!workspaceId,
  });
}

export function useAdminApiAnalytics(filter?: AdminAnalyticsFilter) {
  return useQuery({
    queryKey: queryKeys.admin.analytics.apis(filter as Record<string, unknown>),
    queryFn: () => adminApi.analytics.apis(filter),
  });
}

export function useAdminMessagingAnalytics(filter?: AdminAnalyticsFilter) {
  return useQuery({
    queryKey: queryKeys.admin.analytics.messaging(
      filter as Record<string, unknown>,
    ),
    queryFn: () => adminApi.analytics.messaging(filter),
  });
}

export function useAdminStorageAnalytics(filter?: AdminAnalyticsFilter) {
  return useQuery({
    queryKey: queryKeys.admin.analytics.storage(
      filter as Record<string, unknown>,
    ),
    queryFn: () => adminApi.analytics.storage(filter),
  });
}

export function useAdminDeviceAnalytics(filter?: AdminAnalyticsFilter) {
  return useQuery({
    queryKey: queryKeys.admin.analytics.devices(
      filter as Record<string, unknown>,
    ),
    queryFn: () => adminApi.analytics.devices(filter),
  });
}

export function useAdminLocationAnalytics(filter?: AdminAnalyticsFilter) {
  return useQuery({
    queryKey: queryKeys.admin.analytics.locations(
      filter as Record<string, unknown>,
    ),
    queryFn: () => adminApi.analytics.locations(filter),
  });
}

export function useAdminRevenueAnalytics(filter?: AdminAnalyticsFilter) {
  return useQuery({
    queryKey: queryKeys.admin.analytics.revenue(
      filter as Record<string, unknown>,
    ),
    queryFn: () => adminApi.analytics.revenue(filter),
  });
}

export function useAdminSubscriptionAnalytics(filter?: AdminAnalyticsFilter) {
  return useQuery({
    queryKey: queryKeys.admin.analytics.subscriptions(
      filter as Record<string, unknown>,
    ),
    queryFn: () => adminApi.analytics.subscriptions(filter),
  });
}

export function useAdminEngagementAnalytics(filter?: AdminAnalyticsFilter) {
  return useQuery({
    queryKey: queryKeys.admin.analytics.engagement(
      filter as Record<string, unknown>,
    ),
    queryFn: () => adminApi.analytics.engagement(filter),
  });
}

export function useAdminLiveActivity(live = true) {
  return useQuery({
    queryKey: queryKeys.admin.analytics.liveActivity(),
    queryFn: () => adminApi.analytics.liveActivity(),
    refetchInterval: live ? 10_000 : false,
  });
}

export function useExportAnalytics() {
  return useMutation({
    mutationFn: async ({
      type,
      format,
      filter,
    }: {
      type: string;
      format: 'csv' | 'json';
      filter?: AdminAnalyticsFilter;
    }) => {
      if (format === 'csv') {
        const text = await adminApi.analytics.exportCsv(type, filter);
        const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `admin-analytics-${type}-${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const jsonStr = await adminApi.analytics.exportJson(type, filter);
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `admin-analytics-${type}-${Date.now()}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    },
  });
}
