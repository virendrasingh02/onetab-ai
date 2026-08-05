import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  GeneratedReport,
  ReportDefinition,
  ReportType,
} from '@org/types';
import { AnalyticsService } from './analytics.service.js';
import { normaliseDays } from './analytics.util.js';
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
    rawDays?: string | number,
  ): Promise<GeneratedReport> {
    if (!isReportType(type)) {
      throw new BadRequestException(
        `Unknown report type "${type}". Expected one of: ${DEFINITIONS.map(
          (d) => d.type,
        ).join(', ')}.`,
      );
    }

    const days = normaliseDays(rawDays);
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
        return { ...base, ...(await this.workspaceSummary(workspaceId, days)) };
      case 'USER_ACTIVITY':
        return { ...base, ...(await this.userActivity(workspaceId, days)) };
      case 'AI_USAGE':
        return { ...base, ...(await this.aiUsage(workspaceId, days)) };
      case 'STORAGE':
        return { ...base, ...(await this.storage(workspaceId, days)) };
      case 'PERFORMANCE':
        return { ...base, ...(await this.performance()) };
      case 'ERRORS':
        return { ...base, ...(await this.errorDigest(workspaceId, days)) };
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

  private async workspaceSummary(workspaceId: string, days: number) {
    const data = await this.analytics.getWorkspaceAnalytics(workspaceId, days);
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

  private async userActivity(workspaceId: string, days: number) {
    const data = await this.analytics.getUserAnalytics(workspaceId, days);
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

  private async aiUsage(workspaceId: string, days: number) {
    const data = await this.analytics.getAIUsageStats(workspaceId, days);
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

  private async storage(workspaceId: string, days: number) {
    const data = await this.analytics.getStorageAnalytics(workspaceId, days);
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
}
