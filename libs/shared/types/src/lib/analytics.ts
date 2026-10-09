/**
 * Phase 11 — Analytics & Administration contracts.
 *
 * Shared between the Nest analytics module and the web dashboards so a change
 * to an aggregation shape breaks the compile rather than the screen.
 */

/**
 * The window every workspace analytics endpoint accepts: inclusive calendar
 * days as `YYYY-MM-DD`, resolved in the viewer's time zone by the shared
 * `DateRangeFilter` (`toDateRangeQuery` in `@org/utils`).
 */
export interface AnalyticsDateRange {
  from: string;
  to: string;
}

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
  | 'ERRORS'
  | 'AI_OVERVIEW'
  | 'AI_AGENT_PERFORMANCE'
  | 'AI_WORKFLOW_RELIABILITY'
  | 'AI_EXECUTION_HISTORY'
  | 'AI_TOKEN_COST'
  | 'AI_CONNECTOR_PERFORMANCE'
  | 'AI_ERROR_ANALYSIS'
  | 'AI_VERSION_COMPARISON'
  | 'AI_EVALUATIONS';

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

export type PricingAnalyticsEventType =
  | 'pricing_viewed'
  | 'pricing_plan_selected'
  | 'pricing_toggle_monthly'
  | 'pricing_toggle_yearly'
  | 'promotion_applied'
  | 'promotion_failed'
  | 'checkout_started'
  | 'checkout_completed'
  | 'checkout_failed'
  | 'plan_upgraded'
  | 'plan_downgraded'
  | 'subscription_cancelled'
  | 'enterprise_contact_started'
  | 'enterprise_contact_submitted'
  | 'upgrade_prompt_viewed'
  | 'plan_limit_reached';

// ============================================================================
// Deep AI Observability & Analytics Contracts
// ============================================================================

export type AIErrorCategory =
  | 'MODEL_PROVIDER'
  | 'AUTHENTICATION_PERMISSION'
  | 'CONNECTOR'
  | 'TOOL_EXECUTION'
  | 'VALIDATION'
  | 'INVALID_WORKFLOW_CONFIG'
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'MEMORY_RETRIEVAL'
  | 'OUTPUT_PARSING'
  | 'BUDGET_QUOTA'
  | 'CANCELLATION'
  | 'UNKNOWN';

export interface DeepAIAnalyticsOverview {
  window: {
    since: string;
    until: string;
    days: number;
    previousSince: string;
  };
  execution: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    cancelledRuns: number;
    runningRuns: number;
    queuedRuns: number;
    successRate: number;
    failureRate: number;
    retryRate: number;
    avgRunsPerAgent: number;
    uniqueActiveAgents: number;
    uniqueActiveWorkflows: number;
    uniqueActiveUsers: number;
    trends: Array<{
      date: string;
      timestamp: string;
      total: number;
      success: number;
      failed: number;
      cancelled: number;
    }>;
    previousComparison: {
      totalRunsDelta: number;
      totalRunsPct: number;
      successRateDelta: number;
      failedRunsDelta: number;
    };
  };
  performance: {
    avgLatencyMs: number;
    medianLatencyMs: number;
    p90LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    timeToFirstTokenMs: number | null;
    avgModelResponseTimeMs: number;
    toolExecutionDurationMs: number;
    queueWaitTimeMs: number;
    nodeProcessingDurationMs: number;
    slowestWorkflows: Array<{
      id: string;
      name: string;
      avgLatencyMs: number;
      p95LatencyMs: number;
      runs: number;
    }>;
    slowestAgents: Array<{
      id: string;
      name: string;
      avgLatencyMs: number;
      p95LatencyMs: number;
      runs: number;
    }>;
    slowestNodes: Array<{
      stepId: string;
      nodeType: string;
      avgLatencyMs: number;
      count: number;
    }>;
    timeoutRate: number;
    concurrentExecutions: number;
  };
  tokens: {
    totalTokens: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    tokensPerExecution: number;
    tokensPerAgent: number;
    tokensPerWorkflow: number;
    modelDistribution: Array<{
      model: string;
      provider: string;
      tokens: number;
      calls: number;
      sharePct: number;
      cost: number;
    }>;
    toolInvocationCount: number;
    connectorInvocationCount: number;
    avgTokensPerSuccessfulRun: number;
  };
  cost: {
    totalCostUsd: number;
    inputCostUsd: number;
    outputCostUsd: number;
    costPerRunUsd: number;
    costPerSuccessfulRunUsd: number;
    costPerAgent: Array<{
      agentId: string;
      name: string;
      costUsd: number;
      runs: number;
    }>;
    costPerWorkflow: Array<{
      workflowId: string;
      name: string;
      costUsd: number;
      runs: number;
    }>;
    costByModel: Array<{
      model: string;
      costUsd: number;
      sharePct: number;
    }>;
    costTrends: Array<{
      date: string;
      costUsd: number;
    }>;
    budgetCapUsd: number;
    budgetUtilizationPct: number;
    projectedSpendUsd: number;
    isEstimate: boolean;
  };
  reliability: {
    errorCount: number;
    errorRatePct: number;
    retryCount: number;
    rateLimitFailures: number;
    authConnectorFailures: number;
    modelProviderFailures: number;
    timeoutFailures: number;
    workflowInterruptionRate: number;
    recoveryRatePct: number;
  };
}

