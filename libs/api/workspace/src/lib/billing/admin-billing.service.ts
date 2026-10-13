import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaService } from '@org/database';
import { normalizePlanTier, planPeriodCents } from '@org/types';
import { BillingAuditService } from './billing-audit.service.js';

export interface AdminSubscriptionFilter {
  search?: string;
  plan?: string;
  status?: string;
  source?: string;
  page?: number;
  pageSize?: number;
}

export interface DateRange {
  from?: Date;
  to?: Date;
}

const csvCell = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  // Neutralise spreadsheet formula injection as well as quoting.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  return [headers.map(csvCell).join(','), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(','))].join('\n');
}

/** Platform-admin billing views. Callers must already be authorised as SUPERADMIN. */
@Injectable()
export class AdminBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: BillingAuditService,
  ) {}

  private subscriptionWhere(f: AdminSubscriptionFilter): Prisma.WorkspaceSubscriptionWhereInput {
    const where: Prisma.WorkspaceSubscriptionWhereInput = {};
    if (f.plan) where.planTier = normalizePlanTier(f.plan).toUpperCase();
    if (f.status) where.status = f.status.toUpperCase();
    if (f.source) where.source = f.source.toUpperCase();
    if (f.search?.trim()) {
      where.workspace = {
        OR: [
          { name: { contains: f.search.trim(), mode: 'insensitive' } },
          { slug: { contains: f.search.trim(), mode: 'insensitive' } },
        ],
      };
    }
    return where;
  }

  async listSubscriptions(f: AdminSubscriptionFilter) {
    const pageSize = Math.min(Math.max(f.pageSize ?? 25, 1), 200);
    const page = Math.max(f.page ?? 1, 1);
    const where = this.subscriptionWhere(f);
    const [total, rows] = await Promise.all([
      this.prisma.workspaceSubscription.count({ where }),
      this.prisma.workspaceSubscription.findMany({
        where,
        include: { workspace: { select: { id: true, name: true, slug: true } } },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      total,
      page,
      pageSize,
      items: rows.map((s) => ({
        workspaceId: s.workspaceId,
        workspaceName: s.workspace.name,
        workspaceSlug: s.workspace.slug,
        plan: normalizePlanTier(s.planTier),
        billingInterval: s.billingInterval.toLowerCase(),
        status: s.status,
        source: s.source,
        provider: s.provider,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        currentPeriodEnd: s.currentPeriodEnd.toISOString(),
        pastDueSince: s.pastDueSince?.toISOString() ?? null,
        trialStatus: s.trialStatus,
        appliedPromotionCode: s.appliedPromotionCode,
        scheduledPlanTier: s.scheduledPlanTier,
      })),
    };
  }

  async exportSubscriptionsCsv(f: AdminSubscriptionFilter): Promise<string> {
    const { items } = await this.listSubscriptions({ ...f, page: 1, pageSize: 200 });
    return toCsv(items as unknown as Array<Record<string, unknown>>);
  }

  async listInvoices(opts: DateRange & { status?: string; workspaceId?: string; page?: number; pageSize?: number }) {
    const pageSize = Math.min(Math.max(opts.pageSize ?? 25, 1), 200);
    const page = Math.max(opts.page ?? 1, 1);
    const where: Prisma.BillingInvoiceWhereInput = {
      ...(opts.status ? { status: opts.status.toUpperCase() } : {}),
      ...(opts.workspaceId ? { workspaceId: opts.workspaceId } : {}),
      ...(opts.from || opts.to ? { createdAt: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.billingInvoice.count({ where }),
      this.prisma.billingInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { workspace: { select: { name: true } } },
      }),
    ]);
    return {
      total,
      page,
      pageSize,
      items: rows.map((i) => ({
        id: i.id,
        number: i.number,
        workspaceId: i.workspaceId,
        workspaceName: i.workspace.name,
        amountCents: i.amountCents,
        currency: i.currency,
        status: i.status,
        description: i.description,
        createdAt: i.createdAt.toISOString(),
        paidAt: i.paidAt?.toISOString() ?? null,
      })),
    };
  }

  async exportInvoicesCsv(opts: DateRange & { status?: string }): Promise<string> {
    const { items } = await this.listInvoices({ ...opts, page: 1, pageSize: 200 });
    return toCsv(items as unknown as Array<Record<string, unknown>>);
  }

  /**
   * Metrics are computed only from recorded facts: paid invoices for revenue and
   * subscription rows for counts. `estimatedMrrCents` uses list prices of active
   * provider-billed subscriptions (it ignores coupons) and is labelled as such.
   */
  async stats(range: DateRange = {}) {
    const to = range.to ?? new Date();
    const from = range.from ?? new Date(to.getTime() - 30 * 86_400_000);
    const inRange = { gte: from, lte: to };

    const [paid, failedPaymentSubs, cancelled, subsByPlan, trialsStarted, trialsConverted, activeProvider] =
      await Promise.all([
        this.prisma.billingInvoice.aggregate({
          where: { status: 'PAID', paidAt: inRange },
          _sum: { amountCents: true },
          _count: true,
        }),
        this.prisma.workspaceSubscription.count({ where: { status: { in: ['PAST_DUE', 'UNPAID'] } } }),
        this.prisma.billingAuditLog.count({ where: { action: 'SUBSCRIPTION_ENDED', createdAt: inRange } }),
        this.prisma.workspaceSubscription.groupBy({ by: ['planTier'], _count: true }),
        this.prisma.workspaceSubscription.count({ where: { trialStart: inRange } }),
        this.prisma.workspaceSubscription.count({ where: { convertedAt: inRange } }),
        this.prisma.workspaceSubscription.findMany({
          where: { source: 'PROVIDER', status: { in: ['ACTIVE', 'PAST_DUE'] } },
          select: { planTier: true, billingInterval: true },
        }),
      ]);

    const estimatedMrrCents = activeProvider.reduce((sum, s) => {
      const interval = s.billingInterval.toLowerCase() === 'annual' ? 'annual' : 'monthly';
      const period = planPeriodCents(s.planTier, interval);
      return sum + (interval === 'annual' ? Math.round(period / 12) : period);
    }, 0);

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      paidRevenueCents: paid._sum.amountCents ?? 0,
      paidInvoiceCount: paid._count,
      estimatedMrrCents,
      estimatedMrrNote: 'List-price estimate of active provider-billed subscriptions; ignores discounts.',
      failedPaymentSubscriptions: failedPaymentSubs,
      subscriptionsEnded: cancelled,
      trialsStarted,
      trialsConverted,
      trialConversionRate: trialsStarted > 0 ? trialsConverted / trialsStarted : null,
      subscriptionsByPlan: subsByPlan.map((g) => ({ plan: normalizePlanTier(g.planTier), count: g._count })),
    };
  }

  async listAudit(opts: { workspaceId?: string; take?: number } = {}) {
    return this.prisma.billingAuditLog.findMany({
      where: {
        action: { not: 'NOTICE_SENT' },
        ...(opts.workspaceId ? { workspaceId: opts.workspaceId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(opts.take ?? 100, 1), 500),
    });
  }

  async listWebhookEvents(take = 100) {
    return this.prisma.billingWebhookEvent.findMany({
      orderBy: { receivedAt: 'desc' },
      take: Math.min(Math.max(take, 1), 500),
      select: { id: true, provider: true, type: true, status: true, error: true, receivedAt: true, processedAt: true },
    });
  }

  /**
   * Grants/updates a negotiated Enterprise contract. This is the only way to
   * reach Enterprise: it is never self-serve, and the terms live in the row
   * rather than in code.
   */
  async setContract(
    workspaceId: string,
    actorId: string,
    input: { periodEnd: string; billingInterval?: 'monthly' | 'annual'; seatsTotal?: number; note?: string },
  ) {
    const periodEnd = new Date(input.periodEnd);
    if (isNaN(+periodEnd) || periodEnd <= new Date()) {
      throw new BadRequestException('The contract end date must be in the future.');
    }
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
    if (!workspace) throw new NotFoundException('Workspace not found.');
    const data = {
      planTier: 'ENTERPRISE',
      source: 'CONTRACT',
      status: 'ACTIVE',
      billingInterval: (input.billingInterval ?? 'annual').toUpperCase(),
      seatsTotal: input.seatsTotal ?? 1000,
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
      renewAt: periodEnd,
      cancelAtPeriodEnd: false,
      pastDueSince: null,
    };
    const row = await this.prisma.workspaceSubscription.upsert({
      where: { workspaceId },
      create: { workspaceId, ...data },
      update: data,
    });
    await this.audit.record({
      action: 'ENTERPRISE_CONTRACT_SET',
      targetType: 'subscription',
      targetId: workspaceId,
      workspaceId,
      actorId,
      details: { periodEnd, note: input.note },
    });
    return row;
  }
}
