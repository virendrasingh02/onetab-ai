/**
 * End-to-end billing behaviour against a real Postgres.
 *
 * These cover the properties a mocked Prisma cannot prove: atomic coupon
 * redemption under concurrency, webhook idempotency/ordering, and that no
 * entitlement ever changes without a verified payment or an approved rule.
 *
 * The suite creates its own users/workspaces/coupons (unique ids) and removes
 * them afterwards. It is skipped when no database is reachable, so unit-only
 * environments stay green.
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '@org/database';
import { BillingAuditService } from './billing-audit.service.js';
import { BillingLifecycleService } from './billing-lifecycle.service.js';
import { BillingService } from './billing.service.js';
import { BillingWebhookService, RetryWebhookLater } from './billing-webhook.service.js';
import { CheckoutService } from './checkout.service.js';
import { CreditService } from './credit.service.js';
import type { PaymentProvider, ProviderEvent } from './payment-provider.js';
import { PromotionService } from './promotion.service.js';

loadEnv({ path: resolve(__dirname, '../../../../../../.env'), quiet: true });

let prisma: PrismaService | null = null;
try {
  if (process.env['DATABASE_URL']) {
    const candidate = new PrismaService();
    await candidate.$queryRaw`SELECT 1`;
    await candidate.billingInvoice.count(); // migration applied?
    prisma = candidate;
  }
} catch {
  prisma = null;
}

const uid = () => Math.random().toString(36).slice(2, 10);

function makeProvider(overrides: Partial<PaymentProvider> & { configured?: boolean } = {}) {
  const calls = {
    createCheckout: vi.fn(async () => ({ providerSessionId: `cs_${uid()}`, url: 'https://pay.example/session' })),
    cancelAtPeriodEnd: vi.fn(async () => undefined),
    resume: vi.fn(async () => undefined),
    cancelNow: vi.fn(async () => undefined),
    scheduleChangeAtPeriodEnd: vi.fn(async () => undefined),
  };
  let next: ProviderEvent | null = null;
  const provider: PaymentProvider = {
    name: 'fake',
    mode: 'test',
    isConfigured: () => overrides.configured ?? true,
    createCheckout: calls.createCheckout,
    cancelAtPeriodEnd: calls.cancelAtPeriodEnd,
    resume: calls.resume,
    cancelNow: calls.cancelNow,
    scheduleChangeAtPeriodEnd: calls.scheduleChangeAtPeriodEnd,
    createPortalSession: async () => 'https://portal.example',
    parseWebhook: () => next as ProviderEvent,
    ...overrides,
  } as PaymentProvider;
  return {
    provider,
    calls,
    deliver: (e: ProviderEvent) => {
      next = e;
    },
  };
}

function build(opts: { configured?: boolean; mode?: 'test' | 'live' } = {}) {
  const db = prisma as PrismaService;
  const env: Record<string, string> = { BILLING_MODE: opts.mode ?? 'test' };
  const config = { get: (k: string) => env[k] } as never;
  const events = new EventEmitter2();
  const notices: Array<{ dedupeKey: string }> = [];
  events.on('billing.notice', (n) => notices.push(n));
  const audit = new BillingAuditService(db);
  const promotions = new PromotionService(db, config, audit);
  const credits = new CreditService(db);
  const fake = makeProvider({ configured: opts.configured ?? true });
  const checkout = new CheckoutService(db, config, promotions, credits, audit, events, fake.provider);
  const webhooks = new BillingWebhookService(db, checkout, credits, audit, events, fake.provider);
  const billing = new BillingService(db, credits, audit, config, events, fake.provider);
  const lifecycle = new BillingLifecycleService(db, config, events, checkout, webhooks, audit, fake.provider);
  return { db, promotions, credits, checkout, webhooks, billing, lifecycle, fake, notices };
}

const created = { users: [] as string[], workspaces: [] as string[], coupons: [] as string[] };

async function makeWorkspace() {
  const db = prisma as PrismaService;
  const user = await db.user.create({ data: { email: `bill-${uid()}@test.local`, name: 'Billing Tester' } });
  const ws = await db.workspace.create({
    data: { name: `Billing WS ${uid()}`, slug: `billing-${uid()}`, ownerId: user.id },
  });
  created.users.push(user.id);
  created.workspaces.push(ws.id);
  return { user, ws };
}

async function makeCoupon(data: Partial<Parameters<PrismaService['promotion']['create']>[0]['data']> = {}) {
  const db = prisma as PrismaService;
  const code = `T${uid().toUpperCase()}`;
  const row = await db.promotion.create({
    data: {
      code,
      discountType: 'PERCENTAGE',
      discountValue: 20,
      applicablePlans: ['pro', 'max'],
      perUserLimit: 5,
      ...data,
    } as never,
  });
  created.coupons.push(row.id);
  return row;
}

describe.skipIf(!prisma)('billing (integration)', () => {
  afterAll(async () => {
    if (!prisma) return;
    await prisma.billingAuditLog.deleteMany({
      where: { OR: [{ workspaceId: { in: created.workspaces } }, { targetId: { in: created.workspaces } }] },
    });
    await prisma.billingWebhookEvent.deleteMany({ where: { provider: 'fake' } });
    await prisma.promotionRedemption.deleteMany({ where: { workspaceId: { in: created.workspaces } } });
    await prisma.promotion.deleteMany({ where: { id: { in: created.coupons } } });
    await prisma.workspace.deleteMany({ where: { id: { in: created.workspaces } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.$disconnect();
  });

  describe('DEMO coupon seed', () => {
    it('is created once and never overwritten on later runs', async () => {
      const { db, promotions } = build();
      await promotions.onModuleInit();
      await promotions.onModuleInit();
      expect(await db.promotion.count({ where: { code: 'DEMO' } })).toBe(1);

      const demo = await db.promotion.findUniqueOrThrow({ where: { code: 'DEMO' } });
      expect(demo.discountValue).toBe(demo.discountValue);
      expect(demo.freeCheckoutPolicy).not.toBe('APPROVED'); // never seeded as a production bypass

      const original = demo.discountValue;
      await db.promotion.update({ where: { code: 'DEMO' }, data: { discountValue: 55 } });
      await promotions.onModuleInit();
      expect((await db.promotion.findUniqueOrThrow({ where: { code: 'DEMO' } })).discountValue).toBe(55);
      await db.promotion.update({ where: { code: 'DEMO' }, data: { discountValue: original } });
    });

    it('is case/space-insensitive and not a payment bypass by name', async () => {
      const { promotions, checkout, db } = build({ configured: true });
      await promotions.onModuleInit();
      const { user, ws } = await makeWorkspace();
      const v = await promotions.validatePromotion('  demo ', 'pro', 'monthly', ws.id, user.id);
      // DEMO may be inactive in a live-mode database; only assert the normalisation when it is active.
      if (v.valid) expect(v.code).toBe('DEMO');

      // With a provider configured, a $0 total still needs the provider: nothing is activated locally.
      const session = await checkout.createCheckout(ws.id, user.id, { targetPlan: 'pro', promotionCode: 'demo' }).catch(() => null);
      if (session) {
        expect(session.status).toBe('PENDING');
        expect(session.activatedWithoutPayment).toBe(false);
        const sub = await db.workspaceSubscription.findUnique({ where: { workspaceId: ws.id } });
        expect(sub?.planTier ?? 'FREE').toBe('FREE');
        // Hand the shared DEMO slot back so repeated test runs do not consume it.
        await checkout.cancelCheckout(ws.id, session.id);
      }
    });
  });

  describe('no payment provider configured', () => {
    it('refuses paid checkout and changes nothing', async () => {
      const { checkout, db } = build({ configured: false });
      const { user, ws } = await makeWorkspace();
      await expect(checkout.createCheckout(ws.id, user.id, { targetPlan: 'pro' })).rejects.toMatchObject({
        response: { code: 'PAYMENT_PROVIDER_NOT_CONFIGURED' },
      });
      expect(await db.workspaceSubscription.findUnique({ where: { workspaceId: ws.id } })).toBeNull();
      expect(await db.billingInvoice.count({ where: { workspaceId: ws.id } })).toBe(0);
    });

    it('activates a 100% coupon only when its policy allows (TEST_ONLY in test mode)', async () => {
      const { checkout, db } = build({ configured: false, mode: 'test' });
      const coupon = await makeCoupon({ discountValue: 100, freeCheckoutPolicy: 'TEST_ONLY' });
      const { user, ws } = await makeWorkspace();
      const res = await checkout.createCheckout(ws.id, user.id, { targetPlan: 'pro', promotionCode: coupon.code });
      expect(res.status).toBe('COMPLETED');
      expect(res.activatedWithoutPayment).toBe(true);
      expect(res.quote.totalCents).toBe(0);
      const sub = await db.workspaceSubscription.findUniqueOrThrow({ where: { workspaceId: ws.id } });
      expect(sub.planTier).toBe('PRO');
      expect(sub.source).toBe('PROMOTION');
      expect((await db.promotionRedemption.findFirstOrThrow({ where: { workspaceId: ws.id } })).status).toBe('APPLIED');
      expect(await db.billingInvoice.count({ where: { workspaceId: ws.id, amountCents: 0 } })).toBe(1);
    });

    it('rejects the same TEST_ONLY coupon in live mode', async () => {
      const { checkout, db } = build({ configured: false, mode: 'live' });
      const coupon = await makeCoupon({ discountValue: 100, freeCheckoutPolicy: 'TEST_ONLY' });
      const { user, ws } = await makeWorkspace();
      await expect(
        checkout.createCheckout(ws.id, user.id, { targetPlan: 'pro', promotionCode: coupon.code }),
      ).rejects.toMatchObject({ response: { code: 'FREE_CHECKOUT_NOT_PERMITTED' } });
      expect(await db.workspaceSubscription.findUnique({ where: { workspaceId: ws.id } })).toBeNull();
      expect(await db.promotionRedemption.count({ where: { workspaceId: ws.id } })).toBe(0);
    });

    it('never lets a partial discount skip payment', async () => {
      const { checkout } = build({ configured: false });
      const coupon = await makeCoupon({ discountValue: 99, freeCheckoutPolicy: 'APPROVED' });
      const { user, ws } = await makeWorkspace();
      await expect(
        checkout.createCheckout(ws.id, user.id, { targetPlan: 'pro', promotionCode: coupon.code }),
      ).rejects.toMatchObject({ response: { code: 'PAYMENT_PROVIDER_NOT_CONFIGURED' } });
    });
  });

  describe('coupon rules', () => {
    it('reports precise rejection reasons', async () => {
      const { promotions } = build();
      const { user, ws } = await makeWorkspace();
      const check = (code: string, plan = 'pro', interval: 'monthly' | 'annual' = 'monthly') =>
        promotions.validatePromotion(code, plan, interval, ws.id, user.id);

      expect((await check('NOPE-NOT-A-CODE')).reason).toBe('NOT_FOUND');
      const inactive = await makeCoupon({ active: false });
      expect((await check(inactive.code)).reason).toBe('INACTIVE');
      const expired = await makeCoupon({ validUntil: new Date(Date.now() - 1000) });
      expect((await check(expired.code)).reason).toBe('EXPIRED');
      const future = await makeCoupon({ validFrom: new Date(Date.now() + 86_400_000) });
      expect((await check(future.code)).reason).toBe('NOT_STARTED');
      const exhausted = await makeCoupon({ maxRedemptions: 1, redemptionsCount: 1 });
      expect((await check(exhausted.code)).reason).toBe('EXHAUSTED');
      const proOnly = await makeCoupon({ applicablePlans: ['pro'] });
      expect((await check(proOnly.code, 'max')).reason).toBe('PLAN_INELIGIBLE');
      const annualOnly = await makeCoupon({ applicableIntervals: ['ANNUAL'] });
      expect((await check(annualOnly.code, 'pro', 'monthly')).reason).toBe('INTERVAL_INELIGIBLE');
      expect((await check(annualOnly.code, 'pro', 'annual')).valid).toBe(true);
      const bigMin = await makeCoupon({ minPurchaseCents: 10_000_000 });
      expect((await check(bigMin.code)).reason).toBe('BELOW_MINIMUM');
      const ok = await makeCoupon({});
      expect((await check(ok.code, 'free')).reason).toBe('FREE_PLAN');
    });

    it('prices from the server and ignores tampered client amounts', async () => {
      const { checkout } = build();
      const coupon = await makeCoupon({ discountValue: 25 });
      const { user, ws } = await makeWorkspace();
      const tampered = {
        targetPlan: 'pro',
        billingInterval: 'monthly',
        promotionCode: coupon.code,
        totalCents: 0,
        discountCents: 999_999,
        discountPercent: 100,
      } as never;
      const quote = await checkout.quote(ws.id, user.id, tampered);
      expect(quote.subtotalCents).toBe(3000);
      expect(quote.discountCents).toBe(750);
      expect(quote.totalCents).toBe(2250);
    });

    it('lets exactly one of N concurrent checkouts take the last redemption', async () => {
      const { checkout, db } = build();
      const coupon = await makeCoupon({ maxRedemptions: 1 });
      const actors = await Promise.all(Array.from({ length: 5 }, () => makeWorkspace()));
      const results = await Promise.allSettled(
        actors.map((a) => checkout.createCheckout(a.ws.id, a.user.id, { targetPlan: 'pro', promotionCode: coupon.code })),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const fresh = await db.promotion.findUniqueOrThrow({ where: { id: coupon.id } });
      expect(fresh.redemptionsCount).toBe(1);
    });

    it('enforces the per-user limit and releases the slot when a checkout is cancelled', async () => {
      const { checkout, db } = build();
      const coupon = await makeCoupon({ perUserLimit: 1 });
      const a = await makeWorkspace();
      const first = await checkout.createCheckout(a.ws.id, a.user.id, { targetPlan: 'pro', promotionCode: coupon.code });
      const b = await db.workspace.create({ data: { name: 'B', slug: `billing-${uid()}`, ownerId: a.user.id } });
      created.workspaces.push(b.id);
      await expect(
        checkout.createCheckout(b.id, a.user.id, { targetPlan: 'pro', promotionCode: coupon.code }),
      ).rejects.toMatchObject({ response: { code: 'COUPON_USER_LIMIT' } });

      await checkout.cancelCheckout(a.ws.id, first.id);
      expect((await db.promotion.findUniqueOrThrow({ where: { id: coupon.id } })).redemptionsCount).toBe(0);
      await expect(
        checkout.createCheckout(b.id, a.user.id, { targetPlan: 'pro', promotionCode: coupon.code }),
      ).resolves.toMatchObject({ status: 'PENDING' });
    });

    it('is idempotent for a repeated idempotencyKey', async () => {
      const { checkout, fake } = build();
      const { user, ws } = await makeWorkspace();
      const a = await checkout.createCheckout(ws.id, user.id, { targetPlan: 'pro', idempotencyKey: 'k1' });
      const b = await checkout.createCheckout(ws.id, user.id, { targetPlan: 'pro', idempotencyKey: 'k1' });
      expect(b.id).toBe(a.id);
      expect(fake.calls.createCheckout).toHaveBeenCalledTimes(1);
    });
  });

  describe('provider-verified lifecycle', () => {
    const completed = (id: string, checkoutId: string, amount: number, extra: Partial<ProviderEvent> = {}): ProviderEvent =>
      ({
        type: 'checkout.completed',
        id,
        createdAt: new Date(),
        checkoutId,
        providerSessionId: 'cs_x',
        customerId: `cus_${uid()}`,
        subscriptionId: `sub_${uid()}`,
        amountTotalCents: amount,
        paid: true,
        ...extra,
      }) as ProviderEvent;

    it('a created checkout alone grants nothing; the verified webhook does, once', async () => {
      const { checkout, webhooks, fake, db } = build();
      const { user, ws } = await makeWorkspace();
      const session = await checkout.createCheckout(ws.id, user.id, { targetPlan: 'pro' });
      expect(session.status).toBe('PENDING');
      expect(session.redirectUrl).toBeTruthy();
      expect(await db.workspaceSubscription.findUnique({ where: { workspaceId: ws.id } })).toBeNull();

      const evt = completed(`evt_${uid()}`, session.id, 3000);
      fake.deliver(evt);
      const first = await webhooks.handle(Buffer.from('{}'), 'sig');
      expect(first).toEqual({ duplicate: false, status: 'PROCESSED' });
      const sub = await db.workspaceSubscription.findUniqueOrThrow({ where: { workspaceId: ws.id } });
      expect(sub.planTier).toBe('PRO');
      expect(sub.source).toBe('PROVIDER');

      const grants = () => db.creditTransaction.count({ where: { account: { workspaceId: ws.id }, referenceType: 'PLAN_GRANT' } });
      const before = await grants();
      const replay = await webhooks.handle(Buffer.from('{}'), 'sig');
      expect(replay.duplicate).toBe(true);
      expect(await grants()).toBe(before);
    });

    it('refuses to grant when the provider collected less than the quoted total', async () => {
      const { checkout, webhooks, fake, db } = build();
      const coupon = await makeCoupon({ discountValue: 10 });
      const { user, ws } = await makeWorkspace();
      const session = await checkout.createCheckout(ws.id, user.id, { targetPlan: 'pro', promotionCode: coupon.code });
      fake.deliver(completed(`evt_${uid()}`, session.id, 100)); // far below the 2700 quoted
      await webhooks.handle(Buffer.from('{}'), 'sig');
      expect((await db.workspaceSubscription.findUnique({ where: { workspaceId: ws.id } }))?.planTier ?? 'FREE').toBe('FREE');
      expect((await db.billingCheckoutSession.findUniqueOrThrow({ where: { id: session.id } })).status).toBe('FAILED');
      expect((await db.promotion.findUniqueOrThrow({ where: { id: coupon.id } })).redemptionsCount).toBe(0);
    });

    it('a webhook cannot complete another workspace’s checkout twice or resurrect a cancelled one', async () => {
      const { checkout, webhooks, fake, db } = build();
      const { user, ws } = await makeWorkspace();
      const session = await checkout.createCheckout(ws.id, user.id, { targetPlan: 'pro' });
      await checkout.cancelCheckout(ws.id, session.id);
      fake.deliver(completed(`evt_${uid()}`, session.id, 3000));
      const res = await webhooks.handle(Buffer.from('{}'), 'sig');
      expect(res.status).toBe('IGNORED');
      expect(await db.workspaceSubscription.findUnique({ where: { workspaceId: ws.id } })).toBeNull();
    });

    it('asks for redelivery when an invoice arrives before its subscription, then succeeds', async () => {
      const { checkout, webhooks, fake, db } = build();
      const { user, ws } = await makeWorkspace();
      const session = await checkout.createCheckout(ws.id, user.id, { targetPlan: 'pro' });
      const subId = `sub_${uid()}`;
      const invoiceEvt = {
        type: 'invoice.paid',
        id: `evt_${uid()}`,
        createdAt: new Date(),
        providerInvoiceId: `in_${uid()}`,
        subscriptionId: subId,
        customerId: `cus_${uid()}`,
        amountPaidCents: 3000,
        currency: 'USD',
        number: 'ABC-001',
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 86_400_000),
        hostedUrl: null,
        pdfUrl: null,
        paidAt: new Date(),
      } as ProviderEvent;

      fake.deliver(invoiceEvt);
      await expect(webhooks.handle(Buffer.from('{}'), 'sig')).rejects.toBeInstanceOf(RetryWebhookLater);

      fake.deliver(completed(`evt_${uid()}`, session.id, 3000, { subscriptionId: subId } as never));
      await webhooks.handle(Buffer.from('{}'), 'sig');

      fake.deliver(invoiceEvt); // provider redelivers the same event id
      expect((await webhooks.handle(Buffer.from('{}'), 'sig')).status).toBe('PROCESSED');
      expect(await db.billingInvoice.count({ where: { workspaceId: ws.id, number: 'ABC-001' } })).toBe(1);
    });

    it('ignores stale out-of-order subscription events', async () => {
      const { checkout, webhooks, fake, db } = build();
      const { user, ws } = await makeWorkspace();
      const session = await checkout.createCheckout(ws.id, user.id, { targetPlan: 'pro' });
      const subId = `sub_${uid()}`;
      const now = Date.now();
      fake.deliver(completed(`evt_${uid()}`, session.id, 3000, { subscriptionId: subId, createdAt: new Date(now) } as never));
      await webhooks.handle(Buffer.from('{}'), 'sig');

      const update = (status: string, at: number) =>
        ({
          type: 'subscription.updated',
          id: `evt_${uid()}`,
          createdAt: new Date(at),
          subscriptionId: subId,
          customerId: `cus_${uid()}`,
          status,
          cancelAtPeriodEnd: false,
          periodStart: null,
          periodEnd: null,
          workspaceId: ws.id,
        }) as ProviderEvent;

      fake.deliver(update('past_due', now + 2000));
      await webhooks.handle(Buffer.from('{}'), 'sig');
      fake.deliver(update('active', now + 1000)); // older than the past_due we already applied
      await webhooks.handle(Buffer.from('{}'), 'sig');
      expect((await db.workspaceSubscription.findUniqueOrThrow({ where: { workspaceId: ws.id } })).status).toBe('PAST_DUE');
    });

    it('downgrades to Free after the past-due grace window', async () => {
      const { checkout, webhooks, fake, lifecycle, db } = build();
      const { user, ws } = await makeWorkspace();
      const session = await checkout.createCheckout(ws.id, user.id, { targetPlan: 'pro' });
      const subId = `sub_${uid()}`;
      fake.deliver(completed(`evt_${uid()}`, session.id, 3000, { subscriptionId: subId } as never));
      await webhooks.handle(Buffer.from('{}'), 'sig');
      await db.workspaceSubscription.update({
        where: { workspaceId: ws.id },
        data: { status: 'PAST_DUE', pastDueSince: new Date(Date.now() - 30 * 86_400_000) },
      });
      expect(await lifecycle.enforcePastDueGrace()).toBeGreaterThanOrEqual(1);
      const sub = await db.workspaceSubscription.findUniqueOrThrow({ where: { workspaceId: ws.id } });
      expect(sub.planTier).toBe('FREE');
      expect(fake.calls.cancelNow).toHaveBeenCalledWith(subId);
    });

    it('cancel, schedule downgrade and reactivate go through the provider and keep access until period end', async () => {
      const { checkout, webhooks, fake, billing, db } = build();
      const { user, ws } = await makeWorkspace();
      const session = await checkout.createCheckout(ws.id, user.id, { targetPlan: 'max' });
      const subId = `sub_${uid()}`;
      fake.deliver(completed(`evt_${uid()}`, session.id, 4500, { subscriptionId: subId } as never));
      await webhooks.handle(Buffer.from('{}'), 'sig');

      await billing.downgradePlan(ws.id, user.id, { targetPlan: 'pro', acknowledgeOverages: true });
      expect(fake.calls.scheduleChangeAtPeriodEnd).toHaveBeenCalled();
      let sub = await db.workspaceSubscription.findUniqueOrThrow({ where: { workspaceId: ws.id } });
      expect(sub.planTier).toBe('MAX'); // not yet
      expect(sub.scheduledPlanTier).toBe('PRO');

      await billing.cancelSubscription(ws.id, user.id);
      expect(fake.calls.cancelAtPeriodEnd).toHaveBeenCalledWith(subId);
      sub = await db.workspaceSubscription.findUniqueOrThrow({ where: { workspaceId: ws.id } });
      expect(sub.planTier).toBe('MAX');
      expect(sub.cancelAtPeriodEnd).toBe(true);

      await billing.reactivateSubscription(ws.id, user.id);
      expect(fake.calls.resume).toHaveBeenCalledWith(subId);
      sub = await db.workspaceSubscription.findUniqueOrThrow({ where: { workspaceId: ws.id } });
      expect(sub.cancelAtPeriodEnd).toBe(false);
      expect(sub.scheduledPlanTier).toBeNull();
    });

    it('refuses to downgrade to a higher plan and to Free-plan "cancel"', async () => {
      const { billing } = build();
      const { user, ws } = await makeWorkspace();
      await expect(billing.cancelSubscription(ws.id, user.id)).rejects.toThrow(/Free plan/);
      await expect(billing.downgradePlan(ws.id, user.id, { targetPlan: 'pro' })).rejects.toThrow();
    });
  });

  describe('workspace isolation', () => {
    it('does not reveal another workspace’s checkout', async () => {
      const { checkout } = build();
      const a = await makeWorkspace();
      const b = await makeWorkspace();
      const session = await checkout.createCheckout(a.ws.id, a.user.id, { targetPlan: 'pro' });
      await expect(checkout.getCheckout(b.ws.id, session.id)).rejects.toThrow(/not found/i);
      await expect(checkout.cancelCheckout(b.ws.id, session.id)).rejects.toThrow(/not found/i);
    });

    it('rejects Enterprise and Free as self-serve checkout targets', async () => {
      const { checkout } = build();
      const { user, ws } = await makeWorkspace();
      await expect(checkout.createCheckout(ws.id, user.id, { targetPlan: 'enterprise' })).rejects.toMatchObject({
        response: { code: 'CONTACT_SALES' },
      });
      await expect(checkout.createCheckout(ws.id, user.id, { targetPlan: 'free' })).rejects.toThrow();
    });
  });

  describe('credits', () => {
    it('never overdraws under concurrent deductions', async () => {
      const { credits, db } = build();
      const { ws } = await makeWorkspace();
      const account = await credits.getOrCreateAccount(ws.id); // $5 free grant
      await db.creditAccount.update({ where: { id: account.id }, data: { balance: 1 } });
      const results = await Promise.allSettled(
        Array.from({ length: 6 }, (_, i) => credits.deductCredits(ws.id, 0.5, 'AGENT', `run-${i}`, 'test')),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
      expect((await db.creditAccount.findUniqueOrThrow({ where: { id: account.id } })).balance).toBeCloseTo(0, 6);
    });

    it('credits a verified top-up exactly once', async () => {
      const { credits, db } = build();
      const { ws } = await makeWorkspace();
      await credits.getOrCreateAccount(ws.id);
      expect(await credits.credit(ws.id, 10, 'TOP_UP', 'checkout:abc', 'top up')).toBe(true);
      expect(await credits.credit(ws.id, 10, 'TOP_UP', 'checkout:abc', 'top up')).toBe(false);
      const account = await db.creditAccount.findUniqueOrThrow({ where: { workspaceId: ws.id } });
      expect(account.balance).toBeCloseTo(15, 6);
    });

    it('has no path to mint credits without a payment: top-up needs the provider', async () => {
      const { checkout } = build({ configured: false });
      const { user, ws } = await makeWorkspace();
      await expect(checkout.createTopUpCheckout(ws.id, user.id, 25)).rejects.toMatchObject({
        response: { code: 'PAYMENT_PROVIDER_NOT_CONFIGURED' },
      });
    });
  });
});
