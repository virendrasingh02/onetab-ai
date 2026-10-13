/**
 * Pure, deterministic pricing math for checkout. All money is integer minor
 * units (cents). The server is the only place that is allowed to produce a
 * payable total; clients display what the server returned.
 */
import { PLANS_CONFIG, normalizePlanTier, type PlanBillingInterval, type PlanTier } from './plans.js';

export type CouponDiscountType = 'PERCENTAGE' | 'FIXED';

export interface PriceBreakdown {
  planTier: PlanTier;
  billingInterval: PlanBillingInterval;
  currency: string;
  /** Price of one full billing period before discount (cents). */
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  /** What the customer pays now: subtotal - discount + tax, never negative. */
  totalCents: number;
  /** Full-price renewal amount for the next period, before tax (cents). */
  renewalCents: number;
}

export const BILLING_CURRENCY = 'USD';

/** USD dollars (possibly fractional) to integer cents, rounding half away from zero. */
export function dollarsToCents(dollars: number): number {
  return Math.round((dollars + Number.EPSILON) * 100);
}

/**
 * Price of one billing period in cents. `pricing.annual` is the per-month price
 * when billed annually, so an annual period is 12x that.
 */
export function planPeriodCents(planInput: PlanTier | string, interval: PlanBillingInterval): number {
  const plan = PLANS_CONFIG[normalizePlanTier(planInput)];
  if (plan.isCustomQuote) return 0;
  return interval === 'annual'
    ? dollarsToCents(plan.pricing.annual) * 12
    : dollarsToCents(plan.pricing.monthly);
}

export interface DiscountRule {
  discountType: CouponDiscountType;
  /** PERCENTAGE: 0..100. FIXED: minor units. */
  discountValue: number;
  currency: string;
}

/** Discount for a given subtotal, clamped to [0, subtotal]. */
export function computeDiscountCents(subtotalCents: number, rule: DiscountRule | null): number {
  if (!rule || subtotalCents <= 0) return 0;
  const raw =
    rule.discountType === 'PERCENTAGE'
      ? Math.round((subtotalCents * Math.min(100, Math.max(0, rule.discountValue))) / 100)
      : Math.round(Math.max(0, rule.discountValue));
  return Math.min(subtotalCents, Math.max(0, raw));
}

export function computeTaxCents(taxableCents: number, taxRatePercent: number): number {
  if (taxableCents <= 0 || taxRatePercent <= 0) return 0;
  return Math.round((taxableCents * taxRatePercent) / 100);
}

export function computePriceBreakdown(args: {
  planTier: PlanTier | string;
  billingInterval: PlanBillingInterval;
  discount?: DiscountRule | null;
  taxRatePercent?: number;
}): PriceBreakdown {
  const planTier = normalizePlanTier(args.planTier);
  const subtotalCents = planPeriodCents(planTier, args.billingInterval);
  const discountCents = computeDiscountCents(subtotalCents, args.discount ?? null);
  const taxCents = computeTaxCents(subtotalCents - discountCents, args.taxRatePercent ?? 0);
  return {
    planTier,
    billingInterval: args.billingInterval,
    currency: BILLING_CURRENCY,
    subtotalCents,
    discountCents,
    taxCents,
    totalCents: Math.max(0, subtotalCents - discountCents + taxCents),
    renewalCents: subtotalCents,
  };
}
