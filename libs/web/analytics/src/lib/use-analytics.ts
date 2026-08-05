import { analyticsApi, queryKeys } from '@org/api-client';
import type { ReportType } from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentWorkspace } from '@org/web-workspace';

/** Ranges offered by every analytics screen's picker. */
export const RANGE_OPTIONS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

/** Live screens poll; they are showing "now", not a cached snapshot. */
const LIVE_REFETCH_MS = 15_000;

/** Aggregations are expensive; a minute of staleness is invisible to a human. */
const AGGREGATE_STALE_MS = 60_000;

export function useAnalyticsWorkspaceId(): string | undefined {
  return useCurrentWorkspace().workspaceId;
}

export function useDashboardAnalytics(days: number) {
  const workspaceId = useAnalyticsWorkspaceId();
  return useQuery({
    queryKey: queryKeys.analytics.dashboard(workspaceId ?? '', days),
    queryFn: () => analyticsApi.dashboard(workspaceId as string, days),
    enabled: !!workspaceId,
    staleTime: AGGREGATE_STALE_MS,
  });
}

export function useWorkspaceAnalytics(days: number) {
  const workspaceId = useAnalyticsWorkspaceId();
  return useQuery({
    queryKey: queryKeys.analytics.workspace(workspaceId ?? '', days),
    queryFn: () => analyticsApi.workspace(workspaceId as string, days),
    enabled: !!workspaceId,
    staleTime: AGGREGATE_STALE_MS,
  });
}

export function useUserAnalytics(days: number) {
  const workspaceId = useAnalyticsWorkspaceId();
  return useQuery({
    queryKey: queryKeys.analytics.users(workspaceId ?? '', days),
    queryFn: () => analyticsApi.users(workspaceId as string, days),
    enabled: !!workspaceId,
    staleTime: AGGREGATE_STALE_MS,
  });
}

export function useAIUsageAnalytics(days: number) {
  const workspaceId = useAnalyticsWorkspaceId();
  return useQuery({
    queryKey: queryKeys.analytics.aiUsage(workspaceId ?? '', days),
    queryFn: () => analyticsApi.aiUsage(workspaceId as string, days),
    enabled: !!workspaceId,
    staleTime: AGGREGATE_STALE_MS,
  });
}

export function useStorageAnalytics(days: number) {
  const workspaceId = useAnalyticsWorkspaceId();
  return useQuery({
    queryKey: queryKeys.analytics.storage(workspaceId ?? '', days),
    queryFn: () => analyticsApi.storage(workspaceId as string, days),
    enabled: !!workspaceId,
    staleTime: AGGREGATE_STALE_MS,
  });
}

/**
 * Errors for the current workspace when one is in scope, otherwise the whole
 * API process — the platform view is useful precisely when a workspace-scoped
 * request is what failed.
 */
export function useErrorTracking(hours: number, scope: 'workspace' | 'platform') {
  const workspaceId = useAnalyticsWorkspaceId();
  const isWorkspaceScope = scope === 'workspace';

  return useQuery({
    queryKey: isWorkspaceScope
      ? queryKeys.analytics.errors(workspaceId ?? '', hours)
      : queryKeys.analytics.platformErrors(hours),
    queryFn: () =>
      isWorkspaceScope
        ? analyticsApi.errors(workspaceId as string, hours)
        : analyticsApi.platformErrors(hours),
    enabled: isWorkspaceScope ? !!workspaceId : true,
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

export function useReportDefinitions() {
  const workspaceId = useAnalyticsWorkspaceId();
  return useQuery({
    queryKey: queryKeys.analytics.reports(workspaceId ?? ''),
    queryFn: () => analyticsApi.reportDefinitions(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: Infinity,
  });
}

export function useReport(type: ReportType | null, days: number) {
  const workspaceId = useAnalyticsWorkspaceId();
  return useQuery({
    queryKey: queryKeys.analytics.report(workspaceId ?? '', type ?? '', days),
    queryFn: () => analyticsApi.report(workspaceId as string, type as ReportType, days),
    enabled: !!workspaceId && !!type,
    staleTime: AGGREGATE_STALE_MS,
  });
}

/**
 * Fetches the CSV rendering and hands it to the browser as a download.
 *
 * Goes through the authenticated client rather than a plain anchor href: the
 * access token lives in memory, so a bare link would arrive unauthenticated.
 */
export function useReportDownload() {
  const workspaceId = useAnalyticsWorkspaceId();

  return useMutation({
    mutationFn: async ({ type, days }: { type: ReportType; days: number }) => {
      const csv = await analyticsApi.reportCsv(
        workspaceId as string,
        type,
        days,
      );
      const url = URL.createObjectURL(
        new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type.toLowerCase()}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return type;
    },
  });
}

/** Fire-and-forget page-view / feature-use tracking from any screen. */
export function useTrackEvent() {
  const workspaceId = useAnalyticsWorkspaceId();
  return useMutation({
    mutationFn: ({
      eventType,
      metadata,
    }: {
      eventType: string;
      metadata?: Record<string, unknown>;
    }) => analyticsApi.trackEvent(workspaceId as string, eventType, metadata),
  });
}
