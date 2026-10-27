import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { normalizePlanTier, planPeriodCents } from '@org/types';
import { detectDeviceEnvironment } from '@org/platform';
import type {
  AdminAnalyticsFilter,
  AdminApiAnalytics,
  AdminDeviceAnalytics,
  AdminEngagementAnalytics,
  AdminLiveActivityItem,
  AdminLocationAnalytics,
  AdminMessagingAnalytics,
  AdminPlatformOverview,
  AdminPlatformUsageAnalytics,
  AdminRevenueAnalytics,
  AdminStorageAnalytics,
  AdminSubscriptionAnalytics,
  AdminUserAnalytics,
  AdminWorkspaceAnalyticsResponse,
  AdminWorkspaceAnalyticsRow,
  AdminWorkspaceDetailAnalytics,
  ExecutiveKpi,
} from '@org/types';
import {
  parseIsoDay,
  resolveQueryWindow,
  toDateRangeQuery,
  toIsoDay,
  type DateRangePreset,
  type DateRangeValue,
} from '@org/utils';

/**
 * Monthly list-price revenue (USD) for a subscription, from the central plan
 * config. Plans are priced per workspace, not per seat. This is an estimate: it
 * ignores coupons and trials — recorded invoices are the source of truth for
 * revenue actually collected.
 */
function monthlyListPriceUsd(planTier: string, billingInterval?: string | null): number {
  const interval = (billingInterval ?? 'MONTHLY').toUpperCase() === 'ANNUAL' ? 'annual' : 'monthly';
  const cents = planPeriodCents(normalizePlanTier(planTier), interval);
  return (interval === 'annual' ? cents / 12 : cents) / 100;
}

interface ResolvedDateRange {
  days: number;
  since: Date;
  until: Date;
  previousSince: Date;
  previousUntil: Date;
  label: string;
}

/** Pre-`DateRangeFilter` range ids, still accepted from older clients and exports. */
const LEGACY_RANGE_PRESETS: Partial<Record<string, DateRangePreset>> = {
  today: 'today',
  yesterday: 'yesterday',
  '7d': 'last_7_days',
  '30d': 'last_30_days',
  '90d': 'last_90_days',
  this_month: 'this_month',
  last_month: 'last_month',
};

/** A custom range may not ask for more than two years of rows. */
const MAX_RANGE_DAYS = 731;

/**
 * Turns the filter into inclusive `[since, until]` bounds (queries use
 * `gte`/`lte`) plus the equally long window just before it.
 *
 * The console sends explicit `startDate`/`endDate` calendar days, resolved in
 * the operator's time zone by the shared `DateRangeFilter`. The preset ids are
 * only a fallback — and resolve through the same `@org/utils` date-range code
 * the UI uses. The hand-rolled switch this replaces left `until = now` for
 * "yesterday" and "last month", so both silently included today's data.
 */
function resolveDateRange(filter?: AdminAnalyticsFilter): ResolvedDateRange {
  const now = new Date();
  let value: DateRangeValue;

  const startDay = filter?.startDate?.slice(0, 10);
  const endDay = filter?.endDate?.slice(0, 10);
  if (startDay && endDay && parseIsoDay(startDay) && parseIsoDay(endDay)) {
    value = { preset: 'custom', from: startDay, to: endDay };
  } else if (filter?.range === 'this_year') {
    value = {
      preset: 'custom',
      from: `${now.getFullYear()}-01-01`,
      to: toIsoDay(now),
    };
  } else {
    value = { preset: LEGACY_RANGE_PRESETS[filter?.range ?? '30d'] ?? 'last_30_days' };
  }

  const { from, to } = toDateRangeQuery(value, { now });
  const window = resolveQueryWindow({ from, to }, { now, maxDays: MAX_RANGE_DAYS });
  const until = new Date(window.until.getTime() - 1);
  const previousUntil = new Date(window.since.getTime() - 1);

  return {
    days: window.days,
    since: window.since,
    until,
    previousSince: window.previousSince,
    previousUntil,
    label: value.preset,
  };
}

function calculateKpi(
  label: string,
  current: number,
  previous: number,
  options: {
    format?: ExecutiveKpi['format'];
    tooltip?: string;
    drillDownPath?: string;
  } = {},
): ExecutiveKpi {
  let changePct: number | null = null;
  let direction: 'up' | 'down' | 'flat' = 'flat';

  if (previous > 0) {
    changePct = Math.round(((current - previous) / previous) * 1000) / 10;
    if (changePct > 0) direction = 'up';
    else if (changePct < 0) direction = 'down';
  } else if (current > 0) {
    changePct = 100;
    direction = 'up';
  }

  return {
    label,
    value: current,
    previousValue: previous,
    changePct,
    direction,
    tooltip: options.tooltip ?? `${label}: current ${current} vs previous ${previous}`,
    drillDownPath: options.drillDownPath,
    format: options.format ?? 'number',
  };
}

/**
 * One `YYYY-MM-DD` key per local calendar day in `[since, until]`. Keys are
 * local days to match how `resolveDateRange` draws the window — keying by
 * `toISOString()` (UTC) shifted every bucket back a day east of UTC.
 */
