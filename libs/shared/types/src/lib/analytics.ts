/**
 * Phase 11 — Analytics & Administration contracts.
 *
 * Shared between the Nest analytics module and the web dashboards so a change
 * to an aggregation shape breaks the compile rather than the screen.
 */

/** A single point in a daily time series. `date` is `YYYY-MM-DD`. */
export interface TimeSeriesPoint {
  date: string;
  value: number;
}

/** A labelled slice of a breakdown (event types, mime groups, models…). */
export interface BreakdownSlice {
  label: string;
  value: number;
  /** Share of the total, 0–100, rounded to one decimal. */
  percentage: number;
}

/** Period-over-period movement for a headline number. */
export interface TrendDelta {
  current: number;
  previous: number;
  /** Percent change vs. the previous window; `null` when previous is 0. */
  changePct: number | null;
  direction: 'up' | 'down' | 'flat';
}

export interface WorkspaceAnalytics {
  totalMembers: number;
  totalChannels: number;
  totalMessages: number;
  totalTasks: number;
  totalDocs: number;
  totalProjects: number;
  totalUploads: number;
  activeMembers: number;
  tasksByStatus: BreakdownSlice[];
  channelActivity: Array<{
    channelId: string;
    name: string;
    messages: number;
    members: number;
  }>;
  memberGrowth: TimeSeriesPoint[];
  messageTrend: TrendDelta;
}

export interface DashboardOverview {
  workspaceId: string;
  generatedAt: string;
  rangeDays: number;
  headline: {
    members: TrendDelta;
    messages: TrendDelta;
    tasks: TrendDelta;
    aiSessions: TrendDelta;
    events: TrendDelta;
  };
  totals: {
    members: number;
    channels: number;
    messages: number;
    tasks: number;
    docs: number;
    projects: number;
    uploads: number;
    storageBytes: number;
  };
  activitySeries: TimeSeriesPoint[];
  eventBreakdown: BreakdownSlice[];
  health: HealthStatus;
}

export interface UserAnalyticsRow {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  events: number;
  messages: number;
  tasks: number;
  lastActiveAt: string | null;
}

export interface UserAnalytics {
  rangeDays: number;
  totalEvents: number;
  activeUsers: number;
  /** Daily / weekly / monthly active users over the range. */
  dau: number;
  wau: number;
  mau: number;
  /** DAU ÷ MAU as a percentage — the standard stickiness ratio. */
  stickiness: number;
  activitySeries: TimeSeriesPoint[];
  eventBreakdown: BreakdownSlice[];
  topUsers: UserAnalyticsRow[];
}

export interface AIUsageStats {
  rangeDays: number;
  totalSessions: number;
  totalAgents: number;
  activeAgents: number;
  totalWorkflows: number;
  activeWorkflows: number;
  agentExecutions: number;
  agentSuccessRate: number;
  workflowExecutions: number;
  workflowSuccessRate: number;
  /** Mean wall-clock time of a workflow run; agent logs carry no duration. */
  avgWorkflowDurationMs: number;
  estimatedTokens: number;
  usageSeries: TimeSeriesPoint[];
  featureBreakdown: BreakdownSlice[];
  topAgents: Array<{
    agentId: string;
    name: string;
    executions: number;
    successRate: number;
    tokens: number;
  }>;
}

export interface StorageAnalytics {
  totalBytes: number;
  totalFiles: number;
  quotaBytes: number;
  usedPct: number;
  byType: BreakdownSlice[];
  growthSeries: TimeSeriesPoint[];
  largestFiles: Array<{
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
  }>;
  topUploaders: Array<{
    userId: string;
    name: string;
    files: number;
    bytes: number;
  }>;
}

export type ServiceState = 'HEALTHY' | 'DEGRADED' | 'DOWN';

export interface ServiceHealth {
  name: string;
  status: ServiceState;
  latencyMs: number | null;
  detail: string;
}

export interface HealthStatus {
  status: ServiceState;
  checkedAt: string;
  uptimeSeconds: number;
  services: ServiceHealth[];
  process: {
    heapUsedBytes: number;
    heapTotalBytes: number;
    rssBytes: number;
    nodeVersion: string;
    platform: string;
    pid: number;
  };
}

export interface RouteMetric {
  route: string;
  requests: number;
  errors: number;
  errorRate: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
}

export interface PerformanceMetrics {
  collectedSinceMs: number;
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  requestsPerMinute: number;
  latency: { avgMs: number; p50Ms: number; p95Ms: number; p99Ms: number };
  eventLoopLagMs: number;
  memory: { heapUsedBytes: number; heapTotalBytes: number; rssBytes: number };
  cpu: { userMs: number; systemMs: number };
  dbLatencyMs: number;
  slowestRoutes: RouteMetric[];
  throughputSeries: TimeSeriesPoint[];
}

export type ErrorSeverity = 'ERROR' | 'WARNING' | 'CRITICAL';

export interface TrackedError {
  id: string;
  fingerprint: string;
  message: string;
  name: string;
  statusCode: number;
  severity: ErrorSeverity;
  route: string;
  method: string;
  stack: string | null;
  userId: string | null;
  workspaceId: string | null;
  occurredAt: string;
}

export interface ErrorGroup {
  fingerprint: string;
  name: string;
  message: string;
  statusCode: number;
  severity: ErrorSeverity;
  route: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  sample: TrackedError;
}

export interface ErrorTrackingReport {
  rangeHours: number;
  totalErrors: number;
  uniqueGroups: number;
  errorRate: number;
  bySeverity: BreakdownSlice[];
  series: TimeSeriesPoint[];
  groups: ErrorGroup[];
  recent: TrackedError[];
}

export type ReportType =
  | 'WORKSPACE_SUMMARY'
  | 'USER_ACTIVITY'
  | 'AI_USAGE'
  | 'STORAGE'
  | 'PERFORMANCE'
  | 'ERRORS';

export type ReportFormat = 'json' | 'csv';

export interface ReportDefinition {
  type: ReportType;
  name: string;
  description: string;
  /** Column labels in the generated table, in order. */
  columns: string[];
}

export interface GeneratedReport {
  type: ReportType;
  name: string;
  workspaceId: string;
  rangeDays: number;
  generatedAt: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  summary: Record<string, string | number>;
}
