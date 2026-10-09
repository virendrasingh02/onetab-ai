import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  GeneratedReport,
  ReportDefinition,
  ReportType,
} from '@org/types';
import { AnalyticsService } from './analytics.service.js';
import {
  resolveAnalyticsWindow,
  type AnalyticsRangeQuery,
} from './analytics.util.js';
import { ErrorTrackingService } from './error-tracking.service.js';
import { MetricsService } from './metrics.service.js';

const DEFINITIONS: ReportDefinition[] = [
  {
    type: 'WORKSPACE_SUMMARY',
    name: 'Workspace summary',
    description:
      'Headline counts for members, channels, messages, tasks, docs and files.',
    columns: ['Metric', 'Value'],
  },
  {
    type: 'USER_ACTIVITY',
    name: 'User activity',
    description:
      'Per-member engagement over the range: events, messages, tasks and last seen.',
    columns: ['Member', 'Email', 'Role', 'Events', 'Messages', 'Tasks', 'Last active'],
  },
  {
    type: 'AI_USAGE',
    name: 'AI usage',
    description:
      'Chat sessions, agent and workflow executions, success rates and token estimate.',
    columns: ['Metric', 'Value'],
  },
  {
    type: 'STORAGE',
    name: 'Storage consumption',
    description: 'Usage against quota, split by file type, with the top uploaders.',
    columns: ['Category', 'Files', 'Bytes', 'Share %'],
  },
  {
    type: 'PERFORMANCE',
    name: 'Performance',
    description:
      'Latency percentiles, throughput and the slowest routes since the API started.',
    columns: ['Route', 'Requests', 'Errors', 'Avg ms', 'p95 ms', 'Max ms'],
  },
  {
    type: 'ERRORS',
    name: 'Error digest',
    description: 'Grouped failures with first/last seen and occurrence counts.',
    columns: ['Severity', 'Status', 'Route', 'Error', 'Count', 'First seen', 'Last seen'],
  },
  {
    type: 'AI_OVERVIEW',
    name: 'AI Studio Executive Overview',
    description: 'Headline runs, success rates, latency percentiles, tokens, and estimated cost.',
    columns: ['Category', 'Metric', 'Value'],
  },
  {
    type: 'AI_AGENT_PERFORMANCE',
    name: 'AI Agent Performance Audit',
    description: 'Per-agent execution volume, success rate, latency percentiles, token usage, and costs.',
    columns: ['Agent', 'Role', 'Status', 'Model', 'Runs', 'Success Rate %', 'Avg Latency (ms)', 'p95 (ms)', 'Tokens', 'Cost ($)', 'Approval Rate %'],
  },
  {
    type: 'AI_WORKFLOW_RELIABILITY',
    name: 'AI Workflow Reliability Digest',
    description: 'Workflow execution counts, success rates, bottleneck steps, and failure points.',
    columns: ['Workflow', 'Trigger', 'Version', 'Runs', 'Success %', 'Avg Latency (ms)', 'p95 (ms)', 'Tokens', 'Cost ($)'],
  },
  {
    type: 'AI_EXECUTION_HISTORY',
    name: 'AI Execution Audit Trail',
    description: 'Chronological execution records with duration, token counts, cost, and final status.',
    columns: ['Execution ID', 'Entity Type', 'Status', 'Latency (ms)', 'Tokens', 'Cost ($)', 'Started At'],
  },
  {
    type: 'AI_TOKEN_COST',
    name: 'Model Token & Cost Attribution',
    description: 'Breakdown of tokens and estimated model expenditure by provider and model.',
    columns: ['Model', 'Provider', 'Calls', 'Total Tokens', 'Cost ($)', 'Share %'],
  },
  {
    type: 'AI_CONNECTOR_PERFORMANCE',
    name: 'Tool & App Connector Telemetry',
    description: 'Invocation counts, latency, and reliability for application connectors and tools.',
    columns: ['Connector / Tool', 'Type', 'Invocations', 'Success Rate %', 'Avg Latency (ms)', 'Errors'],
  },
  {
    type: 'AI_ERROR_ANALYSIS',
    name: 'AI Error & Failure Analysis',
    description: 'Fingerprinted error signatures, classifications, affected runs, and recommended actions.',
    columns: ['Category', 'Severity', 'Sample Message', 'Occurrences', 'Affected Executions', 'Recovery %', 'First Seen', 'Last Seen'],
  },
  {
    type: 'AI_VERSION_COMPARISON',
    name: 'Agent & Workflow Version Comparison',
    description: 'Side-by-side performance comparison between deployment versions.',
    columns: ['Metric', 'Baseline', 'Target', 'Delta %', 'Regression'],
  },
  {
    type: 'AI_EVALUATIONS',
    name: 'AI Evaluation & User Feedback',
    description: 'Pass rates, user ratings, human reviews, and approval turnaround times.',
    columns: ['Category', 'Metric', 'Value'],
  },
];