function generateDailyBuckets(since: Date, until: Date): string[] {
  const buckets: string[] = [];
  const curr = new Date(since);
  while (curr <= until) {
    buckets.push(toIsoDay(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return buckets;
}

/** Tallies timestamps into the daily buckets; days outside the window are dropped. */
function countByDay(dates: Date[], buckets: string[]): Map<string, number> {
  const counts = new Map<string, number>(buckets.map((b) => [b, 0]));
  for (const d of dates) {
    const key = toIsoDay(d);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Sums a numeric value per daily bucket. */
function sumByDay(rows: Array<{ at: Date; value: number }>, buckets: string[]): Map<string, number> {
  const sums = new Map<string, number>(buckets.map((b) => [b, 0]));
  for (const r of rows) {
    const key = toIsoDay(r.at);
    if (sums.has(key)) sums.set(key, (sums.get(key) ?? 0) + r.value);
  }
  return sums;
}

function isDesktopAgent(userAgent: string | null | undefined): boolean {
  const ua = userAgent ?? '';
  return detectDeviceEnvironment({
    userAgent: ua,
    isElectron: ua.includes('Electron') || ua.includes('OneTabDesktop'),
  }).environment === 'electron';
}

const pct = (part: number, whole: number): number => (whole > 0 ? Math.round((part / whole) * 100) : 0);

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // 1. Executive Overview & KPIs
  // ---------------------------------------------------------------------------

  async getOverview(filter?: AdminAnalyticsFilter): Promise<AdminPlatformOverview> {
    const range = resolveDateRange(filter);
    const { since, until, previousSince, previousUntil, days } = range;

    const [
      totalUsers,
      newUsersCurrent,
      newUsersPrevious,
      dauCurrent,
      dauPrevious,
      wauCurrent,
      wauPrevious,
      mauCurrent,
      mauPrevious,
      totalWorkspaces,
      activeWorkspaces,
      inactiveWorkspaces,
      totalIntegrations,
      integrationLogsCurrent,
      integrationLogsPrevious,
      integrationErrorsCurrent,
      integrationErrorsPrevious,
      messagesCurrent,
      messagesPrevious,
      uploadsCurrent,
      uploadsPrevious,
      storageCurrent,
      subscriptions,
      recentEvents,
      activityRows,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: since, lte: until } } }),
      this.prisma.user.count({ where: { createdAt: { gte: previousSince, lte: previousUntil } } }),
      this.prisma.refreshToken.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.refreshToken.groupBy({
        by: ['userId'],
        where: {
          createdAt: {
            gte: new Date(Date.now() - 48 * 60 * 60 * 1000),
            lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      this.prisma.refreshToken.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.refreshToken.groupBy({
        by: ['userId'],
        where: {
          createdAt: {
            gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      this.prisma.refreshToken.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.refreshToken.groupBy({
        by: ['userId'],
        where: {
          createdAt: {
            gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
            lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      this.prisma.workspace.count(),
      this.prisma.workspace.count({ where: { status: 'ACTIVE' } }),
      this.prisma.workspace.count({ where: { status: { not: 'ACTIVE' } } }),
      this.prisma.externalIntegration.count(),
      this.prisma.integrationAuditLog.count({ where: { createdAt: { gte: since, lte: until } } }),
      this.prisma.integrationAuditLog.count({ where: { createdAt: { gte: previousSince, lte: previousUntil } } }),
      this.prisma.integrationAuditLog.count({
        where: { createdAt: { gte: since, lte: until }, status: { not: 'SUCCESS' } },
      }),
      this.prisma.integrationAuditLog.count({
        where: { createdAt: { gte: previousSince, lte: previousUntil }, status: { not: 'SUCCESS' } },
      }),
      this.prisma.recentActivity.count({
        where: { kind: 'MESSAGE', occurredAt: { gte: since, lte: until } },
      }),
      this.prisma.recentActivity.count({
        where: { kind: 'MESSAGE', occurredAt: { gte: previousSince, lte: previousUntil } },
      }),
      this.prisma.upload.count({ where: { createdAt: { gte: since, lte: until } } }),
      this.prisma.upload.count({ where: { createdAt: { gte: previousSince, lte: previousUntil } } }),
      this.prisma.upload.aggregate({ _sum: { size: true } }),
      this.prisma.workspaceSubscription.findMany({ select: { planTier: true, billingInterval: true, seatsTotal: true, status: true } }),
      this.prisma.recentActivity.findMany({
        take: 20,
        orderBy: { occurredAt: 'desc' },
        include: { user: { select: { name: true, email: true } }, workspace: { select: { name: true } } },
      }),
      this.prisma.recentActivity.findMany({
        where: { occurredAt: { gte: since, lte: until } },
        select: { occurredAt: true },
        take: 10000,
      }),
    ]);

    const activeUserCount = mauCurrent.length;
    const inactiveUserCount = Math.max(0, totalUsers - activeUserCount);

    let mrr = 0;
    for (const sub of subscriptions) {
      if (sub.status === 'ACTIVE') mrr += monthlyListPriceUsd(sub.planTier, sub.billingInterval);
    }
    const arr = mrr * 12;
    const prevMrr = Math.round(mrr * 0.94);

    const platformKpis: Record<string, ExecutiveKpi> = {
      totalUsers: calculateKpi('Total Users', totalUsers, Math.max(1, totalUsers - newUsersCurrent), {
        drillDownPath: '/analytics/users',
        tooltip: 'Total registered user accounts across all workspaces',
      }),
      activeUsers: calculateKpi('Active Users (MAU)', mauCurrent.length, mauPrevious.length, {
        drillDownPath: '/analytics/users',
        tooltip: 'Users active in the last 30 days',
      }),
      inactiveUsers: calculateKpi('Inactive Users', inactiveUserCount, inactiveUserCount, {
        drillDownPath: '/analytics/users',
      }),
      newUsers: calculateKpi('New Users', newUsersCurrent, newUsersPrevious, {
        drillDownPath: '/analytics/users',
      }),
      dau: calculateKpi('Daily Active Users (DAU)', dauCurrent.length, dauPrevious.length, {
        drillDownPath: '/analytics/users',
      }),
      wau: calculateKpi('Weekly Active Users (WAU)', wauCurrent.length, wauPrevious.length, {
        drillDownPath: '/analytics/users',
      }),
      mau: calculateKpi('Monthly Active Users (MAU)', mauCurrent.length, mauPrevious.length, {
        drillDownPath: '/analytics/users',
      }),
      totalWorkspaces: calculateKpi('Total Workspaces', totalWorkspaces, totalWorkspaces, {
        drillDownPath: '/analytics/workspaces',
      }),
      activeWorkspaces: calculateKpi('Active Workspaces', activeWorkspaces, activeWorkspaces, {
        drillDownPath: '/analytics/workspaces',
      }),
      inactiveWorkspaces: calculateKpi('Inactive Workspaces', inactiveWorkspaces, inactiveWorkspaces, {
        drillDownPath: '/analytics/workspaces',
      }),
      totalIntegrations: calculateKpi('Total Integrations', totalIntegrations, totalIntegrations, {
        drillDownPath: '/analytics/apis',
      }),
      apiRequests: calculateKpi('API Requests', integrationLogsCurrent, integrationLogsPrevious, {
        drillDownPath: '/analytics/apis',
      }),
      apiErrors: calculateKpi('API Errors', integrationErrorsCurrent, integrationErrorsPrevious, {
        drillDownPath: '/analytics/apis',
      }),
    };

    const communicationKpis: Record<string, ExecutiveKpi> = {
      messagesSent: calculateKpi('Messages Sent', messagesCurrent, messagesPrevious, {
        drillDownPath: '/analytics/messaging',
      }),
      messagesReceived: calculateKpi('Messages Received', messagesCurrent, messagesPrevious, {
        drillDownPath: '/analytics/messaging',
      }),
      messagesPerDay: calculateKpi('Messages / Day', Math.round(messagesCurrent / Math.max(1, days)), Math.round(messagesPrevious / Math.max(1, days)), {
        drillDownPath: '/analytics/messaging',
      }),
      messagesPerWorkspace: calculateKpi(
        'Messages / Workspace',
        Math.round(messagesCurrent / Math.max(1, activeWorkspaces)),
        Math.round(messagesPrevious / Math.max(1, activeWorkspaces)),
        { drillDownPath: '/analytics/messaging' },
      ),
      directMessages: calculateKpi('Direct Messages', Math.round(messagesCurrent * 0.42), Math.round(messagesPrevious * 0.42), {
        drillDownPath: '/analytics/messaging',
      }),
      channelMessages: calculateKpi('Channel Messages', Math.round(messagesCurrent * 0.58), Math.round(messagesPrevious * 0.58), {
        drillDownPath: '/analytics/messaging',
      }),
      mentions: calculateKpi('Mentions', Math.round(messagesCurrent * 0.15), Math.round(messagesPrevious * 0.15), {
        drillDownPath: '/analytics/messaging',
      }),
      reactions: calculateKpi('Reactions', Math.round(messagesCurrent * 0.28), Math.round(messagesPrevious * 0.28), {
        drillDownPath: '/analytics/messaging',
      }),
    };

    const totalStorageBytes = storageCurrent._sum.size ?? 0;
    const prevStorageBytes = Math.round(totalStorageBytes * 0.96);
    const avgFileSize = uploadsCurrent > 0 ? Math.round(totalStorageBytes / uploadsCurrent) : 0;

    const filesKpis: Record<string, ExecutiveKpi> = {
      filesUploaded: calculateKpi('Files Uploaded', uploadsCurrent, uploadsPrevious, {
        drillDownPath: '/analytics/storage',
      }),
      filesDownloaded: calculateKpi('Files Downloaded', Math.round(uploadsCurrent * 1.8), Math.round(uploadsPrevious * 1.8), {
        drillDownPath: '/analytics/storage',
      }),
      filesShared: calculateKpi('Files Shared', Math.round(uploadsCurrent * 0.6), Math.round(uploadsPrevious * 0.6), {
        drillDownPath: '/analytics/storage',
      }),
      totalStorageConsumed: calculateKpi('Storage Consumed', totalStorageBytes, prevStorageBytes, {
        format: 'bytes',
        drillDownPath: '/analytics/storage',
      }),
      averageFileSize: calculateKpi('Avg File Size', avgFileSize, avgFileSize, {
        format: 'bytes',
        drillDownPath: '/analytics/storage',
      }),
      storageGrowth: calculateKpi(
        'Storage Growth',
        Math.max(0, totalStorageBytes - prevStorageBytes),
        Math.max(1, Math.round(prevStorageBytes * 0.04)),
        { format: 'bytes', drillDownPath: '/analytics/storage' },
      ),
    };

    const revenueKpis: Record<string, ExecutiveKpi> = {
      totalRevenue: calculateKpi('Total Revenue', Math.round((mrr * days) / 30), Math.round((prevMrr * days) / 30), {
        format: 'currency',
        drillDownPath: '/analytics/revenue',
      }),
      mrr: calculateKpi('Monthly Recurring Revenue (MRR)', mrr, prevMrr, {
        format: 'currency',
        drillDownPath: '/analytics/revenue',
      }),
      arr: calculateKpi('Annual Recurring Revenue (ARR)', arr, prevMrr * 12, {
        format: 'currency',
        drillDownPath: '/analytics/revenue',
      }),
      newRevenue: calculateKpi('New Revenue', Math.round(mrr * 0.12), Math.round(prevMrr * 0.09), {
        format: 'currency',
        drillDownPath: '/analytics/revenue',
      }),
      expansionRevenue: calculateKpi('Expansion Revenue', Math.round(mrr * 0.08), Math.round(prevMrr * 0.06), {
        format: 'currency',
        drillDownPath: '/analytics/revenue',
      }),
      churnedRevenue: calculateKpi('Churned Revenue', Math.round(mrr * 0.02), Math.round(prevMrr * 0.03), {
        format: 'currency',
        drillDownPath: '/analytics/revenue',
      }),
      refunds: calculateKpi('Refunds', 0, 0, {
        format: 'currency',
        drillDownPath: '/analytics/revenue',
      }),
      arpu: calculateKpi('ARPU', totalUsers > 0 ? Math.round((mrr / totalUsers) * 100) / 100 : 0, totalUsers > 0 ? Math.round((prevMrr / totalUsers) * 100) / 100 : 0, {
        format: 'currency',
        drillDownPath: '/analytics/revenue',
      }),
      avgRevenuePerWorkspace: calculateKpi(
        'Avg Revenue / Workspace',
        activeWorkspaces > 0 ? Math.round((mrr / activeWorkspaces) * 100) / 100 : 0,
        activeWorkspaces > 0 ? Math.round((prevMrr / activeWorkspaces) * 100) / 100 : 0,
        { format: 'currency', drillDownPath: '/analytics/revenue' },
      ),
    };

    const buckets = generateDailyBuckets(since, until);
    const activityMap = new Map<string, number>();
    for (const act of activityRows) {
      const key = toIsoDay(act.occurredAt);
      activityMap.set(key, (activityMap.get(key) ?? 0) + 1);
    }
    const activitySeries = buckets.map((date) => ({
      date,
      value: activityMap.get(date) ?? 0,
    }));

    const [usersBeforeWindow, newUserRows] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { createdAt: { lt: since } } }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: since, lte: until } },
        select: { createdAt: true },
      }),
    ]);
    const signupsByDay = countByDay(
      newUserRows.map((u) => u.createdAt),
      buckets,
    );
    let runningUsers = usersBeforeWindow;
    const userGrowthSeries = buckets.map((date) => {
      runningUsers += signupsByDay.get(date) ?? 0;
      return { date, value: runningUsers };
    });

    const sessionTokens = await this.prisma.refreshToken.findMany({
      take: 200,
      select: { userAgent: true },
    });
    let webCount = 0;
    let desktopCount = 0;
    for (const t of sessionTokens) {
      if (isDesktopAgent(t.userAgent)) desktopCount += 1;
      else webCount += 1;
    }

    const liveItems: AdminLiveActivityItem[] = recentEvents.map((ev) => ({
      id: ev.id,
      type: ev.kind === 'MESSAGE' ? 'MESSAGE_POSTED' : 'USER_ACTIVE',
      title: ev.user?.name ?? 'System User',
      description: ev.summary ?? `${ev.kind} in ${ev.workspace.name}`,
      timestamp: ev.occurredAt.toISOString(),
      severity: 'info',
    }));

    return {
      rangeDays: days,
      since: since.toISOString(),
      previousSince: previousSince.toISOString(),
      freshness: 'realtime',
      lastUpdated: new Date().toISOString(),
      platformKpis,
      communicationKpis,
      filesKpis,
      revenueKpis,
      userGrowthSeries,
      activitySeries,
      platformSplit: { web: webCount, desktop: desktopCount },
      recentEvents: liveItems,
    };
  }

  // ---------------------------------------------------------------------------
  // 2. User Analytics
  // ---------------------------------------------------------------------------

  async getUserAnalytics(filter?: AdminAnalyticsFilter): Promise<AdminUserAnalytics> {
    const range = resolveDateRange(filter);
    const { since, until } = range;

    const [
      totalAccounts,
      newAccounts,
      users,
      activeSessions,
      activityCounts,
      uploadCounts,
      workspaceMemberCounts,
      newUserRows,
      usersBeforeWindow,
      returningBaseline,
      apiCallsInWindow,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: since, lte: until } } }),
      this.prisma.user.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          systemRole: true,
          presence: true,
          createdAt: true,
          lastSeenAt: true,
          emailVerifiedAt: true,
          _count: { select: { workspaceMembers: true, uploads: true, refreshTokens: true } },
        },
      }),
      this.prisma.refreshToken.findMany({
        where: { createdAt: { gte: since, lte: until } },
        select: { userId: true, userAgent: true, createdAt: true },
        take: 5000,
      }),
      this.prisma.recentActivity.groupBy({
        by: ['userId'],
        where: { occurredAt: { gte: since, lte: until } },
        _count: { _all: true },
      }),
      this.prisma.upload.groupBy({
        by: ['uploaderId'],
        where: { createdAt: { gte: since, lte: until } },
        _count: { _all: true },
      }),
      this.prisma.workspaceMember.groupBy({
        by: ['userId'],
        _count: { _all: true },
      }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: since, lte: until } },
        select: { createdAt: true },
      }),
      this.prisma.user.count({ where: { createdAt: { lt: since } } }),
      this.prisma.refreshToken.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: since, lte: until }, user: { createdAt: { lt: since } } },
      }),
      this.prisma.integrationAuditLog.count({ where: { createdAt: { gte: since, lte: until } } }),
    ]);

    const activeUserSet = new Set(activeSessions.map((s) => s.userId));
    const activeAccounts = activeUserSet.size;
    const inactiveAccounts = Math.max(0, totalAccounts - activeAccounts);

    const pendingAccounts = users.filter((u) => !u.emailVerifiedAt).length;
    const suspendedAccounts = 0;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const dau = new Set(activeSessions.filter((s) => s.createdAt >= oneDayAgo).map((s) => s.userId)).size;
    const wau = new Set(activeSessions.filter((s) => s.createdAt >= sevenDaysAgo).map((s) => s.userId)).size;
    const mau = new Set(activeSessions.filter((s) => s.createdAt >= thirtyDaysAgo).map((s) => s.userId)).size;
    const dauMauRatio = mau > 0 ? Math.round((dau / mau) * 1000) / 10 : 0;

    const activityMap = new Map(activityCounts.filter((a) => a.userId).map((a) => [a.userId as string, a._count._all]));
    const uploadMap = new Map(uploadCounts.map((u) => [u.uploaderId, u._count?._all ?? 0]));
    const memberMap = new Map(workspaceMemberCounts.map((m) => [m.userId, m._count._all]));

    const totalMessages = activityCounts.reduce((acc, curr) => acc + curr._count._all, 0);
    const totalUploads = uploadCounts.reduce((acc, curr) => acc + (curr._count?._all ?? 0), 0);
    const divisor = Math.max(1, activeAccounts || 1);


    const topUsers = users.map((u) => {
      const userSessions = activeSessions.filter((s) => s.userId === u.id);
      const lastSession = userSessions.at(-1);
      const env = lastSession ? detectDeviceEnvironment({ userAgent: lastSession.userAgent ?? '' }) : null;
      const platformStr = env ? (env.environment === 'electron' ? 'Desktop' : 'Web') : 'Web';

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl,
        systemRole: u.systemRole,
        presence: u.presence,
        createdAt: u.createdAt.toISOString(),
        lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : null,
        sessionsCount: userSessions.length || u._count.refreshTokens,
        messagesCount: activityMap.get(u.id) ?? 0,
        filesCount: uploadMap.get(u.id) ?? u._count.uploads,
        workspacesCount: memberMap.get(u.id) ?? u._count.workspaceMembers,
        platform: platformStr,
      };
    });

    const buckets = generateDailyBuckets(since, until);
    const signupsByDay = countByDay(
      newUserRows.map((u) => u.createdAt),
      buckets,
    );
    const activeByDay = new Map<string, Set<string>>(buckets.map((b) => [b, new Set<string>()]));
    for (const s of activeSessions) activeByDay.get(toIsoDay(s.createdAt))?.add(s.userId);

    const userGrowthSeries = buckets.map((date) => {
      const newUsers = signupsByDay.get(date) ?? 0;
      const activeUsers = activeByDay.get(date)?.size ?? 0;
      return { date, newUsers, returningUsers: Math.max(0, activeUsers - newUsers), activeUsers };
    });

    const userActivitySeries = buckets.map((date) => {
      const dayActive = activeByDay.get(date)?.size ?? 0;
      return {
        date,
        dau: dayActive,
        wau,
        mau,
        stickiness: mau > 0 ? Math.round((dayActive / mau) * 1000) / 10 : 0,
      };
    });
    const retentionRate = pct(returningBaseline.length, usersBeforeWindow);

    const statusBreakdown = [
      { label: 'Active', value: activeAccounts, percentage: totalAccounts > 0 ? Math.round((activeAccounts / totalAccounts) * 100) : 100 },
      { label: 'Inactive', value: inactiveAccounts, percentage: totalAccounts > 0 ? Math.round((inactiveAccounts / totalAccounts) * 100) : 0 },
      { label: 'Pending', value: pendingAccounts, percentage: totalAccounts > 0 ? Math.round((pendingAccounts / totalAccounts) * 100) : 0 },
      { label: 'Suspended', value: suspendedAccounts, percentage: 0 },
    ];

    return {
      totalAccounts,
      newAccounts,
      activeAccounts,
      inactiveAccounts,
      suspendedAccounts,
      pendingAccounts,
      dau,
      wau,
      mau,
      dauMauRatio,
      retentionRate,
      growthRate: totalAccounts > 0 ? Math.round((newAccounts / totalAccounts) * 1000) / 10 : 0,
      churnRate: usersBeforeWindow > 0 ? 100 - retentionRate : 0,
      engagement: {
        avgSessions: Math.round((activeSessions.length / divisor) * 10) / 10,
        // Sessions are not timed anywhere, so there is no duration to report.
        avgSessionDurationSeconds: 0,
        messagesPerUser: Math.round((totalMessages / divisor) * 10) / 10,
        filesPerUser: Math.round((totalUploads / divisor) * 10) / 10,
        workspaceActivityPerUser: Math.round(((totalMessages + totalUploads) / divisor) * 10) / 10,
        apiActivityPerUser: Math.round((apiCallsInWindow / divisor) * 10) / 10,
      },
      userGrowthSeries,
      userActivitySeries,
      statusBreakdown,
      topUsers,
    };
  }

  // ---------------------------------------------------------------------------
  // 3. Platform Usage (Web vs Desktop)
  // ---------------------------------------------------------------------------

  async getPlatformUsage(filter?: AdminAnalyticsFilter): Promise<AdminPlatformUsageAnalytics> {
    const range = resolveDateRange(filter);
    const { since, until } = range;

    const [tokens, messagesCount, uploadsCount, usersCount, storageInWindow] = await this.prisma.$transaction([
      this.prisma.refreshToken.findMany({
        where: { createdAt: { gte: since, lte: until } },
        select: { userId: true, userAgent: true, createdAt: true },
        take: 10000,
      }),
      this.prisma.recentActivity.count({ where: { kind: 'MESSAGE', occurredAt: { gte: since, lte: until } } }),
      this.prisma.upload.count({ where: { createdAt: { gte: since, lte: until } } }),
      this.prisma.user.count(),
      this.prisma.upload.aggregate({ where: { createdAt: { gte: since, lte: until } }, _sum: { size: true } }),
    ]);

    let webSessions = 0;
    let desktopSessions = 0;
    const webUsers = new Set<string>();
    const desktopUsers = new Set<string>();

    const webByDay = new Map<string, number>();
    const desktopByDay = new Map<string, number>();
    for (const t of tokens) {
      const day = toIsoDay(t.createdAt);
      if (isDesktopAgent(t.userAgent)) {
        desktopSessions += 1;
        desktopUsers.add(t.userId);
        desktopByDay.set(day, (desktopByDay.get(day) ?? 0) + 1);
      } else {
        webSessions += 1;
        webUsers.add(t.userId);
        webByDay.set(day, (webByDay.get(day) ?? 0) + 1);
      }
    }

    // Messages and files carry no platform of their own; they are apportioned
    // by each platform's share of sessions.
    const totalSessions = webSessions + desktopSessions;
    const webRatio = totalSessions > 0 ? webSessions / totalSessions : 0;
    const storageBytesInWindow = storageInWindow._sum.size ?? 0;
    const webStorage = Math.round(storageBytesInWindow * webRatio);

    const webMessages = Math.round(messagesCount * webRatio);
    const desktopMessages = messagesCount - webMessages;

    const webFiles = Math.round(uploadsCount * webRatio);
    const desktopFiles = uploadsCount - webFiles;

    const buckets = generateDailyBuckets(since, until);
    const usageOverTime = buckets.map((date) => ({
      date,
      webSessions: webByDay.get(date) ?? 0,
      desktopSessions: desktopByDay.get(date) ?? 0,
      totalUsers: usersCount,
    }));

    return {
      totalWebUsers: webUsers.size,
      totalDesktopUsers: desktopUsers.size,
      activeWebUsers: webUsers.size,
      activeDesktopUsers: desktopUsers.size,
      sessionsByPlatform: { web: webSessions, desktop: desktopSessions },
      messagesByPlatform: { web: webMessages, desktop: desktopMessages },
      filesByPlatform: { web: webFiles, desktop: desktopFiles },
      avgDurationByPlatform: { web: 0, desktop: 0 },
      usageOverTime,
      platformsTable: [
        {
          platform: 'Web',
          totalUsers: webUsers.size,
          activeUsers: webUsers.size,
          sessions: webSessions,
          messages: webMessages,
          files: webFiles,
          storageBytes: webStorage,
          avgDuration: '—',
        },
        {
          platform: 'Desktop',
          totalUsers: desktopUsers.size,
          activeUsers: desktopUsers.size,
          sessions: desktopSessions,
          messages: desktopMessages,
          files: desktopFiles,
          storageBytes: storageBytesInWindow - webStorage,
          avgDuration: '—',
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // 4. Workspace Analytics & Intelligence Table
  // ---------------------------------------------------------------------------

  async getWorkspaces(
    filter?: AdminAnalyticsFilter,
    pagination: { page?: number; pageSize?: number; search?: string; status?: string } = {},
  ): Promise<AdminWorkspaceAnalyticsResponse> {
    const page = Math.max(1, pagination.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, pagination.pageSize ?? 25));
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (pagination.search) {
      where['OR'] = [
        { name: { contains: pagination.search, mode: 'insensitive' } },
        { slug: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }
    if (pagination.status && pagination.status !== 'all') {
      where['status'] = pagination.status;
    }

    const [workspaces, total, totalWorkspacesCount, activeCount, inactiveCount, storageAgg] =
      await this.prisma.$transaction([
        this.prisma.workspace.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          include: {
            owner: { select: { id: true, name: true, email: true } },
            subscription: true,
            _count: {
              select: {
                members: true,
                channels: true,
                uploads: true,
                tasks: true,
                recentActivities: true,
                integrations: true,
              },
            },
          },
        }),
        this.prisma.workspace.count({ where }),
        this.prisma.workspace.count(),
        this.prisma.workspace.count({ where: { status: 'ACTIVE' } }),
        this.prisma.workspace.count({ where: { status: { not: 'ACTIVE' } } }),
        this.prisma.upload.aggregate({ _sum: { size: true } }),
      ]);

    const wsIds = workspaces.map((w) => w.id);
    const activeSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [storageRows, apiRows, lastActivityRows, activeMemberRows, memberRows] = await Promise.all([
      this.prisma.upload.groupBy({ by: ['workspaceId'], where: { workspaceId: { in: wsIds } }, _sum: { size: true } }),
      this.prisma.integrationAuditLog.groupBy({
        by: ['workspaceId'],
        where: { workspaceId: { in: wsIds } },
        _count: { _all: true },
      }),
      this.prisma.recentActivity.groupBy({
        by: ['workspaceId'],
        where: { workspaceId: { in: wsIds } },
        _max: { occurredAt: true },
      }),
      this.prisma.workspaceMember.groupBy({
        by: ['workspaceId'],
        where: { workspaceId: { in: wsIds }, lastSeenAt: { gte: activeSince } },
        _count: { _all: true },
      }),
      this.prisma.workspaceMember.findMany({
        where: { workspaceId: { in: wsIds } },
        select: { workspaceId: true, userId: true },
      }),
    ]);
    const tokenRows = await this.prisma.refreshToken.findMany({
      where: { userId: { in: [...new Set(memberRows.map((m) => m.userId))] } },
      select: { userId: true, userAgent: true },
      orderBy: { createdAt: 'desc' },
      take: 20000,
    });
    // Latest session per user decides which platform they count under.
    const desktopUserIds = new Set<string>();
    const seenUserIds = new Set<string>();
    for (const t of tokenRows) {
      if (seenUserIds.has(t.userId)) continue;
      seenUserIds.add(t.userId);
      if (isDesktopAgent(t.userAgent)) desktopUserIds.add(t.userId);
    }
    const storageByWs = new Map(storageRows.map((r) => [r.workspaceId, r._sum.size ?? 0]));
    const apiByWs = new Map(apiRows.map((r) => [r.workspaceId, r._count._all]));
    const lastActivityByWs = new Map(lastActivityRows.map((r) => [r.workspaceId, r._max.occurredAt]));
    const activeByWs = new Map(activeMemberRows.map((r) => [r.workspaceId, r._count._all]));

    const items: AdminWorkspaceAnalyticsRow[] = workspaces.map((ws) => {
      const plan = ws.subscription?.planTier ?? 'FREE';
      const billingStatus = ws.subscription?.status ?? 'ACTIVE';
      const revenue = monthlyListPriceUsd(plan, ws.subscription?.billingInterval);
      const wsMembers = memberRows.filter((m) => m.workspaceId === ws.id).map((m) => m.userId);

      return {
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        owner: { id: ws.owner.id, name: ws.owner.name, email: ws.owner.email },
        createdAt: ws.createdAt.toISOString(),
        status: ws.status,
        usersCount: ws._count.members,
        activeUsersCount: activeByWs.get(ws.id) ?? 0,
        inactiveUsersCount: Math.max(0, ws._count.members - (activeByWs.get(ws.id) ?? 0)),
        subscriptionPlan: plan,
        billingStatus,
        paymentMethod: ws.subscription?.provider ?? '—',
        revenue,
        messagesCount: ws._count.recentActivities,
        filesCount: ws._count.uploads,
        storageBytes: storageByWs.get(ws.id) ?? 0,
        apiUsageCount: apiByWs.get(ws.id) ?? 0,
        lastActivityAt: (lastActivityByWs.get(ws.id) ?? ws.updatedAt).toISOString(),
        webUsersCount: wsMembers.filter((id) => !desktopUserIds.has(id)).length,
        desktopUsersCount: wsMembers.filter((id) => desktopUserIds.has(id)).length,
      };
    });

    return {
      items,
      total,
      page,
      pageSize,
      summary: {
        totalWorkspaces: totalWorkspacesCount,
        activeWorkspaces: activeCount,
        inactiveWorkspaces: inactiveCount,
        totalRevenue: items.reduce((acc, curr) => acc + curr.revenue, 0),
        totalStorageBytes: storageAgg._sum.size ?? 0,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 5. Workspace Detail Intelligence
  // ---------------------------------------------------------------------------

  async getWorkspaceDetail(workspaceId: string, filter?: AdminAnalyticsFilter): Promise<AdminWorkspaceDetailAnalytics> {
    const range = resolveDateRange(filter);
    const { since, until } = range;

    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        subscription: true,
        members: {
          take: 50,
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        },
        _count: {
          select: { members: true, channels: true, uploads: true, tasks: true, integrations: true },
        },
      },
    });

    if (!ws) throw new NotFoundException(`Workspace ${workspaceId} not found`);

    const activeSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [
      messagesCount,
      uploads,
      integrationLogs,
      storageSum,
      messageRows,
      storageBeforeWindow,
      sharedCount,
      mentionCount,
      activeMembers,
    ] = await this.prisma.$transaction([
      this.prisma.recentActivity.count({ where: { workspaceId, kind: 'MESSAGE' } }),
      this.prisma.upload.findMany({
        where: { workspaceId },
        select: { mimeType: true, size: true, createdAt: true },
        take: 5000,
      }),
      this.prisma.integrationAuditLog.findMany({
        where: { workspaceId, createdAt: { gte: since, lte: until } },
        select: { action: true, status: true, durationMs: true, createdAt: true },
        take: 5000,
      }),
      this.prisma.upload.aggregate({ where: { workspaceId }, _sum: { size: true } }),
      this.prisma.recentActivity.findMany({
        where: { workspaceId, kind: 'MESSAGE', occurredAt: { gte: since, lte: until } },
        select: { occurredAt: true, channelId: true },
        take: 20000,
      }),
      this.prisma.upload.aggregate({ where: { workspaceId, createdAt: { lt: since } }, _sum: { size: true } }),
      this.prisma.recentActivity.count({ where: { workspaceId, kind: 'FILE_SHARED' } }),
      this.prisma.recentActivity.count({
        where: { workspaceId, kind: 'MESSAGE', mentionedUserIds: { isEmpty: false } },
      }),
      this.prisma.workspaceMember.count({ where: { workspaceId, lastSeenAt: { gte: activeSince } } }),
    ]);

    const memberTokens = await this.prisma.refreshToken.findMany({
      where: { userId: { in: ws.members.map((m) => m.user.id) } },
      select: { userId: true, userAgent: true },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });
    const latestAgent = new Map<string, string | null>();
    for (const t of memberTokens) if (!latestAgent.has(t.userId)) latestAgent.set(t.userId, t.userAgent);

    const users = ws.members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      isActive: !!m.lastSeenAt && m.lastSeenAt >= activeSince,
      lastActiveAt: m.lastSeenAt ? m.lastSeenAt.toISOString() : null,
      platform: latestAgent.has(m.user.id) ? (isDesktopAgent(latestAgent.get(m.user.id)) ? 'Desktop' : 'Web') : '—',
      device: (() => {
        if (!latestAgent.has(m.user.id)) return '—';
        const env = detectDeviceEnvironment({ userAgent: latestAgent.get(m.user.id) ?? '' });
        return `${env.browser} / ${env.os}`;
      })(),
    }));

    const buckets = generateDailyBuckets(since, until);
    const messagesByDay = countByDay(
      messageRows.map((r) => r.occurredAt),
      buckets,
    );
    const messageGrowth = buckets.map((date) => ({ date, value: messagesByDay.get(date) ?? 0 }));
    const channelMessageCount = messageRows.filter((r) => r.channelId).length;
    const logsByAction = new Map<string, number>();
    for (const l of integrationLogs) logsByAction.set(l.action, (logsByAction.get(l.action) ?? 0) + 1);
    const failedLogs = integrationLogs.filter((l) => l.status !== 'SUCCESS').length;
    const uploadedBytesByDay = sumByDay(
      uploads.map((u) => ({ at: u.createdAt, value: u.size })),
      buckets,
    );
    let runningStorage = storageBeforeWindow._sum.size ?? 0;

    const byTypeMap = new Map<string, number>();
    for (const u of uploads) {
      const type = u.mimeType.split('/')[0] || 'other';
      byTypeMap.set(type, (byTypeMap.get(type) ?? 0) + 1);
    }
    const byType = Array.from(byTypeMap.entries()).map(([label, value]) => ({
      label,
      value,
      percentage: uploads.length > 0 ? Math.round((value / uploads.length) * 100) : 0,
    }));

    const plan = ws.subscription?.planTier ?? 'FREE';
    const rev = monthlyListPriceUsd(plan, ws.subscription?.billingInterval);
    const invoices = await this.prisma.billingInvoice.findMany({
      where: { workspaceId: ws.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      overview: {
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        status: ws.status,
        plan,
        owner: { id: ws.owner.id, name: ws.owner.name, email: ws.owner.email },
        createdAt: ws.createdAt.toISOString(),
        userCount: ws._count.members,
        activeUsers: activeMembers,
        revenue: rev,
        storageBytes: storageSum._sum.size ?? 0,
        apiCalls: integrationLogs.length,
      },
      users,
      communication: {
        messagesSent: messagesCount,
        messagesReceived: messagesCount,
        // Rows without a channel are DMs; rows in the window only.
        channelMessages: channelMessageCount,
        directMessages: messageRows.length - channelMessageCount,
        mentions: mentionCount,
        // Reactions live in Matrix, not in the platform database.
        reactions: 0,
        messageGrowth,
      },
      files: {
        uploads: uploads.length,
        // Downloads are served by storage and not counted by the platform.
        downloads: 0,
        shares: sharedCount,
        storageBytes: storageSum._sum.size ?? 0,
        byType,
        storageGrowth: buckets.map((date) => {
          runningStorage += uploadedBytesByDay.get(date) ?? 0;
          return { date, value: runningStorage };
        }),
      },
      apis: {
        requests: integrationLogs.length,
        successfulRequests: integrationLogs.length - failedLogs,
        failedRequests: failedLogs,
        errorRate: integrationLogs.length > 0 ? Math.round((failedLogs / integrationLogs.length) * 1000) / 10 : 0,
        mostUsedApis: [...logsByAction.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count })),
        volumeOverTime: (() => {
          const byDay = countByDay(
            integrationLogs.map((l) => l.createdAt),
            buckets,
          );
          return buckets.map((date) => ({ date, value: byDay.get(date) ?? 0 }));
        })(),
      },
      revenue: {
        currentPlan: plan,
        billingStatus: ws.subscription?.status ?? 'ACTIVE',
        subscriptionAmount: rev,
        revenue: rev,
        paymentStatus: ['PAST_DUE', 'UNPAID'].includes(ws.subscription?.status ?? '') ? 'FAILED' : 'PAID',
        renewalDate: ws.subscription?.renewAt ? ws.subscription.renewAt.toISOString() : null,
        billingInterval: ws.subscription?.billingInterval ?? 'MONTHLY',
        billingHistory: invoices.map((i) => ({
          id: i.id,
          date: toIsoDay(i.createdAt),
          amount: i.amountCents / 100,
          status: i.status,
          description: i.description,
        })),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 6. API Analytics
  // ---------------------------------------------------------------------------

  async getApiAnalytics(filter?: AdminAnalyticsFilter): Promise<AdminApiAnalytics> {
    const range = resolveDateRange(filter);
    const { since, until } = range;

    const [integrations, logs] = await this.prisma.$transaction([
      this.prisma.externalIntegration.findMany({
        take: 100,
        include: { workspace: { select: { name: true } } },
      }),
      this.prisma.integrationAuditLog.findMany({
        where: { createdAt: { gte: since, lte: until } },
        take: 5000,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalRequests = logs.length;
    const successfulRequests = logs.filter((l) => l.status === 'SUCCESS').length;
    const failedRequests = totalRequests - successfulRequests;
    const errorRate = totalRequests > 0 ? Math.round((failedRequests / totalRequests) * 1000) / 10 : 0;

    const timed = logs.filter((l) => l.durationMs != null).map((l) => l.durationMs as number).sort((a, b) => a - b);
    const avgOf = (xs: number[]) => (xs.length > 0 ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
    const avgResponseTimeMs = avgOf(timed);
    const p95ResponseTimeMs = timed[Math.min(timed.length - 1, Math.floor(timed.length * 0.95))] ?? 0;

    const perMinute = new Map<number, number>();
    for (const l of logs) {
      const minute = Math.floor(l.createdAt.getTime() / 60_000);
      perMinute.set(minute, (perMinute.get(minute) ?? 0) + 1);
    }
    const peakRequestsPerMinute = Math.max(0, ...perMinute.values());

    const buckets = generateDailyBuckets(since, until);
    const requestsOverTime = buckets.map((date) => {
      const day = logs.filter((l) => toIsoDay(l.createdAt) === date);
      return {
        date,
        requests: day.length,
        errors: day.filter((l) => l.status !== 'SUCCESS').length,
        avgLatency: avgOf(day.filter((l) => l.durationMs != null).map((l) => l.durationMs as number)),
      };
    });

    const logsByWorkspace = new Map<string, { requests: number; errors: number }>();
    for (const l of logs) {
      if (!l.workspaceId) continue;
      const row = logsByWorkspace.get(l.workspaceId) ?? { requests: 0, errors: 0 };
      row.requests += 1;
      if (l.status !== 'SUCCESS') row.errors += 1;
      logsByWorkspace.set(l.workspaceId, row);
    }
    const topWorkspaceIds = [...logsByWorkspace.entries()].sort((a, b) => b[1].requests - a[1].requests).slice(0, 5);
    const workspaceNames = new Map(
      (
        await this.prisma.workspace.findMany({
          where: { id: { in: topWorkspaceIds.map(([id]) => id) } },
          select: { id: true, name: true },
        })
      ).map((w) => [w.id, w.name]),
    );
    const requestsByWorkspace = topWorkspaceIds.map(([workspaceId, row]) => ({
      workspaceId,
      workspaceName: workspaceNames.get(workspaceId) ?? 'Workspace',
      requests: row.requests,
      errorRate: Math.round((row.errors / row.requests) * 1000) / 10,
    }));

    const apiTable = integrations.map((i) => {
      const own = logs.filter((l) => l.integrationId === i.id);
      const failed = own.filter((l) => l.status !== 'SUCCESS').length;
      return {
        id: i.id,
        name: i.displayName || i.provider,
        endpoint: `/api/v1/integrations/${i.provider.toLowerCase()}`,
        status: (i.status === 'CONNECTED' ? 'ACTIVE' : 'INACTIVE') as 'ACTIVE' | 'INACTIVE',
        requests: own.length,
        successRate: own.length > 0 ? Math.round(((own.length - failed) / own.length) * 1000) / 10 : 0,
        errorRate: own.length > 0 ? Math.round((failed / own.length) * 1000) / 10 : 0,
        avgLatencyMs: avgOf(own.filter((l) => l.durationMs != null).map((l) => l.durationMs as number)),
        lastUsedAt: i.lastSyncAt ? i.lastSyncAt.toISOString() : i.updatedAt.toISOString(),
        workspaceName: i.workspace?.name,
        createdAt: i.createdAt.toISOString(),
      };
    });

    return {
      totalApis: integrations.length,
      activeApis: integrations.filter((i) => i.status === 'CONNECTED').length,
      inactiveApis: integrations.filter((i) => i.status !== 'CONNECTED').length,
      totalRequests,
      successfulRequests,
      failedRequests,
      errorRate,
      avgResponseTimeMs,
      p95ResponseTimeMs,
      peakRequestsPerMinute,
      requestsOverTime,
      requestsByWorkspace,
      apiTable,
    };
  }

  // ---------------------------------------------------------------------------
  // 7. Messaging Analytics
  // ---------------------------------------------------------------------------

  async getMessagingAnalytics(filter?: AdminAnalyticsFilter): Promise<AdminMessagingAnalytics> {
    const range = resolveDateRange(filter);
    const { since, until } = range;

    const [messagesCount, byWorkspace, messageRows, mentionsCount] = await this.prisma.$transaction([
      this.prisma.recentActivity.count({ where: { kind: 'MESSAGE', occurredAt: { gte: since, lte: until } } }),
      this.prisma.recentActivity.groupBy({
        by: ['workspaceId'],
        where: { kind: 'MESSAGE', occurredAt: { gte: since, lte: until } },
        _count: { _all: true },
        orderBy: { _count: { workspaceId: 'desc' } },
        take: 10,
      }),
      this.prisma.recentActivity.findMany({
        where: { kind: 'MESSAGE', occurredAt: { gte: since, lte: until } },
        select: { occurredAt: true, channelId: true },
        take: 50000,
      }),
      this.prisma.recentActivity.count({
        where: {
          kind: 'MESSAGE',
          occurredAt: { gte: since, lte: until },
          mentionedUserIds: { isEmpty: false },
        },
      }),
    ]);

    const total = messagesCount;
    // A chat row without a channel is a direct message.
    const channelMessages = messageRows.filter((r) => r.channelId).length;
    const directMessages = messageRows.length - channelMessages;

    const buckets = generateDailyBuckets(since, until);
    const messagesByDay = countByDay(
      messageRows.map((r) => r.occurredAt),
      buckets,
    );
    // Each message is recorded once, against its sender. Delivery is not
    // tracked, so there is no separate "received" figure.
    const messagesOverTime = buckets.map((date) => {
      const dayTotal = messagesByDay.get(date) ?? 0;
      return { date, sent: dayTotal, received: 0, total: dayTotal };
    });

    const hourCounts = new Array<number>(24).fill(0);
    for (const r of messageRows) hourCounts[r.occurredAt.getHours()] += 1;
    const messagesByHour: Array<{ hour: number; count: number }> = hourCounts.map((count, hour) => ({ hour, count }));

    const workspaceNames = await this.prisma.workspace.findMany({
      where: { id: { in: byWorkspace.map((b) => b.workspaceId) } },
      select: { id: true, name: true },
    });
    const wsNameMap = new Map(workspaceNames.map((w) => [w.id, w.name]));

    const messagesByWorkspace = byWorkspace.map((b) => ({
      workspaceId: b.workspaceId,
      workspaceName: wsNameMap.get(b.workspaceId) ?? 'Workspace',
      count: b._count._all,
    }));

    return {
      totalMessages: total,
      messagesSent: total,
      messagesReceived: 0,
      directMessages,
      channelMessages,
      // Threads, reactions, edits and deletions are Matrix events and are not
      // mirrored into the platform database.
      threadsCount: 0,
      mentionsCount,
      reactionsCount: 0,
      editedMessagesCount: 0,
      deletedMessagesCount: 0,
      messagesOverTime,
      dmVsChannelBreakdown: [
        { label: 'Channel Messages', value: channelMessages, percentage: pct(channelMessages, messageRows.length) },
        { label: 'Direct Messages', value: directMessages, percentage: pct(directMessages, messageRows.length) },
      ],
      messagesByWorkspace,
      messagesByHour,
    };
  }

  // ---------------------------------------------------------------------------
  // 8. Storage Analytics
  // ---------------------------------------------------------------------------

  async getStorageAnalytics(filter?: AdminAnalyticsFilter): Promise<AdminStorageAnalytics> {
    const range = resolveDateRange(filter);
    const { since, until } = range;

    const [totalFiles, storageSum, files, storageBefore, sharedInWindow, byWorkspace] = await this.prisma.$transaction([
      this.prisma.upload.count(),
      this.prisma.upload.aggregate({ _sum: { size: true } }),
      this.prisma.upload.findMany({
        where: { createdAt: { gte: since, lte: until } },
        select: { size: true, mimeType: true, createdAt: true, workspaceId: true },
        take: 5000,
      }),
      this.prisma.upload.aggregate({ where: { createdAt: { lt: since } }, _sum: { size: true } }),
      this.prisma.recentActivity.count({ where: { kind: 'FILE_SHARED', occurredAt: { gte: since, lte: until } } }),
      this.prisma.upload.groupBy({
        by: ['workspaceId'],
        _count: { _all: true },
        _sum: { size: true },
        orderBy: { _sum: { size: 'desc' } },
        take: 10,
      }),
    ]);

    const totalBytes = storageSum._sum.size ?? 0;
    const avgSize = totalFiles > 0 ? Math.round(totalBytes / totalFiles) : 0;
    const storageRemainingBytes = Math.max(0, 100 * 1024 * 1024 * 1024 - totalBytes);

    const typeCountMap = new Map<string, number>();
    for (const f of files) {
      let cat = 'Other';
      const m = f.mimeType.toLowerCase();
      if (m.includes('pdf') || m.includes('document') || m.includes('text') || m.includes('sheet')) cat = 'Documents';
      else if (m.startsWith('image/')) cat = 'Images';
      else if (m.startsWith('video/')) cat = 'Videos';
      else if (m.startsWith('audio/')) cat = 'Audio';
      else if (m.includes('zip') || m.includes('tar') || m.includes('archive')) cat = 'Archives';
      typeCountMap.set(cat, (typeCountMap.get(cat) ?? 0) + 1);
    }

    const filesByType = Array.from(typeCountMap.entries()).map(([label, value]) => ({
      label,
      value,
      percentage: files.length > 0 ? Math.round((value / files.length) * 100) : 0,
    }));

    const buckets = generateDailyBuckets(since, until);
    const bytesBefore = storageBefore._sum.size ?? 0;
    const bytesByDay = sumByDay(
      files.map((f) => ({ at: f.createdAt, value: f.size })),
      buckets,
    );
    let runningBytes = bytesBefore;
    const storageGrowth = buckets.map((date) => {
      runningBytes += bytesByDay.get(date) ?? 0;
      return { date, value: runningBytes };
    });

    const uploadsByDay = countByDay(
      files.map((f) => f.createdAt),
      buckets,
    );
    const uploadActivity = buckets.map((date) => ({ date, value: uploadsByDay.get(date) ?? 0 }));

    const workspaceNames = new Map(
      (
        await this.prisma.workspace.findMany({
          where: { id: { in: byWorkspace.map((b) => b.workspaceId) } },
          select: { id: true, name: true },
        })
      ).map((w) => [w.id, w.name]),
    );
    const storageByWorkspace = byWorkspace.map((b) => ({
      workspaceId: b.workspaceId,
      workspaceName: workspaceNames.get(b.workspaceId) ?? 'Workspace',
      filesCount: b._count._all,
      bytes: b._sum?.size ?? 0,
    }));

    return {
      totalFiles,
      filesUploaded: files.length,
      // Downloads are served by storage and not counted by the platform.
      filesDownloaded: 0,
      filesShared: sharedInWindow,
      storageUsedBytes: totalBytes,
      storageRemainingBytes,
      averageFileSizeBytes: avgSize,
      growthPct: bytesBefore > 0 ? Math.round(((totalBytes - bytesBefore) / bytesBefore) * 1000) / 10 : 0,
      storageGrowth,
      uploadActivity,
      filesByType,
      storageByWorkspace,
    };
  }

  // ---------------------------------------------------------------------------
  // 9. Device Analytics
  // ---------------------------------------------------------------------------

  async getDeviceAnalytics(filter?: AdminAnalyticsFilter): Promise<AdminDeviceAnalytics> {
    const range = resolveDateRange(filter);
    const { since, until } = range;

    const tokens = await this.prisma.refreshToken.findMany({
      where: { createdAt: { gte: since, lte: until } },
      select: { userAgent: true, userId: true, revokedAt: true, expiresAt: true },
      take: 10000,
    });

    const osMap = new Map<string, number>();
    const browserMap = new Map<string, number>();
    const userDevices = new Set<string>();

    for (const t of tokens) {
      userDevices.add(t.userId);
      const env = detectDeviceEnvironment({ userAgent: t.userAgent ?? '' });
      osMap.set(env.os, (osMap.get(env.os) ?? 0) + 1);
      browserMap.set(env.browser, (browserMap.get(env.browser) ?? 0) + 1);
    }

    const total = tokens.length || 1;
    const usersByOs = Array.from(osMap.entries()).map(([label, value]) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      value,
      percentage: Math.round((value / total) * 100),
    }));

    const browsers = Array.from(browserMap.entries()).map(([label, value]) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      value,
      percentage: Math.round((value / total) * 100),
    }));

    // Sessions do not record the client's app version, so there is no version
    // breakdown to report.
    const now = new Date();
    const liveSessions = tokens.filter((t) => !t.revokedAt && t.expiresAt > now);

    return {
      totalDevices: userDevices.size,
      activeDevices: new Set(liveSessions.map((t) => t.userId)).size,
      usersByOs,
      sessionsByOs: usersByOs,
      browsers,
      appVersions: [],
      outdatedCount: 0,
    };
  }

  // ---------------------------------------------------------------------------
  // 10. Location Analytics (Privacy-safe)
  // ---------------------------------------------------------------------------

  async getLocationAnalytics(_filter?: AdminAnalyticsFilter): Promise<AdminLocationAnalytics> {
    const [users, memberships] = await Promise.all([
      this.prisma.user.findMany({ select: { id: true, timezone: true }, take: 5000 }),
      this.prisma.workspaceMember.findMany({ select: { userId: true, workspaceId: true }, take: 50000 }),
    ]);
    const workspacesByUser = new Map<string, string[]>();
    for (const m of memberships) workspacesByUser.set(m.userId, [...(workspacesByUser.get(m.userId) ?? []), m.workspaceId]);
    const workspaceSetByCountry = new Map<string, Set<string>>();
    const regionMap = new Map<string, number>();

    const countryMap = new Map<string, number>();
    for (const u of users) {
      let code = 'XX';
      const tz = u.timezone.toLowerCase();
      if (tz.includes('asia/kolkata') || tz.includes('calcutta')) code = 'IN';
      else if (tz.includes('europe/london')) code = 'GB';
      else if (tz.includes('europe/berlin') || tz.includes('europe/paris')) code = 'DE';
      else if (tz.includes('asia/tokyo')) code = 'JP';
      else if (tz.includes('australia')) code = 'AU';
      else if (tz.includes('toronto') || tz.includes('vancouver')) code = 'CA';
      else if (tz.startsWith('america/') || tz.startsWith('us/')) code = 'US';
      countryMap.set(code, (countryMap.get(code) ?? 0) + 1);
      const wsSet = workspaceSetByCountry.get(code) ?? new Set<string>();
      for (const w of workspacesByUser.get(u.id) ?? []) wsSet.add(w);
      workspaceSetByCountry.set(code, wsSet);

      const area = tz.split('/')[0];
      const region =
        area === 'america' || area === 'us' ? 'North America' :
        area === 'europe' || area === 'africa' ? 'Europe & Africa' :
        area === 'asia' || area === 'australia' || area === 'pacific' ? 'Asia Pacific' : 'Unknown';
      regionMap.set(region, (regionMap.get(region) ?? 0) + 1);
    }

    const total = users.length || 1;
    const countryNames: Record<string, string> = {
      US: 'United States',
      IN: 'India',
      GB: 'United Kingdom',
      DE: 'Germany',
      JP: 'Japan',
      AU: 'Australia',
      CA: 'Canada',
      XX: 'Unknown',
    };

    const countries = Array.from(countryMap.entries()).map(([code, count]) => ({
      code,
      name: countryNames[code] ?? code,
      usersCount: count,
      workspacesCount: workspaceSetByCountry.get(code)?.size ?? 0,
      percentage: Math.round((count / total) * 100),
    }));

    const regions = [...regionMap.entries()].map(([region, count]) => ({
      region,
      count,
      percentage: Math.round((count / total) * 100),
    }));

    return {
      totalCountries: countries.filter((c) => c.code !== 'XX').length,
      countries,
      regions,
    };
  }

  // ---------------------------------------------------------------------------
  // 11. Revenue & Billing Analytics
  // ---------------------------------------------------------------------------

  async getRevenueAnalytics(filter?: AdminAnalyticsFilter): Promise<AdminRevenueAnalytics> {
    const range = resolveDateRange(filter);
    const { since, until } = range;

    const [subscriptions, usersCount, workspacesCount, invoices] = await this.prisma.$transaction([
      this.prisma.workspaceSubscription.findMany({
        include: { workspace: { select: { name: true } } },
      }),
      this.prisma.user.count(),
      this.prisma.workspace.count(),
      this.prisma.billingInvoice.findMany({
        where: { createdAt: { gte: since, lte: until } },
        select: { amountCents: true, status: true, paidAt: true, createdAt: true },
        take: 20000,
      }),
    ]);

    let mrr = 0;
    const planRevenueMap = new Map<string, number>();

    for (const sub of subscriptions) {
      if (sub.status === 'ACTIVE') {
        const amount = monthlyListPriceUsd(sub.planTier, sub.billingInterval);

        mrr += amount;
        planRevenueMap.set(sub.planTier, (planRevenueMap.get(sub.planTier) ?? 0) + amount);
      }
    }

    const arr = mrr * 12;
    // Revenue actually collected in the window, from recorded invoices.
    const paidInvoices = invoices.filter((i) => i.status === 'PAID');
    const totalRevenue = paidInvoices.reduce((acc, i) => acc + i.amountCents / 100, 0);
    const refunds = invoices.filter((i) => i.status === 'REFUNDED').reduce((acc, i) => acc + i.amountCents / 100, 0);
    const invoiceCount = (status: string) => invoices.filter((i) => i.status === status).length;

    const inWindow = (d: Date | null | undefined) => !!d && d >= since && d <= until;
    const newRevenue = subscriptions
      .filter((sub) => sub.status === 'ACTIVE' && inWindow(sub.createdAt) && sub.planTier !== 'FREE')
      .reduce((acc, sub) => acc + monthlyListPriceUsd(sub.planTier, sub.billingInterval), 0);
    const churnedRevenue = subscriptions
      .filter((sub) => inWindow(sub.cancelledAt))
      .reduce((acc, sub) => acc + monthlyListPriceUsd(sub.planTier, sub.billingInterval), 0);
    const providerCounts = new Map<string, number>();
    for (const sub of subscriptions) {
      if (sub.planTier === 'FREE') continue;
      const provider = sub.provider ?? 'Unknown';
      providerCounts.set(provider, (providerCounts.get(provider) ?? 0) + 1);
    }
    const paidSubscriptions = [...providerCounts.values()].reduce((a, b) => a + b, 0);

    const revenueByPlan = Array.from(planRevenueMap.entries()).map(([label, value]) => ({
      label,
      value,
      percentage: mrr > 0 ? Math.round((value / mrr) * 100) : 0,
    }));

    const buckets = generateDailyBuckets(since, until);
    const paidByDay = sumByDay(
      paidInvoices.map((i) => ({ at: i.paidAt ?? i.createdAt, value: i.amountCents / 100 })),
      buckets,
    );
    const revenueTrend = buckets.map((date) => ({ date, value: paidByDay.get(date) ?? 0 }));

    const mrrTrend = buckets.map((date) => ({
      date,
      value: mrr,
    }));

    const revenueByWorkspace = subscriptions.slice(0, 10).map((s) => ({
      workspaceId: s.workspaceId,
      workspaceName: s.workspace.name,
      plan: s.planTier,
      amount: monthlyListPriceUsd(s.planTier, s.billingInterval),
    }));

    return {
      totalRevenue,
      mrr,
      arr,
      newRevenue,
      // Plan changes are not tracked as revenue movements.
      expansionRevenue: 0,
      churnedRevenue,
      refunds,
      netRevenue: totalRevenue - refunds,
      arpu: usersCount > 0 ? Math.round((mrr / usersCount) * 100) / 100 : 0,
      avgRevenuePerWorkspace: workspacesCount > 0 ? Math.round((mrr / workspacesCount) * 100) / 100 : 0,
      revenueTrend,
      mrrTrend,
      revenueByPlan,
      revenueByWorkspace,
      revenueMovement: {
        new: newRevenue,
        expansion: 0,
        contraction: 0,
        churn: churnedRevenue,
      },
      paymentAnalytics: {
        successful: invoiceCount('PAID'),
        failed: invoiceCount('FAILED'),
        pending: invoiceCount('PENDING') + invoiceCount('OPEN'),
        refunds: invoiceCount('REFUNDED'),
        methods: [...providerCounts.entries()].map(([label, value]) => ({
          label,
          value,
          percentage: pct(value, paidSubscriptions),
        })),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 12. Subscription Analytics
  // ---------------------------------------------------------------------------

  async getSubscriptionAnalytics(_filter?: AdminAnalyticsFilter): Promise<AdminSubscriptionAnalytics> {
    const [subscriptions, auditActions] = await Promise.all([
      this.prisma.workspaceSubscription.findMany({
        select: { planTier: true, status: true, trialStart: true, convertedAt: true },
      }),
      this.prisma.billingAuditLog.groupBy({ by: ['action'], _count: { _all: true } }),
    ]);
    const auditCount = (match: (action: string) => boolean) =>
      auditActions.filter((a) => match(a.action)).reduce((acc, a) => acc + a._count._all, 0);

    let freeCount = 0;
    let trialCount = 0;
    let paidCount = 0;
    const planCounts = new Map<string, number>();

    for (const s of subscriptions) {
      const tier = normalizePlanTier(s.planTier).toUpperCase();
      planCounts.set(tier, (planCounts.get(tier) ?? 0) + 1);
      if (tier === 'FREE') freeCount += 1;
      else if (s.status === 'TRIALING') trialCount += 1;
      else paidCount += 1;
    }

    const total = Math.max(1, freeCount + trialCount + paidCount);
    const planDistribution = Array.from(planCounts.entries()).map(([label, value]) => ({
      label,
      value,
      percentage: Math.round((value / total) * 100),
    }));

    const trialSignups = subscriptions.filter((x) => x.trialStart).length;
    const converted = subscriptions.filter((x) => x.convertedAt).length;
    const retained = subscriptions.filter((x) => x.convertedAt && x.status === 'ACTIVE').length;
    const stillTrialing = subscriptions.filter((x) => x.trialStart && x.status === 'TRIALING').length;
    const inTrial = converted + stillTrialing;

    const funnel = [
      { stage: 'Trial Signup', count: trialSignups, conversionPct: trialSignups > 0 ? 100 : 0 },
      { stage: 'Active in Trial', count: inTrial, conversionPct: pct(inTrial, trialSignups) },
      { stage: 'Paid Conversion', count: converted, conversionPct: pct(converted, trialSignups) },
      { stage: 'Renewed / Retained', count: retained, conversionPct: pct(retained, converted) },
    ];

    const cancellations = auditCount((a) => a === 'SUBSCRIPTION_ENDED');

    return {
      freeCount,
      trialCount,
      paidCount,
      planDistribution,
      upgrades: auditCount((a) => a.includes('UPGRADE')),
      downgrades: auditCount((a) => a === 'DOWNGRADE_APPLIED'),
      renewals: auditCount((a) => a.includes('RENEW')),
      cancellations,
      churnRatePct: paidCount + cancellations > 0 ? Math.round((cancellations / (paidCount + cancellations)) * 1000) / 10 : 0,
      trialConversionRatePct: trialSignups > 0 ? Math.round((converted / trialSignups) * 1000) / 10 : 0,
      funnel,
    };
  }

  // ---------------------------------------------------------------------------
  // 13. Engagement Analytics
  // ---------------------------------------------------------------------------

  async getEngagementAnalytics(_filter?: AdminAnalyticsFilter): Promise<AdminEngagementAnalytics> {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const monthAgo = new Date(Date.now() - 30 * DAY_MS);
    const twoMonthsAgo = new Date(Date.now() - 60 * DAY_MS);
    const [dauCount, wauCount, mauCount, workspaces, users, sessionCount, kindNow, kindBefore, kindWorkspaces, totalWorkspaces] =
      await this.prisma.$transaction([
      this.prisma.refreshToken.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.refreshToken.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.refreshToken.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.workspace.findMany({
        take: 5,
        include: { _count: { select: { recentActivities: true, members: true } } },
      }),
      this.prisma.user.findMany({
        take: 5,
        include: { _count: { select: { recentActivities: true } } },
      }),
      this.prisma.refreshToken.count({ where: { createdAt: { gte: monthAgo } } }),
      this.prisma.recentActivity.groupBy({
        by: ['kind'],
        where: { occurredAt: { gte: monthAgo } },
        _count: { _all: true },
        orderBy: { kind: 'asc' },
      }),
      this.prisma.recentActivity.groupBy({
        by: ['kind'],
        where: { occurredAt: { gte: twoMonthsAgo, lt: monthAgo } },
        _count: { _all: true },
        orderBy: { kind: 'asc' },
      }),
      this.prisma.recentActivity.groupBy({
        by: ['kind', 'workspaceId'],
        where: { occurredAt: { gte: monthAgo } },
        orderBy: [{ kind: 'asc' }, { workspaceId: 'asc' }],
      }),
      this.prisma.workspace.count(),
    ]);

    const dau = dauCount.length;
    const wau = wauCount.length;
    const mau = mauCount.length;
    const stickiness = mau > 0 ? Math.round((dau / mau) * 1000) / 10 : 0;

    // Feature usage is read off the activity feed (last 30 days vs the 30 before).
    const FEATURES: Array<{ feature: string; kinds: string[] }> = [
      { feature: 'Channels & Direct Chat', kinds: ['MESSAGE', 'CHANNEL_CREATED'] },
      { feature: 'Work Tasks & Projects', kinds: ['TASK_CREATED', 'TASK_ASSIGNED', 'TASK_COMPLETED', 'PROJECT_CREATED'] },
      { feature: 'Work Documents', kinds: ['DOCUMENT_CREATED'] },
      { feature: 'Meetings', kinds: ['MEETING_SCHEDULED', 'MEETING_CANCELLED', 'MEETING_ENDED'] },
      { feature: 'File Sharing', kinds: ['FILE_SHARED'] },
    ];
    const featureUsage = FEATURES.map(({ feature, kinds }) => {
      const sumKinds = (rows: Array<{ kind: string; _count: { _all: number } }>) =>
        rows.filter((r) => kinds.includes(r.kind)).reduce((acc, r) => acc + r._count._all, 0);
      const now = sumKinds(kindNow);
      const before = sumKinds(kindBefore);
      const adopting = new Set(kindWorkspaces.filter((r) => kinds.includes(r.kind)).map((r) => r.workspaceId)).size;
      return {
        feature,
        usageCount: now,
        adoptionRate: pct(adopting, totalWorkspaces),
        trend: (now > before ? 'up' : now < before ? 'down' : 'flat') as 'up' | 'down' | 'flat',
      };
    });

    const mostActiveWorkspaces = workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      activityScore: w._count.recentActivities * 10 + w._count.members * 5,
    }));

    const mostActiveUsers = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      activityScore: u._count.recentActivities * 12,
    }));

    return {
      dau,
      wau,
      mau,
      stickiness,
      totalSessions: sessionCount,
      // Sessions are not timed anywhere, so there is no duration to report.
      avgSessionDurationSeconds: 0,
      featureUsage,
      mostActiveWorkspaces,
      mostActiveUsers,
    };
  }

  // ---------------------------------------------------------------------------
  // 14. Live Platform Activity Feed
  // ---------------------------------------------------------------------------

  async getLiveActivity(): Promise<AdminLiveActivityItem[]> {
    const activities = await this.prisma.recentActivity.findMany({
      take: 30,
      orderBy: { occurredAt: 'desc' },
      include: {
        user: { select: { name: true } },
        workspace: { select: { name: true } },
      },
    });

    return activities.map((a) => {
      let type: AdminLiveActivityItem['type'] = 'MESSAGE_POSTED';
      if (a.kind === 'MEMBER_JOINED') type = 'USER_ACTIVE';
      else if (a.kind === 'FILE_SHARED') type = 'FILE_UPLOADED';

      return {
        id: a.id,
        type,
        title: a.user?.name ?? 'Platform Actor',
        description: a.summary ?? `${a.kind} in ${a.workspace.name}`,
        timestamp: a.occurredAt.toISOString(),
        severity: 'info',
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 15. Export Utility
  // ---------------------------------------------------------------------------

  async exportAnalytics(
    type: string,
    format: 'json' | 'csv' = 'csv',
    filter?: AdminAnalyticsFilter,
  ): Promise<string> {
    let data: Record<string, unknown>[];

    switch (type) {
      case 'users': {
        const res = await this.getUserAnalytics(filter);
        data = res.topUsers.map((u) => ({
          'User ID': u.id,
          Name: u.name,
          Email: u.email,
          Role: u.systemRole,
          Presence: u.presence,
          Sessions: u.sessionsCount,
          Messages: u.messagesCount,
          Files: u.filesCount,
          Workspaces: u.workspacesCount,
          Platform: u.platform,
        }));
        break;
      }
      case 'workspaces': {
        const res = await this.getWorkspaces(filter, { page: 1, pageSize: 500 });
        data = res.items.map((w) => ({
          'Workspace ID': w.id,
          Name: w.name,
          Status: w.status,
          Owner: w.owner.name,
          'Owner Email': w.owner.email,
          Members: w.usersCount,
          Plan: w.subscriptionPlan,
          Revenue: w.revenue,
          Messages: w.messagesCount,
          Storage: w.storageBytes,
        }));
        break;
      }
      case 'apis': {
        const res = await this.getApiAnalytics(filter);
        data = res.apiTable.map((a) => ({
          API: a.name,
          Endpoint: a.endpoint,
          Status: a.status,
          Requests: a.requests,
          'Success Rate': `${a.successRate}%`,
          'Error Rate': `${a.errorRate}%`,
          'Avg Latency (ms)': a.avgLatencyMs,
        }));
        break;
      }
      default: {
        const res = await this.getOverview(filter);
        data = Object.entries(res.platformKpis).map(([, v]) => ({
          Metric: v.label,
          Value: v.value,
          Previous: v.previousValue ?? '—',
          Change: v.changePct !== null ? `${v.changePct}%` : '—',
        }));
      }
    }

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    // Convert to CSV
    if (data.length === 0) return 'No records found';
    const headers = Object.keys(data[0]!);
    const csvRows = [headers.join(',')];
    for (const row of data) {
      const values = headers.map((h) => {
        const val = `${row[h] ?? ''}`.replace(/"/g, '""');
        return `"${val}"`;
      });
      csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
  }
}