/** `GET /analytics/workspace/:id/ai-costs` — the cost slice of the deep overview. */
export interface AICostAnalytics {
  totalCostUsd: number;
  inputCostUsd: number;
  outputCostUsd: number;
  costPerRunUsd: number;
  costPerSuccessfulRunUsd: number;
  budgetCapUsd: number;
  budgetUtilizationPct: number;
  projectedSpendUsd: number;
  costTrends: DeepAIAnalyticsOverview['cost']['costTrends'];
  costByModel: DeepAIAnalyticsOverview['cost']['costByModel'];
  costPerAgent: DeepAIAnalyticsOverview['cost']['costPerAgent'];
  costPerWorkflow: DeepAIAnalyticsOverview['cost']['costPerWorkflow'];
  optimizationOpportunities: Array<{
    title: string;
    description: string;
    estimatedSavingsPct: number;
  }>;
}

export interface AgentAnalyticsProfile {
  agentId: string;
  name: string;
  role: string;
  status: string;
  ownerName: string;
  model: string;
  provider: string;
  version: number;
  executionCount: number;
  successRate: number;
  failureRate: number;
  avgLatencyMs: number;
  medianLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  costPerSuccessfulTaskUsd: number;
  toolsUsed: Array<{
    name: string;
    calls: number;
    successRate: number;
    avgLatencyMs: number;
  }>;
  connectorUsage: Array<{
    connectorId: string;
    provider: string;
    calls: number;
    errors: number;
  }>;
  retryCount: number;
  timeoutCount: number;
  approvalCount: number;
  approvalRatePct: number;
  feedbackScore: number | null;
  recentExecutions: Array<{
    id: string;
    status: string;
    startedAt: string;
    latencyMs: number;
    tokensUsed: number;
    totalCost: number;
    error?: string | null;
  }>;
  versionHistory: Array<{
    version: number;
    runs: number;
    successRate: number;
    avgLatencyMs: number;
    costUsd: number;
  }>;
}

export interface WorkflowAnalyticsProfile {
  workflowId: string;
  name: string;
  triggerType: string;
  isActive: boolean;
  version: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  totalTokens: number;
  totalCostUsd: number;
  costPerSuccessfulExecutionUsd: number;
  commonFailurePoints: Array<{
    stepId: string;
    nodeType: string;
    failureCount: number;
    failureRate: number;
  }>;
  expensiveNodes: Array<{
    stepId: string;
    nodeType: string;
    totalTokens: number;
    costUsd: number;
  }>;
  slowestNodes: Array<{
    stepId: string;
    nodeType: string;
    avgLatencyMs: number;
    p95LatencyMs: number;
  }>;
  nodeMetrics: Record<
    string,
    {
      invocations: number;
      successCount: number;
      errorCount: number;
      successRate: number;
      avgLatencyMs: number;
      totalTokens: number;
      costUsd: number;
      timeoutCount: number;
      errorRate: number;
      relativeHeat: number;
    }
  >;
  versionPerformance: Array<{
    version: number;
    runs: number;
    successRate: number;
    avgLatencyMs: number;
  }>;
}

export interface ExecutionTraceSpan {
  spanId: string;
  parentSpanId: string | null;
  traceId: string;
  executionId: string;
  name: string;
  operationType:
    | 'TRIGGER'
    | 'AGENT_PLAN'
    | 'MODEL_REQUEST'
    | 'TOOL_INVOCATION'
    | 'CONNECTOR_REQUEST'
    | 'NODE_TRANSITION'
    | 'CONDITION_BRANCH'
    | 'MEMORY_SEARCH'
    | 'HUMAN_APPROVAL'
    | 'OUTPUT_DELIVERY'
    | 'ERROR_HANDLER';
  startTime: string;
  endTime: string;
  durationMs: number;
  status: 'SUCCESS' | 'FAILED' | 'RUNNING' | 'WAITING' | 'CANCELLED';
  nodeId?: string;
  nodeType?: string;
  model?: string;
  provider?: string;
  toolName?: string;
  connectorId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  errorMessage?: string | null;
  errorCategory?: AIErrorCategory | null;
  errorStack?: string | null;
  inputRedacted?: Record<string, unknown>;
  outputRedacted?: Record<string, unknown>;
  children: ExecutionTraceSpan[];
}