function isReportType(value: string): value is ReportType {
  return DEFINITIONS.some((definition) => definition.type === value);
}

/** RFC 4180 quoting — values with commas, quotes or newlines must be wrapped. */
function csvCell(value: string | number): string {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

/**
 * Turns the analytics aggregations into flat, exportable tables.
 *
 * Reports intentionally reuse the dashboard's services rather than issuing
 * their own queries: an export that disagrees with the screen it was taken
 * from is worse than no export.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly metrics: MetricsService,
    private readonly errors: ErrorTrackingService,
  ) {}

  listDefinitions(): ReportDefinition[] {
    return DEFINITIONS;
  }

  async generate(
    workspaceId: string,
    type: string,
    range?: AnalyticsRangeQuery | string | number,
  ): Promise<GeneratedReport> {
    if (!isReportType(type)) {
      throw new BadRequestException(
        `Unknown report type "${type}". Expected one of: ${DEFINITIONS.map(
          (d) => d.type,
        ).join(', ')}.`,
      );
    }

    const query: AnalyticsRangeQuery =
      typeof range === 'object' && range !== null ? range : { days: range };
    const { days } = resolveAnalyticsWindow(query);
    const definition = DEFINITIONS.find((d) => d.type === type) as ReportDefinition;
    const base = {
      type: definition.type,
      name: definition.name,
      workspaceId,
      rangeDays: days,
      generatedAt: new Date().toISOString(),
      columns: definition.columns,
    };

    switch (definition.type) {
      case 'WORKSPACE_SUMMARY':
        return { ...base, ...(await this.workspaceSummary(workspaceId, query)) };
      case 'USER_ACTIVITY':
        return { ...base, ...(await this.userActivity(workspaceId, query)) };
      case 'AI_USAGE':
        return { ...base, ...(await this.aiUsage(workspaceId, query)) };
      case 'STORAGE':
        return { ...base, ...(await this.storage(workspaceId, query)) };
      case 'PERFORMANCE':
        return { ...base, ...(await this.performance()) };
      case 'ERRORS':
        return { ...base, ...(await this.errorDigest(workspaceId, days)) };
      case 'AI_OVERVIEW':
        return { ...base, ...(await this.aiOverviewReport(workspaceId, query)) };
      case 'AI_AGENT_PERFORMANCE':
        return { ...base, ...(await this.aiAgentPerformanceReport(workspaceId, query)) };
      case 'AI_WORKFLOW_RELIABILITY':
        return { ...base, ...(await this.aiWorkflowReliabilityReport(workspaceId, query)) };
      case 'AI_EXECUTION_HISTORY':
        return { ...base, ...(await this.aiExecutionHistoryReport(workspaceId, query)) };
      case 'AI_TOKEN_COST':
        return { ...base, ...(await this.aiTokenCostReport(workspaceId, query)) };
      case 'AI_CONNECTOR_PERFORMANCE':
        return { ...base, ...(await this.aiConnectorPerformanceReport(workspaceId, query)) };
      case 'AI_ERROR_ANALYSIS':
        return { ...base, ...(await this.aiErrorAnalysisReport(workspaceId, query)) };
      case 'AI_VERSION_COMPARISON':
        return { ...base, ...(await this.aiVersionComparisonReport(workspaceId, query)) };
      case 'AI_EVALUATIONS':
        return { ...base, ...(await this.aiEvaluationsReport(workspaceId, query)) };
    }
  }

  /** CSV rendering of an already-generated report. */
  toCsv(report: GeneratedReport): string {
    const lines = [
      report.columns.map(csvCell).join(','),
      ...report.rows.map((row) => row.map(csvCell).join(',')),
    ];
    return `${lines.join('\r\n')}\r\n`;
  }

  filenameFor(report: GeneratedReport, extension: string): string {
    const date = report.generatedAt.slice(0, 10);
    return `${report.type.toLowerCase()}-${date}.${extension}`;
  }

  private async workspaceSummary(workspaceId: string, query: AnalyticsRangeQuery) {
    const data = await this.analytics.getWorkspaceAnalytics(workspaceId, query);
    return {
      rows: [
        ['Members', data.totalMembers],
        ['Active members', data.activeMembers],
        ['Channels', data.totalChannels],
        ['Messages', data.totalMessages],
        ['Tasks', data.totalTasks],
        ['Documents', data.totalDocs],
        ['Projects', data.totalProjects],
        ['Files', data.totalUploads],
        ...data.tasksByStatus.map(
          (slice) => [`Tasks · ${slice.label}`, slice.value] as Array<string | number>,
        ),
      ] as Array<Array<string | number>>,
      summary: {
        Members: data.totalMembers,
        'Active members': data.activeMembers,
        'Messages this period': data.messageTrend.current,
        'Change vs. previous':
          data.messageTrend.changePct === null
            ? 'n/a'
            : `${data.messageTrend.changePct}%`,
      },
    };
  }

  private async userActivity(workspaceId: string, query: AnalyticsRangeQuery) {
    const data = await this.analytics.getUserAnalytics(workspaceId, query);
    return {
      rows: data.topUsers.map((user) => [
        user.name,
        user.email,
        user.role,
        user.events,
        user.messages,
        user.tasks,
        user.lastActiveAt ?? 'never',
      ]) as Array<Array<string | number>>,
      summary: {
        'Total events': data.totalEvents,
        DAU: data.dau,
        WAU: data.wau,
        MAU: data.mau,
        'Stickiness %': data.stickiness,
      },
    };
  }

  private async aiUsage(workspaceId: string, query: AnalyticsRangeQuery) {
    const data = await this.analytics.getAIUsageStats(workspaceId, query);
    return {
      rows: [
        ['Chat sessions (all time)', data.totalSessions],
        ['Agents', data.totalAgents],
        ['Active agents', data.activeAgents],
        ['Workflows', data.totalWorkflows],
        ['Active workflows', data.activeWorkflows],
        ['Agent executions', data.agentExecutions],
        ['Agent success rate %', data.agentSuccessRate],
        ['Workflow executions', data.workflowExecutions],
        ['Workflow success rate %', data.workflowSuccessRate],
        ['Avg workflow duration (ms)', data.avgWorkflowDurationMs],
        ['Estimated tokens', data.estimatedTokens],
      ] as Array<Array<string | number>>,
      summary: {
        'Agent executions': data.agentExecutions,
        'Workflow executions': data.workflowExecutions,
        'Estimated tokens': data.estimatedTokens,
      },
    };
  }

  private async storage(workspaceId: string, query: AnalyticsRangeQuery) {
    const data = await this.analytics.getStorageAnalytics(workspaceId, query);
    return {
      rows: [
        ...data.byType.map(
          (slice) =>
            [slice.label, '', slice.value, slice.percentage] as Array<
              string | number
            >,
        ),
        ...data.topUploaders.map(
          (uploader) =>
            [
              `Uploader · ${uploader.name}`,
              uploader.files,
              uploader.bytes,
              '',
            ] as Array<string | number>,
        ),
      ] as Array<Array<string | number>>,
      summary: {
        'Total files': data.totalFiles,
        'Total size': formatBytes(data.totalBytes),
        Quota: formatBytes(data.quotaBytes),
        'Used %': data.usedPct,
      },
    };
  }

  private async performance() {
    const data = await this.metrics.getPerformanceMetrics();
    return {
      rows: data.slowestRoutes.map((route) => [
        route.route,
        route.requests,
        route.errors,
        route.avgMs,
        route.p95Ms,
        route.maxMs,
      ]) as Array<Array<string | number>>,
      summary: {
        'Requests observed': data.totalRequests,
        'Error rate %': data.errorRate,
        'p95 latency (ms)': data.latency.p95Ms,
        'Requests / min': data.requestsPerMinute,
        'DB latency (ms)': data.dbLatencyMs,
      },
    };
  }

  private async errorDigest(workspaceId: string, days: number) {
    const data = await this.errors.getReport(workspaceId, days * 24);
    return {
      rows: data.groups.map((group) => [
        group.severity,
        group.statusCode,
        group.route,
        `${group.name}: ${group.message}`,
        group.count,
        group.firstSeenAt,
        group.lastSeenAt,
      ]) as Array<Array<string | number>>,
      summary: {
        'Total errors': data.totalErrors,
        'Unique issues': data.uniqueGroups,
        'Errors / hour': data.errorRate,
      },
    };
  }

  private async aiOverviewReport(workspaceId: string, query: AnalyticsRangeQuery) {
    const data = await this.analytics.getDeepAIOverview(workspaceId, query);
    return {
      rows: [
        ['Executions', 'Total runs', data.execution.totalRuns],
        ['Executions', 'Successful runs', data.execution.successfulRuns],
        ['Executions', 'Failed runs', data.execution.failedRuns],
        ['Executions', 'Success rate %', data.execution.successRate],
        ['Executions', 'Active agents', data.execution.uniqueActiveAgents],
        ['Executions', 'Active workflows', data.execution.uniqueActiveWorkflows],
        ['Performance', 'Avg latency (ms)', data.performance.avgLatencyMs],
        ['Performance', 'p95 latency (ms)', data.performance.p95LatencyMs],
        ['Performance', 'Timeout rate %', data.performance.timeoutRate],
        ['AI Tokens', 'Total tokens', data.tokens.totalTokens],
        ['AI Tokens', 'Input tokens', data.tokens.totalInputTokens],
        ['AI Tokens', 'Output tokens', data.tokens.totalOutputTokens],
        ['Cost & Usage', 'Total cost ($)', data.cost.totalCostUsd],
        ['Cost & Usage', 'Budget cap ($)', data.cost.budgetCapUsd],
        ['Cost & Usage', 'Budget utilization %', data.cost.budgetUtilizationPct],
        ['Reliability', 'Total errors', data.reliability.errorCount],
        ['Reliability', 'Rate limit events', data.reliability.rateLimitFailures],
        ['Reliability', 'Auth failures', data.reliability.authConnectorFailures],
      ] as Array<Array<string | number>>,
      summary: {
        'Total runs': data.execution.totalRuns,
        'Success rate %': data.execution.successRate,
        'p95 latency (ms)': data.performance.p95LatencyMs,
        'Total tokens': data.tokens.totalTokens,
        'Total cost ($)': data.cost.totalCostUsd,
      },
    };
  }

  private async aiAgentPerformanceReport(workspaceId: string, query: AnalyticsRangeQuery) {
    const agents = await this.analytics.getAgentAnalytics(workspaceId, query);
    return {
      rows: agents.map((a) => [
        a.name,
        a.role,
        a.status,
        a.model,
        a.executionCount,
        a.successRate,
        a.avgLatencyMs,
        a.p95LatencyMs,
        a.totalTokens,
        a.totalCostUsd,
        a.approvalRatePct,
      ]) as Array<Array<string | number>>,
      summary: {
        'Active agents': agents.length,
        'Total executions': agents.reduce((s, a) => s + a.executionCount, 0),
        'Total cost ($)': Number(agents.reduce((s, a) => s + a.totalCostUsd, 0).toFixed(4)),
      },
    };
  }

  private async aiWorkflowReliabilityReport(workspaceId: string, query: AnalyticsRangeQuery) {
    const workflows = await this.analytics.getWorkflowAnalytics(workspaceId, query);
    return {
      rows: workflows.map((w) => [
        w.name,
        w.triggerType,
        w.version,
        w.totalExecutions,
        w.successRate,
        w.avgLatencyMs,
        w.p95LatencyMs,
        w.totalTokens,
        w.totalCostUsd,
      ]) as Array<Array<string | number>>,
      summary: {
        'Total workflows': workflows.length,
        'Total runs': workflows.reduce((s, w) => s + w.totalExecutions, 0),
        'Average success rate %':
          workflows.length > 0
            ? Number((workflows.reduce((s, w) => s + w.successRate, 0) / workflows.length).toFixed(1))
            : 100,
      },
    };
  }

  private async aiExecutionHistoryReport(workspaceId: string, query: AnalyticsRangeQuery) {
    const overview = await this.analytics.getDeepAIOverview(workspaceId, query);
    const agents = await this.analytics.getAgentAnalytics(workspaceId, query);
    const rows: Array<Array<string | number>> = [];
    for (const a of agents) {
      for (const ex of a.recentExecutions) {
        rows.push([
          ex.id,
          'AGENT',
          ex.status,
          ex.latencyMs,
          ex.tokensUsed,
          ex.totalCost,
          ex.startedAt,
        ]);
      }
    }
    return {
      rows,
      summary: {
        'Total runs recorded': overview.execution.totalRuns,
        'Success rate %': overview.execution.successRate,
      },
    };
  }

  private async aiTokenCostReport(workspaceId: string, query: AnalyticsRangeQuery) {
    const data = await this.analytics.getModelAnalytics(workspaceId, query);
    const totalCost = data.reduce((s, m) => s + m.totalCostUsd, 0);
    return {
      rows: data.map((m) => [
        m.model,
        m.provider,
        m.requestCount,
        m.totalTokens,
        m.totalCostUsd,
        totalCost > 0 ? Number(((m.totalCostUsd / totalCost) * 100).toFixed(1)) : 0,
      ]) as Array<Array<string | number>>,
      summary: {
        'Total models': data.length,
        'Total tokens': data.reduce((s, m) => s + m.totalTokens, 0),
        'Total estimated cost ($)': Number(totalCost.toFixed(4)),
      },
    };
  }

  private async aiConnectorPerformanceReport(workspaceId: string, query: AnalyticsRangeQuery) {
    const data = await this.analytics.getToolConnectorAnalytics(workspaceId, query);
    const rows: Array<Array<string | number>> = [
      ...data.connectors.map((c) => [
        c.name,
        'Connector',
        c.invocations,
        c.successRate,
        c.avgLatencyMs,
        c.authFailures + c.timeouts,
      ]),
      ...data.tools.map((t) => [
        t.name,
        'Tool',
        t.invocations,
        t.successRate,
        t.avgLatencyMs,
        t.errors,
      ]),
    ];
    return {
      rows,
      summary: {
        Connectors: data.connectors.length,
        Tools: data.tools.length,
      },
    };
  }

  private async aiErrorAnalysisReport(workspaceId: string, query: AnalyticsRangeQuery) {
    const data = await this.analytics.getErrorAnalytics(workspaceId, query);
    return {
      rows: data.map((e) => [
        e.category,
        e.severity,
        e.sampleMessage.slice(0, 100),
        e.occurrenceCount,
        e.affectedExecutionsCount,
        e.recoveryRateAfterRetry,
        e.firstSeenAt,
        e.lastSeenAt,
      ]) as Array<Array<string | number>>,
      summary: {
        'Unique error groups': data.length,
        'Total failures': data.reduce((s, e) => s + e.occurrenceCount, 0),
      },
    };
  }

  private async aiVersionComparisonReport(workspaceId: string, query: AnalyticsRangeQuery) {
    const agents = await this.analytics.getAgentAnalytics(workspaceId, query);
    const agent = agents[0];
    if (!agent) {
      return {
        rows: [['No agents found to compare', '-', '-', '-', '-']],
        summary: {
          'Entity compared': 'None',
          'Sample size warning': 'No',
          Regressions: 0,
        },
      };
    }
    const cmp = await this.analytics.compareVersions(workspaceId, 'AGENT', agent.agentId, 1, 2);
    return {
      rows: [
        ['Run count', cmp.versionA.runCount, cmp.versionB.runCount, `${cmp.versionB.runCount - cmp.versionA.runCount}`, 'OK'],
        ['Success rate %', cmp.versionA.successRate, cmp.versionB.successRate, `${cmp.diff.successRateDelta}%`, cmp.diff.successRateDelta < 0 ? 'Regression' : 'Improved'],
        ['Avg Latency (ms)', cmp.versionA.avgLatencyMs, cmp.versionB.avgLatencyMs, `${cmp.diff.latencyDeltaPct}%`, cmp.diff.latencyDeltaPct > 20 ? 'Regression' : 'OK'],
        ['Cost ($)', cmp.versionA.avgCostUsd, cmp.versionB.avgCostUsd, `${cmp.diff.costDeltaPct}%`, cmp.diff.costDeltaPct > 25 ? 'Regression' : 'OK'],
      ] as Array<Array<string | number>>,
      summary: {
        'Entity compared': cmp.entityName,
        'Sample size warning': cmp.sampleSizeWarning ? 'Yes' : 'No',
        Regressions: cmp.regressions.length,
      },
    };
  }

  private async aiEvaluationsReport(workspaceId: string, query: AnalyticsRangeQuery) {
    const data = await this.analytics.getEvaluationsAnalytics(workspaceId, query);
    return {
      rows: [
        ['Overall Quality', 'Pass rate %', data.passRatePct],
        ['Overall Quality', 'Average rating (out of 5)', data.ratingAverage],
        ['User Feedback', 'Total ratings submitted', data.totalFeedbackCount],
        ['User Feedback', 'Positive ratings', data.positiveFeedbackCount],
        ['User Feedback', 'Negative ratings', data.negativeFeedbackCount],
        ['Human Governance', 'Total approval requests', data.humanApprovals.totalRequests],
        ['Human Governance', 'Approved requests', data.humanApprovals.approved],
        ['Human Governance', 'Rejected requests', data.humanApprovals.rejected],
        ['Human Governance', 'Avg turnaround (mins)', data.humanApprovals.avgResponseTimeMinutes],
      ] as Array<Array<string | number>>,
      summary: {
        'Pass rate %': data.passRatePct,
        'Average score': data.avgScore,
        'Feedback count': data.totalFeedbackCount,
      },
    };
  }
}
