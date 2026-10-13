import { describe, expect, it, vi } from 'vitest';
import { WorkspaceRole } from '@org/types';
import { BillingService } from './billing.service.js';

function build(sub: Record<string, unknown> | null, providerConfigured = false) {
  const count = (n = 0) => ({ count: vi.fn().mockResolvedValue(n) });
  const prisma: any = {
    workspace: {
      findUnique: vi.fn().mockResolvedValue({ id: 'ws_1', name: 'Acme', subscription: sub }),
    },
    workspaceMember: count(1),
    project: count(1),
    upload: { aggregate: vi.fn().mockResolvedValue({ _sum: { size: 0 } }) },
    aIChatSession: count(),
    automationWorkflow: count(),
    externalIntegration: count(),
    aIAgent: count(1),
    workflowExecution: count(),
    workspaceSubscription: { findUnique: vi.fn().mockResolvedValue(sub), update: vi.fn() },
    billingInvoice: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const credits: any = {
    getOrCreateAccount: vi.fn().mockResolvedValue({ id: 'c', workspaceId: 'ws_1', balance: 5, currency: 'USD', updatedAt: new Date().toISOString() }),
  };
  const provider: any = { name: 'fake', isConfigured: () => providerConfigured };
  const service = new BillingService(
    prisma,
    credits,
    { record: vi.fn() } as never,
    { get: (k: string) => (k === 'BILLING_MODE' ? 'test' : undefined) } as never,
    { emit: vi.fn() } as never,
    provider,
  );
  return { service, prisma };
}

const paidSub = (over: Record<string, unknown> = {}) => ({
  id: 's', workspaceId: 'ws_1', planTier: 'PRO', billingInterval: 'MONTHLY', status: 'ACTIVE',
  seatsTotal: 25, seatsUsed: 1, cancelAtPeriodEnd: false,
  currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 864e5), renewAt: new Date(),
  trialStart: null, trialEnd: null, trialStatus: null, trialUsed: false, convertedAt: null,
  appliedPromotionCode: null, discountPercent: null, source: 'PROVIDER', provider: 'fake', pastDueSince: null,
  scheduledPlanTier: null, scheduledBillingInterval: null, scheduledChangeAt: null,
  createdAt: new Date(), updatedAt: new Date(), ...over,
});

describe('BillingService.getBillingSummary', () => {
  it('treats a workspace with no subscription as Free and reports payments as disabled', async () => {
    const { service } = build(null);
    const s = await service.getBillingSummary('ws_1', WorkspaceRole.OWNER);
    expect(s.plan).toBe('free');
    expect(s.subscription).toBeNull();
    expect(s.paymentsEnabled).toBe(false);
    expect(s.paymentProvider).toBeNull();
    expect(s.billingMode).toBe('test');
    expect(s.entitlements.agent_upgrades).toBe(false);
  });

  it('maps a legacy STARTER row to Free and a BUSINESS row to Max', async () => {
    expect((await build(paidSub({ planTier: 'STARTER' })).service.getBillingSummary('ws_1')).plan).toBe('free');
    expect((await build(paidSub({ planTier: 'BUSINESS' })).service.getBillingSummary('ws_1')).plan).toBe('max');
  });

  it('exposes entitlements from the central config and the scheduled change', async () => {
    const when = new Date(Date.now() + 5 * 864e5);
    const { service } = build(
      paidSub({ planTier: 'MAX', scheduledPlanTier: 'PRO', scheduledChangeAt: when }),
      true,
    );
    const s = await service.getBillingSummary('ws_1', WorkspaceRole.OWNER);
    expect(s.plan).toBe('max');
    expect(s.entitlements.audit_logs).toBe(true);
    expect(s.entitlements.custom_llm).toBe(false);
    expect(s.subscription?.scheduledPlanTier).toBe('pro');
    expect(s.paymentsEnabled).toBe(true);
  });

  it('flags usage limits for the plan (Free = 3 micro agents)', async () => {
    const s = await build(null).service.getBillingSummary('ws_1');
    expect(s.usage.microAgents.limit).toBe(3);
  });
});

describe('BillingService subscription changes', () => {
  it('cannot cancel or downgrade from the Free plan', async () => {
    const { service } = build(null);
    await expect(service.cancelSubscription('ws_1')).rejects.toThrow(/Free plan/);
    await expect(service.downgradePlan('ws_1', 'u', { targetPlan: 'free' })).rejects.toThrow(/Free plan/);
  });

  it('rejects a "downgrade" to an equal or higher plan', async () => {
    const { service, prisma } = build(paidSub());
    await expect(service.downgradePlan('ws_1', 'u', { targetPlan: 'max' })).rejects.toThrow(/lower/);
    expect(prisma.workspaceSubscription.update).not.toHaveBeenCalled();
  });

  it('has nothing to reactivate unless a change is pending', async () => {
    const { service } = build(paidSub());
    await expect(service.reactivateSubscription('ws_1')).rejects.toThrow(/no pending/);
  });

  it('needs a payment profile before opening the provider portal', async () => {
    const { service, prisma } = build(paidSub(), true);
    prisma.workspaceSubscription.findUnique.mockResolvedValue({ providerCustomerId: null, workspace: { slug: 'acme' } });
    await expect(service.createPortalSession('ws_1')).rejects.toThrow(/payment profile/);
  });
});

describe('BillingService.getInvoices', () => {
  it('returns recorded invoices only — never fabricated ones', async () => {
    const { service, prisma } = build(paidSub());
    expect(await service.getInvoices('ws_1')).toEqual([]);
    prisma.billingInvoice.findMany.mockResolvedValue([
      { id: 'i1', number: 'INV-1', amountCents: 3000, currency: 'USD', status: 'PAID', description: 'Pro plan',
        periodStart: new Date('2026-10-01'), periodEnd: new Date('2026-11-01'), pdfUrl: null, hostedUrl: 'https://x' },
    ]);
    const [inv] = await service.getInvoices('ws_1');
    expect(inv).toMatchObject({ invoiceNumber: 'INV-1', amountCents: 3000, status: 'PAID', hostedUrl: 'https://x' });
    expect(prisma.billingInvoice.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: 'ws_1' } }));
  });
});
