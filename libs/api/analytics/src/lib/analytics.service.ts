import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@org/database';
import type {
  AIUsageStats,
  DashboardOverview,
  StorageAnalytics,
  UserAnalytics,
  UserAnalyticsRow,
  WorkspaceAnalytics,
} from '@org/types';
import {
  normaliseDays,
  startOfRange,
  toBreakdown,
  toDailySeries,
  toTrend,
} from './analytics.util.js';
import { ERROR_EVENT_TYPE } from './error-tracking.service.js';
import { HealthService } from './health.service.js';

/** Caps every unbounded scan so one busy workspace cannot exhaust memory. */
const MAX_SCAN = 20_000;

/** Default per-workspace storage allowance when none is configured. */
const DEFAULT_QUOTA_BYTES = 50 * 1024 * 1024 * 1024;

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly health: HealthService,
  ) {}

  // -------------------------------------------------------------------------
  // Event ingestion
  // -------------------------------------------------------------------------

  async trackEvent(
    workspaceId: string,
    userId: string,
    eventType: string,
    metadata: Record<string, unknown> = {},
  ) {
    this.logger.debug(
      `event ${eventType} · user ${userId} · ws ${workspaceId}`,
    );
    return this.prisma.analyticsEvent.create({
      data: {
        workspaceId,
        userId,
        eventType,
        metadata: JSON.stringify(metadata),
      },
    });
  }

  // -------------------------------------------------------------------------
  // Dashboard
  // -------------------------------------------------------------------------

  /** The landing screen: headline trends, activity curve and platform health. */
  async getDashboard(
    workspaceId: string,
    rawDays?: string | number,
  ): Promise<DashboardOverview> {
    const days = normaliseDays(rawDays);
    const since = startOfRange(days);
    const previousSince = new Date(
      since.getTime() - days * 24 * 60 * 60 * 1_000,
    );

    // Batched through `$transaction` rather than `Promise.all`: the array form
    // runs the queries sequentially on a single pooled connection, so a screen
    // that needs fourteen aggregates cannot exhaust the connection pool.
    const [
      members,
      channels,
      messages,
      tasks,
      docs,
      projects,
      uploads,
      storage,
      events,
      windowMembers,
      windowMessages,
      windowTasks,
      windowSessions,
    ] = await this.prisma.$transaction([
      this.prisma.workspaceMember.count({ where: { workspaceId } }),
      this.prisma.channel.count({ where: { workspaceId } }),
      this.prisma.recentActivity.count({
        where: { workspaceId, kind: 'MESSAGE' },
      }),
      this.prisma.task.count({ where: { workspaceId } }),
      this.prisma.workDocument.count({ where: { workspaceId } }),
      this.prisma.project.count({ where: { workspaceId } }),
      this.prisma.upload.count({ where: { workspaceId } }),
      this.prisma.upload.aggregate({
        where: { workspaceId },
        _sum: { size: true },
      }),
      this.prisma.analyticsEvent.findMany({
        where: { workspaceId, createdAt: { gte: previousSince } },
        select: { eventType: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: MAX_SCAN,
      }),
      // One scan of each windowed table, split into current vs. previous
      // period in memory — cheaper than a second round of count queries.
      this.prisma.workspaceMember.findMany({
        where: { workspaceId, joinedAt: { gte: previousSince } },
        select: { joinedAt: true },
        take: MAX_SCAN,
      }),
      this.prisma.recentActivity.findMany({
        where: {
          workspaceId,
          kind: 'MESSAGE',
          occurredAt: { gte: previousSince },
        },
        select: { occurredAt: true },
        take: MAX_SCAN,
      }),
      this.prisma.task.findMany({
        where: { workspaceId, createdAt: { gte: previousSince } },
        select: { createdAt: true },
        take: MAX_SCAN,
      }),
      this.prisma.aIChatSession.findMany({
        where: { workspaceId, createdAt: { gte: previousSince } },
        select: { createdAt: true },
        take: MAX_SCAN,
      }),
    ]);

    // Outside the batch: health probes external services over HTTP and holds
    // no database connection while it waits on them.
    const health = await this.health.getHealth();

    const split = <T>(rows: T[], pick: (row: T) => Date) => {
      let current = 0;
      let previous = 0;
      for (const row of rows) {
        if (pick(row) >= since) current += 1;
        else previous += 1;
      }
      return toTrend(current, previous);
    };

    const currentEvents = events.filter((e) => e.createdAt >= since);

    return {
      workspaceId,
      generatedAt: new Date().toISOString(),
      rangeDays: days,
      headline: {
        members: split(windowMembers, (r) => r.joinedAt),
        messages: split(windowMessages, (r) => r.occurredAt),
        tasks: split(windowTasks, (r) => r.createdAt),
        aiSessions: split(windowSessions, (r) => r.createdAt),
        events: split(events, (r) => r.createdAt),
      },
      totals: {
        members,
        channels,
        messages,
        tasks,
        docs,
        projects,
        uploads,
        storageBytes: storage._sum.size ?? 0,
      },
      activitySeries: toDailySeries(
        currentEvents.map((e) => e.createdAt),
        days,
      ),
      eventBreakdown: this.countBy(currentEvents.map((e) => e.eventType)),
      health,
    };
  }

  // -------------------------------------------------------------------------
  // Workspace analytics
  // -------------------------------------------------------------------------

  async getWorkspaceAnalytics(
    workspaceId: string,
    rawDays?: string | number,
  ): Promise<WorkspaceAnalytics> {
    const days = normaliseDays(rawDays);
    const since = startOfRange(days);
    const previousSince = new Date(
      since.getTime() - days * 24 * 60 * 60 * 1_000,
    );

    const [
      totalMembers,
      totalChannels,
      totalMessages,
      totalTasks,
      totalDocs,
      totalProjects,
      totalUploads,
      activeMembers,
      tasksByStatus,
      channels,
      memberJoins,
      messageWindow,
    ] = await this.prisma.$transaction([
      this.prisma.workspaceMember.count({ where: { workspaceId } }),
      this.prisma.channel.count({ where: { workspaceId } }),
      this.prisma.recentActivity.count({
        where: { workspaceId, kind: 'MESSAGE' },
      }),
      this.prisma.task.count({ where: { workspaceId } }),
      this.prisma.workDocument.count({ where: { workspaceId } }),
      this.prisma.project.count({ where: { workspaceId } }),
      this.prisma.upload.count({ where: { workspaceId } }),
      this.prisma.workspaceMember.count({
        where: { workspaceId, lastSeenAt: { gte: since } },
      }),
      this.prisma.task.groupBy({
        by: ['status'],
        where: { workspaceId },
        _count: { _all: true },
      }),
      this.prisma.channel.findMany({
        where: { workspaceId },
        select: {
          id: true,
          name: true,
          _count: { select: { recentActivities: true, members: true } },
        },
        take: 200,
      }),
      this.prisma.workspaceMember.findMany({
        where: { workspaceId, joinedAt: { gte: since } },
        select: { joinedAt: true },
        take: MAX_SCAN,
      }),
      this.prisma.recentActivity.findMany({
        where: {
          workspaceId,
          kind: 'MESSAGE',
          occurredAt: { gte: previousSince },
        },
        select: { occurredAt: true },
        take: MAX_SCAN,
      }),
    ]);

    const currentMessages = messageWindow.filter(
      (m) => m.occurredAt >= since,
    ).length;

    return {
      totalMembers,
      totalChannels,
      totalMessages,
      totalTasks,
      totalDocs,
      totalProjects,
      totalUploads,
      activeMembers,
      tasksByStatus: toBreakdown(
        Object.fromEntries(
          tasksByStatus.map((row) => [row.status, row._count._all]),
        ),
      ),
      channelActivity: channels
        .map((channel) => ({
          channelId: channel.id,
          name: channel.name,
          messages: channel._count.recentActivities,
          members: channel._count.members,
        }))
        .sort((a, b) => b.messages - a.messages)
        .slice(0, 10),
      memberGrowth: toDailySeries(
        memberJoins.map((m) => m.joinedAt),
        days,
      ),
      messageTrend: toTrend(
        currentMessages,
        messageWindow.length - currentMessages,
      ),
    };
  }

  // -------------------------------------------------------------------------
  // User analytics
  // -------------------------------------------------------------------------

  async getUserAnalytics(
    workspaceId: string,
    rawDays?: string | number,
  ): Promise<UserAnalytics> {
    const days = normaliseDays(rawDays);
    const since = startOfRange(days);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1_000);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000);

    const [events, members, messageCounts, taskCounts] =
      await this.prisma.$transaction([
        this.prisma.analyticsEvent.findMany({
          where: { workspaceId, createdAt: { gte: since } },
          select: { userId: true, eventType: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: MAX_SCAN,
        }),
        this.prisma.workspaceMember.findMany({
          where: { workspaceId },
          select: {
            role: true,
            lastSeenAt: true,
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
          take: 1_000,
        }),
        this.prisma.recentActivity.groupBy({
          by: ['userId'],
          where: { workspaceId, kind: 'MESSAGE', occurredAt: { gte: since } },
          _count: { _all: true },
        }),
        this.prisma.task.groupBy({
          by: ['assigneeId'],
          where: { workspaceId, createdAt: { gte: since } },
          _count: { _all: true },
        }),
      ]);

    const eventsByUser = new Map<string, number>();
    const lastSeenByUser = new Map<string, Date>();
    for (const event of events) {
      eventsByUser.set(event.userId, (eventsByUser.get(event.userId) ?? 0) + 1);
      const seen = lastSeenByUser.get(event.userId);
      if (!seen || event.createdAt > seen) {
        lastSeenByUser.set(event.userId, event.createdAt);
      }
    }

    const messagesByUser = new Map(
      messageCounts
        .filter((row) => row.userId)
        .map((row) => [row.userId as string, row._count._all]),
    );
    const tasksByUser = new Map(
      taskCounts
        .filter((row) => row.assigneeId)
        .map((row) => [row.assigneeId as string, row._count._all]),
    );

    const rows: UserAnalyticsRow[] = members.map((member) => {
      const user = member.user;
      const lastEvent = lastSeenByUser.get(user.id);
      const lastActive = lastEvent ?? member.lastSeenAt ?? null;
      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: member.role,
        events: eventsByUser.get(user.id) ?? 0,
        messages: messagesByUser.get(user.id) ?? 0,
        tasks: tasksByUser.get(user.id) ?? 0,
        lastActiveAt: lastActive ? lastActive.toISOString() : null,
      };
    });

    const activeIn = (from: Date) =>
      new Set(events.filter((e) => e.createdAt >= from).map((e) => e.userId))
        .size;

    const dau = activeIn(dayAgo);
    const mau = new Set(events.map((e) => e.userId)).size;

    return {
      rangeDays: days,
      totalEvents: events.length,
      activeUsers: mau,
      dau,
      wau: activeIn(weekAgo),
      mau,
      stickiness: mau === 0 ? 0 : Math.round((dau / mau) * 1000) / 10,
      activitySeries: toDailySeries(
        events.map((e) => e.createdAt),
        days,
      ),
      eventBreakdown: this.countBy(events.map((e) => e.eventType)),
      topUsers: rows
        .sort(
          (a, b) =>
            b.events + b.messages + b.tasks - (a.events + a.messages + a.tasks),
        )
        .slice(0, 25),
    };
  }

  // -------------------------------------------------------------------------
  // AI usage
  // -------------------------------------------------------------------------

  async getAIUsageStats(
    workspaceId: string,
    rawDays?: string | number,
  ): Promise<AIUsageStats> {
    const days = normaliseDays(rawDays);
    const since = startOfRange(days);

    const [
      totalSessions,
      agents,
      workflows,
      agentLogs,
      workflowRuns,
      windowSessions,
    ] = await this.prisma.$transaction([
      this.prisma.aIChatSession.count({ where: { workspaceId } }),
      this.prisma.aIAgent.findMany({
        where: { workspaceId },
        select: { id: true, name: true, isActive: true },
        take: 500,
      }),
      this.prisma.automationWorkflow.findMany({
        where: { workspaceId },
        select: { id: true, isActive: true },
        take: 500,
      }),
      this.prisma.agentExecutionLog.findMany({
        where: { agent: { workspaceId }, executedAt: { gte: since } },
        select: {
          agentId: true,
          status: true,
          tokensUsed: true,
          executedAt: true,
        },
        take: MAX_SCAN,
      }),
      this.prisma.workflowExecution.findMany({
        where: {
          workflow: { workspaceId },
          startedAt: { gte: since },
        },
        select: { status: true, startedAt: true, finishedAt: true },
        take: MAX_SCAN,
      }),
      this.prisma.aIChatSession.findMany({
        where: { workspaceId, createdAt: { gte: since } },
        select: { createdAt: true, messages: true },
        take: MAX_SCAN,
      }),
    ]);

    const agentNames = new Map(agents.map((a) => [a.id, a.name]));
    const successes = agentLogs.filter((l) => l.status === 'SUCCESS').length;
    const workflowSuccesses = workflowRuns.filter(
      (r) => r.status === 'SUCCESS',
    ).length;

    const workflowDurations = workflowRuns.map((run) =>
      Math.max(0, run.finishedAt.getTime() - run.startedAt.getTime()),
    );

    const byAgent = new Map<
      string,
      { executions: number; successes: number; tokens: number }
    >();
    for (const log of agentLogs) {
      const entry = byAgent.get(log.agentId) ?? {
        executions: 0,
        successes: 0,
        tokens: 0,
      };
      entry.executions += 1;
      if (log.status === 'SUCCESS') entry.successes += 1;
      entry.tokens += log.tokensUsed;
      byAgent.set(log.agentId, entry);
    }

    const loggedTokens = agentLogs.reduce((sum, l) => sum + l.tokensUsed, 0);
    // Chat sessions do not record token counts, so approximate from transcript
    // size using the usual ~4-characters-per-token rule of thumb.
    const chatTokens = windowSessions.reduce(
      (sum, s) => sum + Math.round((s.messages?.length ?? 0) / 4),
      0,
    );

    return {
      rangeDays: days,
      totalSessions,
      totalAgents: agents.length,
      activeAgents: agents.filter((a) => a.isActive).length,
      totalWorkflows: workflows.length,
      activeWorkflows: workflows.filter((w) => w.isActive).length,
      agentExecutions: agentLogs.length,
      agentSuccessRate:
        agentLogs.length === 0
          ? 0
          : Math.round((successes / agentLogs.length) * 1000) / 10,
      workflowExecutions: workflowRuns.length,
      workflowSuccessRate:
        workflowRuns.length === 0
          ? 0
          : Math.round((workflowSuccesses / workflowRuns.length) * 1000) / 10,
      avgWorkflowDurationMs:
        workflowDurations.length === 0
          ? 0
          : Math.round(
              workflowDurations.reduce((a, b) => a + b, 0) /
                workflowDurations.length,
            ),
      estimatedTokens: loggedTokens + chatTokens,
      usageSeries: toDailySeries(
        [
          ...agentLogs.map((l) => l.executedAt),
          ...workflowRuns.map((r) => r.startedAt),
          ...windowSessions.map((s) => s.createdAt),
        ],
        days,
      ),
      featureBreakdown: toBreakdown({
        'Chat sessions': windowSessions.length,
        'Agent runs': agentLogs.length,
        'Workflow runs': workflowRuns.length,
      }),
      topAgents: [...byAgent.entries()]
        .map(([agentId, stats]) => ({
          agentId,
          name: agentNames.get(agentId) ?? 'Deleted agent',
          executions: stats.executions,
          successRate:
            Math.round((stats.successes / stats.executions) * 1000) / 10,
          tokens: stats.tokens,
        }))
        .sort((a, b) => b.executions - a.executions)
        .slice(0, 10),
    };
  }

  // -------------------------------------------------------------------------
  // Storage analytics
  // -------------------------------------------------------------------------

  async getStorageAnalytics(
    workspaceId: string,
    rawDays?: string | number,
  ): Promise<StorageAnalytics> {
    const days = normaliseDays(rawDays);
    const since = startOfRange(days);

    const [uploads, largest, recent] = await this.prisma.$transaction([
      this.prisma.upload.findMany({
        where: { workspaceId },
        select: {
          size: true,
          mimeType: true,
          uploaderId: true,
          uploader: { select: { name: true } },
        },
        take: MAX_SCAN,
      }),
      this.prisma.upload.findMany({
        where: { workspaceId },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          size: true,
          createdAt: true,
        },
        orderBy: { size: 'desc' },
        take: 10,
      }),
      this.prisma.upload.findMany({
        where: { workspaceId, createdAt: { gte: since } },
        select: { createdAt: true },
        take: MAX_SCAN,
      }),
    ]);

    const totalBytes = uploads.reduce((sum, u) => sum + u.size, 0);
    const quotaBytes = Number(
      this.config.get<string>('ANALYTICS_STORAGE_QUOTA_BYTES') ??
        DEFAULT_QUOTA_BYTES,
    );

    const byType = new Map<string, number>();
    const byUploader = new Map<
      string,
      { name: string; files: number; bytes: number }
    >();

    for (const upload of uploads) {
      const group = mimeGroup(upload.mimeType);
      byType.set(group, (byType.get(group) ?? 0) + upload.size);

      const entry = byUploader.get(upload.uploaderId) ?? {
        name: upload.uploader?.name ?? 'Unknown',
        files: 0,
        bytes: 0,
      };
      entry.files += 1;
      entry.bytes += upload.size;
      byUploader.set(upload.uploaderId, entry);
    }

    return {
      totalBytes,
      totalFiles: uploads.length,
      quotaBytes,
      usedPct:
        quotaBytes <= 0 ? 0 : Math.round((totalBytes / quotaBytes) * 1000) / 10,
      byType: toBreakdown(byType),
      growthSeries: toDailySeries(
        recent.map((u) => u.createdAt),
        days,
      ),
      largestFiles: largest.map((file) => ({
        id: file.id,
        filename: file.filename,
        mimeType: file.mimeType,
        sizeBytes: file.size,
        createdAt: file.createdAt.toISOString(),
      })),
      topUploaders: [...byUploader.entries()]
        .map(([userId, entry]) => ({ userId, ...entry }))
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, 10),
    };
  }

  // -------------------------------------------------------------------------
  // Raw activity feed (kept for the events drill-down)
  // -------------------------------------------------------------------------

  async getUserActivity(workspaceId: string, rawDays?: string | number) {
    const days = normaliseDays(rawDays);
    return this.prisma.analyticsEvent.findMany({
      where: { workspaceId, createdAt: { gte: startOfRange(days) } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  /** Event-type counts, with error events labelled for the breakdown chart. */
  private countBy(values: string[]) {
    const counts = new Map<string, number>();
    for (const value of values) {
      const label = value === ERROR_EVENT_TYPE ? 'Errors' : value;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return toBreakdown(counts);
  }
}

/** `image/png` → `image`; keeps the storage chart to a handful of slices. */
function mimeGroup(mimeType: string): string {
  const [type = 'other', subtype = ''] = mimeType.split('/');
  if (type === 'application') {
    if (subtype.includes('pdf')) return 'document';
    if (/zip|tar|gzip|rar|7z/.test(subtype)) return 'archive';
    return 'application';
  }
  return type || 'other';
}
