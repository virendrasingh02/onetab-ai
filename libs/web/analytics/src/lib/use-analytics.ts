import { analyticsApi, queryKeys } from '@org/api-client';
import { useDateRangeParam } from '@org/hooks';
import type { AnalyticsDateRange, ReportType } from '@org/types';
import { toDateRangeQuery, type DateRangeValue } from '@org/utils';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Workspace-scoped analytics data. Every hook takes the workspace explicitly
 * (the platform-wide counterparts — performance, health, process errors —
 * live in `@org/admin-analytics`).
 *
 * Taking `workspaceId` as an argument rather than reading the current
 * workspace here is what lets `@org/web-workspace`'s Settings → Analytics
 * screen use these hooks: reading it here made this library depend on
 * `@org/web-workspace`, so that screen had re-implemented every query.
 *
 * The workspace id is part of every query key, so switching workspaces can
 * never show the previous workspace's cached numbers.
 */

/** Aggregations are expensive; a minute of staleness is invisible to a human. */
const AGGREGATE_STALE_MS = 60_000;

export interface AnalyticsQueryOptions {
  /** Defer the request, e.g. until its tab is opened. */
  enabled?: boolean;
}

/**
 * The analytics screens' shared date range, kept in the URL
 * (`?range=last_7_days`, `?range=custom&from=…&to=…`) and remembered per
 * workspace for the session. Returns the value for `DateRangeFilter` and the
 * resolved `{ from, to }` the hooks below take.
 */
export function useAnalyticsDateRange(workspaceId: string | undefined): {
  range: DateRangeValue;
  setRange: (next: DateRangeValue) => void;
  query: AnalyticsDateRange;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const [range, setRange] = useDateRangeParam(searchParams, setSearchParams, {
    storageKey: workspaceId ? `analytics-range:${workspaceId}` : undefined,
  });
  const query = useMemo(() => toDateRangeQuery(range), [range]);
  return { range, setRange, query };
}

export function useDashboardAnalytics(
  workspaceId: string | undefined,
  range: AnalyticsDateRange,
  { enabled = true }: AnalyticsQueryOptions = {},
) {
  return useQuery({
    queryKey: queryKeys.analytics.dashboard(workspaceId ?? '', range),
    queryFn: () => analyticsApi.dashboard(workspaceId as string, range),
    enabled: enabled && !!workspaceId,
    staleTime: AGGREGATE_STALE_MS,
  });
}

export function useWorkspaceAnalytics(
  workspaceId: string | undefined,
  range: AnalyticsDateRange,
  { enabled = true }: AnalyticsQueryOptions = {},
) {
  return useQuery({
    queryKey: queryKeys.analytics.workspace(workspaceId ?? '', range),
    queryFn: () => analyticsApi.workspace(workspaceId as string, range),
    enabled: enabled && !!workspaceId,
    staleTime: AGGREGATE_STALE_MS,
  });
}

export function useUserAnalytics(
  workspaceId: string | undefined,
  range: AnalyticsDateRange,
  { enabled = true }: AnalyticsQueryOptions = {},
) {
  return useQuery({
    queryKey: queryKeys.analytics.users(workspaceId ?? '', range),
    queryFn: () => analyticsApi.users(workspaceId as string, range),
    enabled: enabled && !!workspaceId,
    staleTime: AGGREGATE_STALE_MS,
  });
}

export function useAIUsageAnalytics(
  workspaceId: string | undefined,
  range: AnalyticsDateRange,
  { enabled = true }: AnalyticsQueryOptions = {},
) {
  return useQuery({
    queryKey: queryKeys.analytics.aiUsage(workspaceId ?? '', range),
    queryFn: () => analyticsApi.aiUsage(workspaceId as string, range),
    enabled: enabled && !!workspaceId,
    staleTime: AGGREGATE_STALE_MS,
  });
}

export function useStorageAnalytics(
  workspaceId: string | undefined,
  range: AnalyticsDateRange,
  { enabled = true }: AnalyticsQueryOptions = {},
) {
  return useQuery({
    queryKey: queryKeys.analytics.storage(workspaceId ?? '', range),
    queryFn: () => analyticsApi.storage(workspaceId as string, range),
    enabled: enabled && !!workspaceId,
    staleTime: AGGREGATE_STALE_MS,
  });
}

export function useReportDefinitions(
  workspaceId: string | undefined,
  { enabled = true }: AnalyticsQueryOptions = {},
) {
  return useQuery({
    queryKey: queryKeys.analytics.reports(workspaceId ?? ''),
    queryFn: () => analyticsApi.reportDefinitions(workspaceId as string),
    enabled: enabled && !!workspaceId,
    staleTime: Infinity,
  });
}

export function useReport(
  workspaceId: string | undefined,
  type: ReportType | null,
  range: AnalyticsDateRange,
) {
  return useQuery({
    queryKey: queryKeys.analytics.report(workspaceId ?? '', type ?? '', range),
    queryFn: () =>
      analyticsApi.report(workspaceId as string, type as ReportType, range),
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
export function useReportDownload(workspaceId: string | undefined) {
  return useMutation({
    mutationFn: async ({
      type,
      range,
      filenamePrefix,
    }: {
      type: ReportType;
      range: AnalyticsDateRange;
      filenamePrefix?: string;
    }) => {
      const csv = await analyticsApi.reportCsv(workspaceId as string, type, range);
      const url = URL.createObjectURL(
        new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filenamePrefix ? `${filenamePrefix}-` : ''}${type.toLowerCase()}-${range.from}_${range.to}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return type;
    },
  });
}

/** Fire-and-forget page-view / feature-use tracking from any screen. */
export function useTrackEvent(workspaceId: string | undefined) {
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