export interface AIExecutionTrace {
  executionId: string;
  traceId: string;
  rootSpan: ExecutionTraceSpan;
  totalDurationMs: number;
  totalTokens: number;
  totalCostUsd: number;
  status: string;
  spanCount: number;
  bottlenecks: Array<{
    spanId: string;
    name: string;
    durationMs: number;
    percentageOfTotal: number;
  }>;
  spans?: ExecutionTraceSpan[];
  bottleneckSpanId?: string | null;
  durationMs?: number;
}

export interface NodeAnalyticsRecord {
  nodeType: string;
  invocations: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  avgDurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  totalTokens: number;
  costUsd: number;
  retryCount: number;
  timeoutCount: number;
  errorDistribution: Record<string, number>;
}

export interface ConnectorAnalyticsRecord {
  connectorId: string;
  provider: string;
  name: string;
  category: string;
  invocations: number;
  successRate: number;
  avgLatencyMs: number;
  timeouts: number;
  retries: number;
  rateLimits: number;
  authFailures: number;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  affectedAgentsCount: number;
  affectedWorkflowsCount: number;
}

export interface ModelAnalyticsRecord {
  model: string;
  provider: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens: number;
  avgLatencyMs: number;
  p90LatencyMs: number;
  p95LatencyMs: number;
  timeToFirstTokenMs: number | null;
  totalCostUsd: number;
  rateLimitsHit: number;
}

export interface ErrorAnalyticsGroup {
  fingerprint: string;
  category: AIErrorCategory;
  severity: 'WARNING' | 'ERROR' | 'CRITICAL';
  title: string;
  sampleMessage: string;
  occurrenceCount: number;
  affectedExecutionsCount: number;
  affectedAgents: string[];
  affectedNodes: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  recoveryRateAfterRetry: number;
  trend: Array<{ date: string; count: number }>;
  possibleCause: string;
  recommendedAction: string;
  recentExecutions: Array<{
    id: string;
    entityType: string;
    entityId: string;
    startedAt: string;
    errorMessage: string;
  }>;
}

export interface AnalyticsAlertRule {
  id: string;
  name: string;
  metric:
    | 'FAILURE_RATE'
    | 'LATENCY_SPIKE'
    | 'NODE_TIMEOUT'
    | 'CONNECTOR_AUTH'
    | 'TOKEN_SPIKE'
    | 'BUDGET_THRESHOLD';
  condition: 'GREATER_THAN' | 'LESS_THAN';
  threshold: number;
  windowMinutes: number;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  status: 'ACTIVE' | 'FIRING' | 'RESOLVED' | 'DISABLED';
  cooldownMinutes: number;
  lastTriggeredAt: string | null;
  notifyChannels: string[];
  createdAt: string;
}

export interface AnalyticsAlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  triggeredValue: number;
  threshold: number;
  message: string;
  status: 'FIRING' | 'RESOLVED' | 'ACKNOWLEDGED';
  triggeredAt: string;
  resolvedAt?: string | null;
  executionId?: string | null;
}

export interface VersionComparisonResult {
  entityType: 'AGENT' | 'WORKFLOW';
  entityId: string;
  entityName: string;
  versionA: {
    version: number;
    runCount: number;
    successRate: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    avgTokens: number;
    avgCostUsd: number;
    errorRate: number;
  };
  versionB: {
    version: number;
    runCount: number;
    successRate: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    avgTokens: number;
    avgCostUsd: number;
    errorRate: number;
  };
  diff: {
    successRateDelta: number;
    latencyDeltaPct: number;
    costDeltaPct: number;
    tokensDeltaPct: number;
  };
  regressions: Array<{
    metric: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
  sampleSizeWarning: boolean;
}

export interface ModelPricingItem {
  model: string;
  provider: string;
  inputPer1MTokens: number;
  outputPer1MTokens: number;
  cacheReadPer1MTokens?: number;
  effectiveDate: string;
}

export interface ModelPricingConfig {
  version: string;
  updatedAt: string;
  pricing: ModelPricingItem[];
}

export interface AnalyticsSettingsConfig {
  retentionDaysMetadata: number;
  retentionDaysPayload: number;
  redactSecrets: boolean;
  redactedKeys: string[];
  budgetMonthlyUsd: number;
  budgetAlertThresholdPct: number;
  defaultTimeframe: '24H' | '7D' | '30D' | '90D';
}

export interface EvaluationsAnalyticsOverview {
  totalEvaluations: number;
  passRatePct: number;
  avgScore: number;
  totalFeedbackCount: number;
  positiveFeedbackCount: number;
  negativeFeedbackCount: number;
  ratingAverage: number;
  topIssues: Array<{ category: string; count: number }>;
  recentFeedback: Array<{
    id: string;
    rating: number;
    comment: string | null;
    issueCategory: string | null;
    createdAt: string;
    agentName?: string;
    executionId?: string | null;
  }>;
  humanApprovals: {
    totalRequests: number;
    approved: number;
    rejected: number;
    pending: number;
    avgResponseTimeMinutes: number;
  };
}
