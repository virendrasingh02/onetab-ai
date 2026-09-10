import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AdminAnalyticsService } from './admin-analytics.service.js';

describe('AdminAnalyticsService', () => {
  let service: AdminAnalyticsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: vi.fn(),
      user: { count: vi.fn().mockResolvedValue(100), findMany: vi.fn().mockResolvedValue([]) },
      workspace: { count: vi.fn().mockResolvedValue(10), findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn() },
      refreshToken: { findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]) },
      recentActivity: { count: vi.fn().mockResolvedValue(200), findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]) },
      upload: { count: vi.fn().mockResolvedValue(50), findMany: vi.fn().mockResolvedValue([]), aggregate: vi.fn().mockResolvedValue({ _sum: { size: 10485760 } }), groupBy: vi.fn().mockResolvedValue([]) },
      externalIntegration: { count: vi.fn().mockResolvedValue(4), findMany: vi.fn().mockResolvedValue([]) },
      integrationAuditLog: { count: vi.fn().mockResolvedValue(120), findMany: vi.fn().mockResolvedValue([]) },
      workspaceSubscription: { findMany: vi.fn().mockResolvedValue([]) },
      anonymousMessage: { count: vi.fn().mockResolvedValue(10) },
      emailMessage: { count: vi.fn().mockResolvedValue(5) },
      workspaceMember: { groupBy: vi.fn().mockResolvedValue([]) },
    };

    service = new AdminAnalyticsService(mockPrisma);
  });

  it('calculates overview metrics with previous period comparison', async () => {
    mockPrisma.$transaction.mockResolvedValue([
      100, // totalUsers
      10,  // newUsersCurrent
      8,   // newUsersPrevious
      [{ userId: 'u1' }], // dauCurrent
      [{ userId: 'u1' }], // dauPrevious
      [{ userId: 'u1' }, { userId: 'u2' }], // wauCurrent
      [{ userId: 'u1' }], // wauPrevious
      [{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }], // mauCurrent
      [{ userId: 'u1' }, { userId: 'u2' }], // mauPrevious
      10, // totalWorkspaces
      8,  // activeWorkspaces
      2,  // inactiveWorkspaces
      3,  // totalIntegrations
      150,// integrationLogsCurrent
      100,// integrationLogsPrevious
      5,  // integrationErrorsCurrent
      2,  // integrationErrorsPrevious
      500,// messagesCurrent
      400,// messagesPrevious
      30, // uploadsCurrent
      20, // uploadsPrevious
      { _sum: { size: 52428800 } }, // storageCurrent
      [{ planTier: 'PRO', billingInterval: 'MONTHLY', seatsTotal: 5, status: 'ACTIVE' }], // subscriptions
      [], // recentEvents
      [], // activityRows
    ]);

    const res = await service.getOverview({ range: '30d' });

    expect(res).toBeDefined();
    expect(res.rangeDays).toBe(30);
    expect(res.freshness).toBe('realtime');
    expect(res.platformKpis['totalUsers']?.value).toBe(100);
    expect(res.platformKpis['activeUsers']?.value).toBe(3);
    expect(res.communicationKpis['messagesSent']?.value).toBe(500);
    expect(res.filesKpis['totalStorageConsumed']?.value).toBe(52428800);
    expect(res.revenueKpis['mrr']?.value).toBe(60); // 12 * 5 seats
  });

  it('computes Web vs Desktop breakdown from session user agents', async () => {
    mockPrisma.$transaction.mockResolvedValue([
      [
        { userId: 'u1', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0', createdAt: new Date() },
        { userId: 'u2', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Electron/28.0', createdAt: new Date() },
      ],
      50, // messages
      10, // uploads
      20, // users
    ]);

    const res = await service.getPlatformUsage({ range: '7d' });

    expect(res.platformsTable).toHaveLength(2);
    expect(res.platformsTable[0]?.platform).toBe('Web');
    expect(res.platformsTable[1]?.platform).toBe('Desktop');
    expect(res.sessionsByPlatform.web).toBeGreaterThan(0);
    expect(res.sessionsByPlatform.desktop).toBeGreaterThan(0);
  });

  it('exports analytics to CSV format', async () => {
    mockPrisma.$transaction.mockResolvedValue([
      [
        {
          id: 'ws_1',
          name: 'Acme Corp',
          slug: 'acme',
          status: 'ACTIVE',
          owner: { id: 'u1', name: 'Alice', email: 'alice@acme.com' },
          createdAt: new Date(),
          updatedAt: new Date(),
          subscription: { planTier: 'PRO', status: 'ACTIVE', seatsTotal: 10 },
          _count: { members: 10, channels: 5, uploads: 20, tasks: 15, recentActivities: 100, integrations: 2 },
        },
      ],
      1, // total
      1, // totalWorkspacesCount
      1, // activeCount
      0, // inactiveCount
      { _sum: { size: 1000 } },
    ]);

    const csv = await service.exportAnalytics('workspaces', 'csv');
    expect(csv).toContain('Workspace ID');
    expect(csv).toContain('Acme Corp');
    expect(csv).toContain('alice@acme.com');
  });
});
