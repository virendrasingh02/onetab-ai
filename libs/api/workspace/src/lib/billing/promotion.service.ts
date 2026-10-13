import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaService } from '@org/database';
import {
  BILLING_CURRENCY,
  PLAN_TIERS,
  computePriceBreakdown,
  normalizePlanTier,
  planPeriodCents,
  type CheckoutQuote,
  type CouponRejectionReason,
  type CouponStatus,
  type FreeCheckoutPolicy,
  type PlanBillingInterval,
  type PlanTier,
  type PromotionDto,
  type SavePromotionInput,
  type ValidatePromotionResponse,
} from '@org/types';
import { BillingAuditService } from './billing-audit.service.js';
import { resolveBillingMode, resolveTaxRatePercent } from './billing-mode.js';

type PromotionRow = Prisma.PromotionGetPayload<object>;
type Tx = Prisma.TransactionClient;

const REJECTION_MESSAGES: Record<CouponRejectionReason, string> = {
  NOT_FOUND: 'That coupon code is not valid.',
  INACTIVE: 'That coupon is not active.',
  EXPIRED: 'That coupon has expired.',
  NOT_STARTED: 'That coupon is not valid yet.',
  EXHAUSTED: 'That coupon has reached its redemption limit.',
  PLAN_INELIGIBLE: 'That coupon does not apply to the selected plan.',
  INTERVAL_INELIGIBLE: 'That coupon does not apply to the selected billing interval.',
  CURRENCY_MISMATCH: 'That coupon cannot be used with this currency.',
  BELOW_MINIMUM: 'This purchase is below the minimum amount for that coupon.',
  USER_LIMIT: 'You have already used that coupon the maximum number of times.',
  NOT_FIRST_TIME: 'That coupon is only for first-time customers.',
  FREE_PLAN: 'Coupons cannot be applied to the Free plan.',
};

export interface CouponContext {
  planTier: PlanTier;
  billingInterval: PlanBillingInterval;
  workspaceId: string;
  userId?: string;
  /** Trial days the plan would grant for this checkout (already eligibility-checked). */
  trialDays?: number;
}

export type CouponEvaluation =
  | { ok: true; promo: PromotionRow; quote: CheckoutQuote }
  | { ok: false; reason: CouponRejectionReason; message: string };

/** `DEMO` and friends are case-insensitive; stored upper-cased. */
export function normalizeCouponCode(code: string | null | undefined): string {
  return (code ?? '').trim().toUpperCase();
}

export function couponStatus(promo: PromotionRow, now = new Date()): CouponStatus {
  if (!promo.active) return 'INACTIVE';
  if (promo.validFrom > now) return 'SCHEDULED';
  if (promo.validUntil && promo.validUntil <= now) return 'EXPIRED';
  if (promo.maxRedemptions != null && promo.redemptionsCount >= promo.maxRedemptions) return 'EXHAUSTED';
  return 'ACTIVE';
}

@Injectable()
export class PromotionService implements OnModuleInit {
  private readonly logger = new Logger(PromotionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: BillingAuditService,
  ) {}

