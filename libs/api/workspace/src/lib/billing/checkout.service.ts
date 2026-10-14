import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvent } from '@org/api-common';
import { Prisma, PrismaService } from '@org/database';
import {
  PLANS_CONFIG,
  PLAN_HIERARCHY,
  normalizePlanTier,
  type CheckoutPlanInput,
  type CheckoutQuote,
  type CheckoutSessionDto,
  type CheckoutStatus,
  type PlanBillingInterval,
} from '@org/types';
import { BillingAuditService } from './billing-audit.service.js';
import { resolveBillingMode } from './billing-mode.js';
import { CreditService } from './credit.service.js';
import { PAYMENT_PROVIDER, PaymentProviderError, type PaymentProvider } from './payment-provider.js';
import { PromotionService, normalizeCouponCode } from './promotion.service.js';

type CheckoutRow = Prisma.BillingCheckoutSessionGetPayload<object>;

const CHECKOUT_TTL_MS = 24 * 60 * 60 * 1000;
export const MIN_TOPUP_CENTS = 500;
export const MAX_TOPUP_CENTS = 100_000;

export function addInterval(from: Date, interval: PlanBillingInterval): Date {
  const d = new Date(from);
  if (interval === 'annual') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

export function invoiceNumber(date = new Date()): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}-${rand}`;
}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly promotions: PromotionService,
    private readonly credits: CreditService,
    private readonly audit: BillingAuditService,
    private readonly events: EventEmitter2,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  get billingMode(): 'test' | 'live' {
    return resolveBillingMode(this.config);
  }

  private get webBase(): string {
    return (
      this.config.get<string>('WEB_APP_URL') ||
      this.config.get<string>('APP_URL') ||
      'http://localhost:4200'
    ).replace(/\/+$/, '');
  }

  toDto(row: CheckoutRow): CheckoutSessionDto {
    return {
      id: row.id,
      status: row.status as CheckoutStatus,
      quote: this.rowQuote(row),
      redirectUrl: row.status === 'PENDING' ? row.providerUrl : null,
      activatedWithoutPayment: row.status === 'COMPLETED' && !row.provider,
      failureReason: row.failureReason,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }

  private rowQuote(row: CheckoutRow): CheckoutQuote {
    return {
      planTier: normalizePlanTier(row.planTier),
      billingInterval: row.billingInterval === 'annual' ? 'annual' : 'monthly',
      currency: row.currency,
      subtotalCents: row.subtotalCents,
      discountCents: row.discountCents,
      taxCents: row.taxCents,
      totalCents: row.totalCents,
      renewalCents: row.subtotalCents,
      trialDays: row.trialDays,
      dueNowCents: row.trialDays > 0 ? 0 : row.totalCents,
      taxCalculatedByProvider: this.config.get<string>('STRIPE_AUTOMATIC_TAX') === 'true',
      promotionCode: row.promotionCode,
    };
  }

  /** Validates plan/interval and returns the server-authoritative price, without side effects. */
  async quote(workspaceId: string, userId: string, input: CheckoutPlanInput): Promise<CheckoutQuote> {
    const { plan, interval, trialDays } = await this.resolveTarget(workspaceId, input);
    if (input.promotionCode?.trim()) {
      const res = await this.promotions.evaluate(input.promotionCode, {
        planTier: plan,
        billingInterval: interval,
        workspaceId,
        userId,
        trialDays,
      });
      if (!res.ok) throw new BadRequestException({ code: `COUPON_${res.reason}`, message: res.message });
      return res.quote;
    }
    return this.promotions.buildQuote({ planTier: plan, billingInterval: interval }, null, trialDays);
  }

  private async resolveTarget(workspaceId: string, input: CheckoutPlanInput) {
    const plan = normalizePlanTier(input.targetPlan);
    if (plan === 'free') {
      throw new BadRequestException('The Free plan needs no checkout — use cancel or downgrade instead.');
    }
    if (PLANS_CONFIG[plan].isCustomQuote) {
      throw new BadRequestException({
        code: 'CONTACT_SALES',
        message: 'Enterprise plans are arranged with our sales team. Please contact sales.',
      });
    }
    const interval: PlanBillingInterval = input.billingInterval === 'annual' ? 'annual' : 'monthly';

    const sub = await this.prisma.workspaceSubscription.findUnique({ where: { workspaceId } });
    const currentPlan = normalizePlanTier(sub?.planTier);
    const hasPaidAccess = !!sub && currentPlan !== 'free' && sub.source !== 'FREE';
    if (hasPaidAccess && PLAN_HIERARCHY[plan] < PLAN_HIERARCHY[currentPlan]) {
      throw new BadRequestException('To move to a lower plan, schedule a downgrade from Billing settings.');
    }
    if (
      hasPaidAccess &&
      plan === currentPlan &&
      (sub.billingInterval.toLowerCase() === 'annual' ? 'annual' : 'monthly') === interval &&
      !sub.cancelAtPeriodEnd &&
      !['PAST_DUE', 'UNPAID'].includes(sub.status)
    ) {
      throw new ConflictException('This workspace is already on that plan and billing interval.');
    }

    const planTrial = PLANS_CONFIG[plan].trialDays ?? 0;
    const trialEligible =
      !!input.startTrial && planTrial > 0 && !sub?.trialUsed && !hasPaidAccess && this.provider.isConfigured();
    return { plan, interval, trialDays: trialEligible ? planTrial : 0, sub, currentPlan };
  }

  async createCheckout(workspaceId: string, userId: string, input: CheckoutPlanInput): Promise<CheckoutSessionDto> {
    const idemKey = input.idempotencyKey ? `${workspaceId}:${userId}:${input.idempotencyKey}`.slice(0, 200) : null;
    if (idemKey) {
      const prior = await this.prisma.billingCheckoutSession.findUnique({ where: { idempotencyKey: idemKey } });
      if (prior) return this.toDto(prior);
    }

    const { plan, interval, trialDays, sub } = await this.resolveTarget(workspaceId, input);

    let promo: Prisma.PromotionGetPayload<object> | null = null;
    let quote: CheckoutQuote;
    if (input.promotionCode?.trim()) {
      const res = await this.promotions.evaluate(input.promotionCode, {
        planTier: plan,
        billingInterval: interval,
        workspaceId,
        userId,
        trialDays,
      });
      if (!res.ok) throw new BadRequestException({ code: `COUPON_${res.reason}`, message: res.message });
      promo = res.promo;
      quote = res.quote;
    } else {
      quote = this.promotions.buildQuote({ planTier: plan, billingInterval: interval }, null, trialDays);
    }

    // Decide *how* this can be paid before touching any state.
    const providerReady = this.provider.isConfigured();
    let activateWithoutPayment = false;
    if (!providerReady) {
      if (quote.totalCents > 0 || quote.trialDays > 0) {
        throw new ServiceUnavailableException({
          code: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
          message:
            'Online payments are not enabled on this deployment yet. Configure a payment provider to subscribe to a paid plan.',
        });
      }
      const policy = promo?.freeCheckoutPolicy ?? 'DISABLED';
      const allowed = policy === 'APPROVED' || (policy === 'TEST_ONLY' && this.billingMode === 'test');
      if (!promo || !allowed) {
        throw new ForbiddenException({
          code: 'FREE_CHECKOUT_NOT_PERMITTED',
          message:
            'This coupon cannot activate a plan without a payment provider in this environment.',
        });
      }
      activateWithoutPayment = true;
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { slug: true } });
    if (!workspace) throw new NotFoundException('Workspace not found.');

    // One open checkout per workspace: a new attempt supersedes (and releases) the old one.
    const stale = await this.prisma.billingCheckoutSession.findMany({
      where: { workspaceId, status: 'PENDING', kind: 'SUBSCRIPTION' },
      select: { id: true },
    });

    const session = await this.prisma.$transaction(async (tx) => {
      for (const s of stale) {
        await tx.billingCheckoutSession.updateMany({
          where: { id: s.id, status: 'PENDING' },
          data: { status: 'CANCELLED', failureReason: 'Superseded by a newer checkout' },
        });
        await this.promotions.release(s.id, tx);
      }
      const row = await tx.billingCheckoutSession.create({
        data: {
          workspaceId,
          userId,
          kind: 'SUBSCRIPTION',
          planTier: plan,
          billingInterval: interval,
          trialDays: quote.trialDays,
          currency: quote.currency,
          subtotalCents: quote.subtotalCents,
          discountCents: quote.discountCents,
          taxCents: quote.taxCents,
          totalCents: quote.totalCents,
          promotionCode: promo ? normalizeCouponCode(promo.code) : null,
          provider: activateWithoutPayment ? null : this.provider.name,
          idempotencyKey: idemKey,
          expiresAt: new Date(Date.now() + CHECKOUT_TTL_MS),
        },
      });
      if (promo) {
        await this.promotions.reserve(tx, promo, {
          workspaceId,
          userId,
          checkoutId: row.id,
          discountCents: quote.discountCents,
        });
      }
      return row;
    });

    await this.audit.record({
      action: 'CHECKOUT_STARTED',
      targetType: 'checkout',
      targetId: session.id,
      workspaceId,
      actorId: userId,
      details: { plan, interval, totalCents: quote.totalCents, coupon: session.promotionCode, mode: this.billingMode },
    });

    if (activateWithoutPayment) {
      await this.completeSubscriptionCheckout(session.id, { source: 'PROMOTION', amountPaidCents: 0 });
      const done = await this.prisma.billingCheckoutSession.findUniqueOrThrow({ where: { id: session.id } });
      return this.toDto(done);
    }

    try {
      const result = await this.provider.createCheckout({
        checkoutId: session.id,
        workspaceId,
        kind: 'SUBSCRIPTION',
        planTier: plan,
        billingInterval: interval,
        currency: quote.currency,
        productName: `${PLANS_CONFIG[plan].name} plan (${interval === 'annual' ? 'annual' : 'monthly'})`,
        unitAmountCents: quote.subtotalCents,
        discountCents: quote.discountCents,
        couponLabel: session.promotionCode,
        trialDays: quote.trialDays,
        customerEmail: user?.email,
        existingCustomerId: sub?.providerCustomerId,
        successUrl: `${this.webBase}/w/${workspace.slug}/settings/billing?checkout=success&session=${session.id}`,
        cancelUrl: `${this.webBase}/w/${workspace.slug}/settings/billing?checkout=cancelled&session=${session.id}`,
        idempotencyKey: `checkout:${session.id}`,
      });
      const updated = await this.prisma.billingCheckoutSession.update({
        where: { id: session.id },
        data: { providerSessionId: result.providerSessionId, providerUrl: result.url },
      });
      return this.toDto(updated);
    } catch (err) {
      await this.failCheckout(session.id, 'FAILED', err instanceof Error ? err.message : 'Payment provider error');
      if (err instanceof PaymentProviderError) {
        throw new HttpException(
          { code: 'PAYMENT_PROVIDER_ERROR', message: 'The payment provider is unavailable. Please try again shortly.' },
          err.retryable ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.BAD_GATEWAY,
        );
      }
      throw err;
    }
  }

  async getCheckout(workspaceId: string, id: string): Promise<CheckoutSessionDto> {
    const row = await this.prisma.billingCheckoutSession.findFirst({ where: { id, workspaceId } });
    if (!row) throw new NotFoundException('Checkout not found.');
    return this.toDto(row);
  }

  async cancelCheckout(workspaceId: string, id: string): Promise<CheckoutSessionDto> {
    const row = await this.prisma.billingCheckoutSession.findFirst({ where: { id, workspaceId } });
    if (!row) throw new NotFoundException('Checkout not found.');
    if (row.status === 'PENDING') await this.failCheckout(id, 'CANCELLED', 'Cancelled by the customer');
    return this.toDto(await this.prisma.billingCheckoutSession.findUniqueOrThrow({ where: { id } }));
  }

  /** Marks a still-pending checkout terminal and returns its coupon slot. Idempotent. */
  async failCheckout(id: string, status: Exclude<CheckoutStatus, 'PENDING' | 'COMPLETED'>, reason: string) {
    await this.prisma.$transaction(async (tx) => {
      const flipped = await tx.billingCheckoutSession.updateMany({
        where: { id, status: 'PENDING' },
        data: { status, failureReason: reason.slice(0, 500) },
      });
      if (flipped.count > 0) await this.promotions.release(id, tx);
    });
  }

  /**
   * Activates the plan for a PENDING subscription checkout. Safe to call twice:
   * only the call that flips PENDING -> COMPLETED does any work.
   */
  async completeSubscriptionCheckout(
    checkoutId: string,
    opts: {
      source: 'PROVIDER' | 'PROMOTION';
      amountPaidCents: number;
      providerCustomerId?: string | null;
      providerSubscriptionId?: string | null;
      eventAt?: Date;
    },
  ): Promise<boolean> {
    const now = new Date();
    let replacedProviderSubscription: string | null = null;
    let planName = '';

    const activated = await this.prisma.$transaction(async (tx) => {
      const flipped = await tx.billingCheckoutSession.updateMany({
        where: { id: checkoutId, status: 'PENDING', kind: 'SUBSCRIPTION' },
        data: { status: 'COMPLETED', completedAt: now },
      });
      if (flipped.count === 0) return null;
      const session = await tx.billingCheckoutSession.findUniqueOrThrow({ where: { id: checkoutId } });
      const plan = normalizePlanTier(session.planTier);
      const interval: PlanBillingInterval = session.billingInterval === 'annual' ? 'annual' : 'monthly';
      planName = PLANS_CONFIG[plan].name;
      const existing = await tx.workspaceSubscription.findUnique({ where: { workspaceId: session.workspaceId } });
      if (
        existing?.providerSubscriptionId &&
        opts.providerSubscriptionId &&
        existing.providerSubscriptionId !== opts.providerSubscriptionId
      ) {
        replacedProviderSubscription = existing.providerSubscriptionId;
      }

      const trialing = session.trialDays > 0;
      const periodEnd = trialing
        ? new Date(now.getTime() + session.trialDays * 86_400_000)
        : addInterval(now, interval);
      const data = {
        planTier: plan.toUpperCase(),
        billingInterval: interval.toUpperCase(),
        status: trialing ? 'TRIALING' : 'ACTIVE',
        source: opts.source,
        provider: opts.source === 'PROVIDER' ? this.provider.name : null,
        providerCustomerId: opts.providerCustomerId ?? existing?.providerCustomerId ?? null,
        providerSubscriptionId: opts.providerSubscriptionId ?? null,
        providerEventAt: opts.eventAt ?? null,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        renewAt: periodEnd,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        pastDueSince: null,
        scheduledPlanTier: null,
        scheduledBillingInterval: null,
        scheduledChangeAt: null,
        appliedPromotionCode: session.promotionCode,
        discountPercent:
          session.discountCents > 0 && session.subtotalCents > 0
            ? Math.round((session.discountCents / session.subtotalCents) * 100)
            : null,
        trialStart: trialing ? now : existing?.trialStart ?? null,
        trialEnd: trialing ? periodEnd : existing?.trialEnd ?? null,
        trialStatus: trialing ? 'ACTIVE' : existing?.trialStatus === 'ACTIVE' ? 'CONVERTED' : existing?.trialStatus ?? null,
        trialUsed: trialing ? true : existing?.trialUsed ?? false,
        convertedAt: !trialing && existing?.trialStatus === 'ACTIVE' ? now : existing?.convertedAt ?? null,
        seatsTotal: PLANS_CONFIG[plan].limits.max_members === -1 ? 1000 : PLANS_CONFIG[plan].limits.max_members,
      };
      await tx.workspaceSubscription.upsert({
        where: { workspaceId: session.workspaceId },
        create: { workspaceId: session.workspaceId, ...data },
        update: data,
      });
      await this.promotions.confirm(checkoutId, tx);

      if (opts.source === 'PROMOTION') {
        await tx.billingInvoice.create({
          data: {
            workspaceId: session.workspaceId,
            number: invoiceNumber(now),
            checkoutId,
            amountCents: 0,
            currency: session.currency,
            status: 'PAID',
            description: `${planName} plan — activated with coupon ${session.promotionCode}`,
            periodStart: now,
            periodEnd,
            paidAt: now,
          },
        });
      }
      return session;
    });

    if (!activated) return false;

    if (replacedProviderSubscription) {
      // Upgrade path: the new subscription is paid, so retire the previous one. No refund/proration
      // is issued automatically (policy: previous period is forfeited unless support refunds it).
      try {
        await this.provider.cancelNow(replacedProviderSubscription);
      } catch (err) {
        this.logger.error(`Could not cancel replaced subscription ${replacedProviderSubscription}: ${String(err)}`);
        await this.audit.record({
          action: 'REPLACED_SUBSCRIPTION_CANCEL_FAILED',
          targetType: 'subscription',
          targetId: replacedProviderSubscription,
          workspaceId: activated.workspaceId,
          details: { error: String(err) },
        });
      }
    }

    await this.credits
      .grantPlanAllowance(activated.workspaceId, activated.planTier, `checkout:${checkoutId}`)
      .catch((err) => this.logger.warn(`Plan credit grant failed: ${String(err)}`));

    await this.audit.record({
      action: 'SUBSCRIPTION_ACTIVATED',
      targetType: 'subscription',
      targetId: activated.workspaceId,
      workspaceId: activated.workspaceId,
      actorId: activated.userId,
      details: { checkoutId, plan: activated.planTier, source: opts.source, amountPaidCents: opts.amountPaidCents },
    });
    this.events.emit(AppEvent.BillingNotice, {
      workspaceId: activated.workspaceId,
      actorId: null,
      title: `You're now on the ${planName} plan`,
      body:
        opts.source === 'PROMOTION'
          ? `Activated with coupon ${activated.promotionCode}.`
          : activated.trialDays > 0
            ? `Your ${activated.trialDays}-day free trial has started.`
            : 'Your payment was received and the new plan is active.',
      dedupeKey: `checkout:${checkoutId}`,
    });
    return true;
  }

  // --- credit top-ups --------------------------------------------------------

  async createTopUpCheckout(
    workspaceId: string,
    userId: string,
    amountUsd: number,
    idempotencyKey?: string,
  ): Promise<CheckoutSessionDto> {
    const cents = Math.round(amountUsd * 100);
    if (!Number.isFinite(amountUsd) || cents < MIN_TOPUP_CENTS || cents > MAX_TOPUP_CENTS) {
      throw new BadRequestException(
        `Top-ups are between $${MIN_TOPUP_CENTS / 100} and $${MAX_TOPUP_CENTS / 100}.`,
      );
    }
    if (!this.provider.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
        message: 'Credit top-ups require a payment provider, which is not configured on this deployment.',
      });
    }
    const idemKey = idempotencyKey ? `${workspaceId}:${userId}:topup:${idempotencyKey}`.slice(0, 200) : null;
    if (idemKey) {
      const prior = await this.prisma.billingCheckoutSession.findUnique({ where: { idempotencyKey: idemKey } });
      if (prior) return this.toDto(prior);
    }
    const [user, workspace, sub] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
      this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { slug: true } }),
      this.prisma.workspaceSubscription.findUnique({ where: { workspaceId }, select: { providerCustomerId: true } }),
    ]);
    if (!workspace) throw new NotFoundException('Workspace not found.');

    const session = await this.prisma.billingCheckoutSession.create({
      data: {
        workspaceId,
        userId,
        kind: 'CREDIT_TOPUP',
        planTier: 'TOPUP',
        billingInterval: 'ONE_TIME',
        currency: 'USD',
        subtotalCents: cents,
        totalCents: cents,
        provider: this.provider.name,
        idempotencyKey: idemKey,
        expiresAt: new Date(Date.now() + CHECKOUT_TTL_MS),
      },
    });
    try {
      const result = await this.provider.createCheckout({
        checkoutId: session.id,
        workspaceId,
        kind: 'CREDIT_TOPUP',
        planTier: 'TOPUP',
        billingInterval: 'monthly',
        currency: 'USD',
        productName: `AI credits ($${(cents / 100).toFixed(2)})`,
        unitAmountCents: cents,
        discountCents: 0,
        customerEmail: user?.email,
        existingCustomerId: sub?.providerCustomerId,
        successUrl: `${this.webBase}/w/${workspace.slug}/settings/billing?topup=success&session=${session.id}`,
        cancelUrl: `${this.webBase}/w/${workspace.slug}/settings/billing?topup=cancelled&session=${session.id}`,
        idempotencyKey: `checkout:${session.id}`,
      });
      return this.toDto(
        await this.prisma.billingCheckoutSession.update({
          where: { id: session.id },
          data: { providerSessionId: result.providerSessionId, providerUrl: result.url },
        }),
      );
    } catch (err) {
      await this.failCheckout(session.id, 'FAILED', err instanceof Error ? err.message : 'Payment provider error');
      throw new HttpException(
        { code: 'PAYMENT_PROVIDER_ERROR', message: 'The payment provider is unavailable. Please try again shortly.' },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async completeTopUp(checkoutId: string, amountPaidCents: number): Promise<boolean> {
    const session = await this.prisma.billingCheckoutSession.findUnique({ where: { id: checkoutId } });
    if (!session || session.kind !== 'CREDIT_TOPUP') return false;
    if (amountPaidCents < session.totalCents) {
      await this.failCheckout(checkoutId, 'FAILED', 'Paid amount was lower than the requested top-up');
      return false;
    }
    const flipped = await this.prisma.billingCheckoutSession.updateMany({
      where: { id: checkoutId, status: 'PENDING' },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    if (flipped.count === 0) return false;
    await this.credits.credit(
      session.workspaceId,
      session.subtotalCents / 100,
      'TOP_UP',
      `checkout:${checkoutId}`,
      `AI credit top-up ($${(session.subtotalCents / 100).toFixed(2)})`,
    );
    await this.prisma.billingInvoice.create({
      data: {
        workspaceId: session.workspaceId,
        number: invoiceNumber(),
        checkoutId,
        amountCents: amountPaidCents,
        currency: session.currency,
        status: 'PAID',
        description: `AI credit top-up ($${(session.subtotalCents / 100).toFixed(2)})`,
        periodStart: new Date(),
        periodEnd: new Date(),
        paidAt: new Date(),
      },
    });
    this.events.emit(AppEvent.BillingNotice, {
      workspaceId: session.workspaceId,
      actorId: null,
      title: 'AI credits added',
      body: `$${(session.subtotalCents / 100).toFixed(2)} of credits were added to your workspace.`,
      dedupeKey: `topup:${checkoutId}`,
    });
    return true;
  }

  /** Expires abandoned checkouts and frees their coupon reservations. */
  async expireStaleCheckouts(now = new Date()): Promise<number> {
    const stale = await this.prisma.billingCheckoutSession.findMany({
      where: { status: 'PENDING', expiresAt: { lt: now } },
      select: { id: true },
      take: 200,
    });
    for (const s of stale) await this.failCheckout(s.id, 'EXPIRED', 'Checkout expired');
    return stale.length;
  }
}
