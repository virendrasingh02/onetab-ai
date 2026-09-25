/**
 * Workspace-scoped analytics data hooks. The screen that renders them is
 * Settings → Analytics (`WorkspaceCompanyAnalytics` in `@org/web-workspace`);
 * presentational pieces and charts come from `@org/analytics-ui`.
 */
export {
  useAIUsageAnalytics,
  useAnalyticsDateRange,
  useDashboardAnalytics,
  useReport,
  useReportDefinitions,
  useReportDownload,
  useStorageAnalytics,
  useTrackEvent,
  useUserAnalytics,
  useWorkspaceAnalytics,
  type AnalyticsQueryOptions,
} from './lib/use-analytics.js';