  /**
   * Seeds the `DEMO` test coupon exactly once. It is create-only: if the row
   * exists (including admin edits, or a deliberate deactivation) it is never
   * touched, so restarts cannot duplicate or silently re-enable it.
   */
  async onModuleInit(): Promise<void> {
    try {
      const existing = await this.prisma.promotion.findUnique({ where: { code: 'DEMO' } });
      if (existing) return;
      await this.prisma.promotion.create({
        data: {
          code: 'DEMO',
          name: 'DEMO test coupon',
          description: 'Sandbox coupon for exercising the full checkout flow. 100% off; never active in live mode.',
          discountType: 'PERCENTAGE',
          discountValue: 100,
          currency: BILLING_CURRENCY,
          applicablePlans: ['pro', 'max'],
          applicableIntervals: [],
          freeCheckoutPolicy: 'TEST_ONLY',
          perUserLimit: 10,
          active: resolveBillingMode(this.config) !== 'live',
        },
      });
      this.logger.log('Seeded DEMO test coupon.');
    } catch (err) {
      // A concurrent instance may have created it first (unique violation) — fine.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
        this.logger.warn(`Could not seed DEMO coupon: ${String(err)}`);
      }
    }
  }

  /** Evaluates every rule against the DB; never trusts client-supplied amounts. */
  async evaluate(code: string, ctx: CouponContext, db: Tx | PrismaService = this.prisma): Promise<CouponEvaluation> {
    const fail = (reason: CouponRejectionReason): CouponEvaluation => ({
      ok: false,
      reason,
      message: REJECTION_MESSAGES[reason],
    });

    if (ctx.planTier === 'free') return fail('FREE_PLAN');
    const promo = await db.promotion.findUnique({ where: { code: normalizeCouponCode(code) } });
    if (!promo) return fail('NOT_FOUND');

    const now = new Date();
    switch (couponStatus(promo, now)) {
      case 'INACTIVE':
        return fail('INACTIVE');
      case 'SCHEDULED':
        return fail('NOT_STARTED');
      case 'EXPIRED':
        return fail('EXPIRED');
      case 'EXHAUSTED':
        return fail('EXHAUSTED');
      default:
        break;
    }

    if (!promo.applicablePlans.map((p) => normalizePlanTier(p)).includes(ctx.planTier)) {
      return fail('PLAN_INELIGIBLE');
    }
    const intervals = promo.applicableIntervals.map((i) => i.toLowerCase());
    if (intervals.length > 0 && !intervals.includes(ctx.billingInterval)) return fail('INTERVAL_INELIGIBLE');
    if (promo.currency.toUpperCase() !== BILLING_CURRENCY) return fail('CURRENCY_MISMATCH');

    const subtotal = planPeriodCents(ctx.planTier, ctx.billingInterval);
    if (promo.minPurchaseCents != null && subtotal < promo.minPurchaseCents) return fail('BELOW_MINIMUM');

    if (ctx.userId) {
      const used = await db.promotionRedemption.count({
        where: { promotionId: promo.id, userId: ctx.userId, status: { in: ['RESERVED', 'APPLIED'] } },
      });
      if (used >= promo.perUserLimit) return fail('USER_LIMIT');
    }

    if (promo.firstTimeCustomerOnly) {
      const [invoices, redeemed] = await Promise.all([
        db.billingInvoice.count({ where: { workspaceId: ctx.workspaceId } }),
        db.promotionRedemption.count({ where: { workspaceId: ctx.workspaceId, status: 'APPLIED' } }),
      ]);
      if (invoices > 0 || redeemed > 0) return fail('NOT_FIRST_TIME');
    }

    const quote = this.buildQuote(ctx, promo, ctx.trialDays ?? 0);
    return { ok: true, promo, quote };
  }

  buildQuote(
    ctx: Pick<CouponContext, 'planTier' | 'billingInterval'>,
    promo: PromotionRow | null,
    baseTrialDays = 0,
  ): CheckoutQuote {
    // With a payment provider configured, tax is the provider's job at payment time.
    const providerTax = this.config.get<string>('STRIPE_AUTOMATIC_TAX') === 'true';
    const breakdown = computePriceBreakdown({
      planTier: ctx.planTier,
      billingInterval: ctx.billingInterval,
      discount: promo
        ? {
            discountType: promo.discountType === 'FIXED' ? 'FIXED' : 'PERCENTAGE',
            discountValue: promo.discountValue,
            currency: promo.currency,
          }
        : null,
      taxRatePercent: providerTax ? 0 : resolveTaxRatePercent(this.config),
    });
    const trialDays = baseTrialDays > 0 ? baseTrialDays + (promo?.trialExtensionDays ?? 0) : 0;
    return {
      planTier: breakdown.planTier,
      billingInterval: breakdown.billingInterval,
      currency: breakdown.currency,
      subtotalCents: breakdown.subtotalCents,
      discountCents: breakdown.discountCents,
      taxCents: breakdown.taxCents,
      totalCents: breakdown.totalCents,
      renewalCents: breakdown.renewalCents,
      trialDays,
      dueNowCents: trialDays > 0 ? 0 : breakdown.totalCents,
      taxCalculatedByProvider: providerTax,
      promotionCode: promo?.code ?? null,
    };
  }

  /** Public validation used by the checkout UI to preview a discount. */
  async validatePromotion(
    code: string,
    planInput: PlanTier | string,
    interval: PlanBillingInterval | undefined,
    workspaceId: string,
    userId?: string,
  ): Promise<ValidatePromotionResponse> {
    const cleaned = normalizeCouponCode(code);
    if (!cleaned) throw new BadRequestException('Enter a coupon code.');
    const planTier = normalizePlanTier(planInput);
    const billingInterval: PlanBillingInterval = interval === 'annual' ? 'annual' : 'monthly';

    const result = await this.evaluate(cleaned, { planTier, billingInterval, workspaceId, userId });
    if (!result.ok) {
      return { valid: false, code: cleaned, reason: result.reason, message: result.message, discountCents: 0, discountPercent: 0 };
    }
    const { promo, quote } = result;
    return {
      valid: true,
      code: promo.code,
      message: 'Coupon applied.',
      discountCents: quote.discountCents,
      discountPercent: quote.subtotalCents > 0 ? Math.round((quote.discountCents / quote.subtotalCents) * 100) : 0,
      quote,
      makesFree: quote.totalCents === 0,
      trialExtensionDays: promo.trialExtensionDays,
    };
  }

  /**
   * Reserves one redemption for a checkout, inside the caller's transaction.
   * The counter bump is a single conditional UPDATE so two concurrent checkouts
   * can never both take the last slot; the per-user check runs under an
   * advisory lock so one user cannot race past their limit.
   */
  async reserve(
    tx: Tx,
    promo: PromotionRow,
    ctx: { workspaceId: string; userId: string; checkoutId: string; discountCents: number },
  ): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`promo:${promo.id}:${ctx.userId}`}))`;
    const used = await tx.promotionRedemption.count({
      where: { promotionId: promo.id, userId: ctx.userId, status: { in: ['RESERVED', 'APPLIED'] } },
    });
    if (used >= promo.perUserLimit) throw new BadRequestException(REJECTION_MESSAGES.USER_LIMIT);

    const bumped = await tx.$executeRaw`
      UPDATE "promotions"
      SET "redemptionsCount" = "redemptionsCount" + 1
      WHERE "id" = ${promo.id}
        AND "active" = true
        AND ("maxRedemptions" IS NULL OR "redemptionsCount" < "maxRedemptions")`;
    if (bumped === 0) throw new BadRequestException(REJECTION_MESSAGES.EXHAUSTED);

    await tx.promotionRedemption.create({
      data: {
        promotionId: promo.id,
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        checkoutId: ctx.checkoutId,
        status: 'RESERVED',
        discountCents: ctx.discountCents,
        currency: promo.currency,
      },
    });
  }

  /** Marks the reservation consumed once payment/approval is confirmed. Idempotent. */
  async confirm(checkoutId: string, db: Tx | PrismaService = this.prisma): Promise<void> {
    await db.promotionRedemption.updateMany({
      where: { checkoutId, status: 'RESERVED' },
      data: { status: 'APPLIED' },
    });
  }

  /** Returns the slot to the pool when a checkout fails, is cancelled or expires. Idempotent. */
  async release(checkoutId: string, db: Tx | PrismaService = this.prisma): Promise<void> {
    const redemption = await db.promotionRedemption.findUnique({ where: { checkoutId } });
    if (!redemption || redemption.status !== 'RESERVED') return;
    const flipped = await db.promotionRedemption.updateMany({
      where: { checkoutId, status: 'RESERVED' },
      data: { status: 'RELEASED' },
    });
    if (flipped.count > 0) {
      await db.$executeRaw`
        UPDATE "promotions" SET "redemptionsCount" = GREATEST("redemptionsCount" - 1, 0)
        WHERE "id" = ${redemption.promotionId}`;
    }
  }

  // --- admin ---------------------------------------------------------------

  toDto(p: PromotionRow): PromotionDto {
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      discountType: p.discountType === 'FIXED' ? 'FIXED' : 'PERCENTAGE',
      discountValue: p.discountValue,
      currency: p.currency,
      applicablePlans: p.applicablePlans.map((x) => normalizePlanTier(x)),
      applicableIntervals: p.applicableIntervals.map((i) => (i.toLowerCase() === 'annual' ? 'annual' : 'monthly')),
      minPurchaseCents: p.minPurchaseCents,
      firstTimeCustomerOnly: p.firstTimeCustomerOnly,
      trialExtensionDays: p.trialExtensionDays,
      freeCheckoutPolicy: (['DISABLED', 'TEST_ONLY', 'APPROVED'].includes(p.freeCheckoutPolicy)
        ? p.freeCheckoutPolicy
        : 'DISABLED') as FreeCheckoutPolicy,
      validFrom: p.validFrom.toISOString(),
      validUntil: p.validUntil?.toISOString() ?? null,
      maxRedemptions: p.maxRedemptions,
      redemptionsCount: p.redemptionsCount,
      perUserLimit: p.perUserLimit,
      active: p.active,
      status: couponStatus(p),
    };
  }

  async listPromotions(): Promise<PromotionDto[]> {
    const rows = await this.prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((r) => this.toDto(r));
  }

  async listRedemptions(code: string, take = 100) {
    const promo = await this.prisma.promotion.findUnique({ where: { code: normalizeCouponCode(code) } });
    if (!promo) throw new NotFoundException('Coupon not found.');
    return this.prisma.promotionRedemption.findMany({
      where: { promotionId: promo.id },
      orderBy: { redeemedAt: 'desc' },
      take: Math.min(Math.max(take, 1), 500),
    });
  }

  /** Create or update a coupon (platform admins only — enforced by the controller). */
  async savePromotion(input: SavePromotionInput, actorId: string): Promise<PromotionDto> {
    const code = normalizeCouponCode(input.code);
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
      throw new BadRequestException('Coupon codes are 3-32 characters: letters, numbers, - and _.');
    }
    const discountType = input.discountType === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
    if (input.discountValue != null) {
      if (!Number.isFinite(input.discountValue) || input.discountValue < 0) {
        throw new BadRequestException('Discount must be zero or more.');
      }
      if (discountType === 'PERCENTAGE' && input.discountValue > 100) {
        throw new BadRequestException('A percentage discount cannot exceed 100.');
      }
      if (discountType === 'FIXED' && !Number.isInteger(input.discountValue)) {
        throw new BadRequestException('A fixed discount is an integer number of cents.');
      }
    }
    const plans = input.applicablePlans?.map((p) => normalizePlanTier(p));
    if (plans?.some((p) => !PLAN_TIERS.includes(p))) throw new BadRequestException('Unknown plan.');
    if (input.freeCheckoutPolicy && !['DISABLED', 'TEST_ONLY', 'APPROVED'].includes(input.freeCheckoutPolicy)) {
      throw new BadRequestException('Invalid free-checkout policy.');
    }
    const validFrom = input.validFrom ? new Date(input.validFrom) : undefined;
    const validUntil = input.validUntil ? new Date(input.validUntil) : input.validUntil === null ? null : undefined;
    if ((validFrom && isNaN(+validFrom)) || (validUntil && isNaN(+validUntil))) {
      throw new BadRequestException('Invalid date.');
    }
    if (validFrom && validUntil && validUntil <= validFrom) {
      throw new BadRequestException('The end date must be after the start date.');
    }

    const data = {
      name: input.name ?? undefined,
      description: input.description ?? undefined,
      discountType,
      discountValue: input.discountValue ?? undefined,
      applicablePlans: plans,
      applicableIntervals: input.applicableIntervals,
      minPurchaseCents: input.minPurchaseCents,
      firstTimeCustomerOnly: input.firstTimeCustomerOnly,
      trialExtensionDays: input.trialExtensionDays,
      freeCheckoutPolicy: input.freeCheckoutPolicy,
      validFrom,
      validUntil,
      maxRedemptions: input.maxRedemptions,
      perUserLimit: input.perUserLimit,
      active: input.active,
    };

    const before = await this.prisma.promotion.findUnique({ where: { code } });
    const row = await this.prisma.promotion.upsert({
      where: { code },
      create: { code, ...data, discountValue: input.discountValue ?? 0 },
      update: data,
    });
    await this.audit.record({
      action: before ? 'COUPON_UPDATED' : 'COUPON_CREATED',
      targetType: 'promotion',
      targetId: row.id,
      actorId,
      details: { code, before: before ? this.toDto(before) : null, after: this.toDto(row) },
    });
    return this.toDto(row);
  }
}
