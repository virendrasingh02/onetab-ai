import { describe, expect, it } from 'vitest';
import {
  computeDiscountCents,
  computePriceBreakdown,
  computeTaxCents,
  dollarsToCents,
  planPeriodCents,
} from './billing-pricing.js';

describe('billing pricing (integer cents)', () => {
  it('converts dollars to cents without float drift', () => {
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
    expect(dollarsToCents(24)).toBe(2400);
    expect(dollarsToCents(19.99)).toBe(1999);
  });

  it('prices Free at zero, paid plans by interval, Enterprise as custom (0)', () => {
    expect(planPeriodCents('free', 'monthly')).toBe(0);
    expect(planPeriodCents('pro', 'monthly')).toBe(3000);
    // annual price is per-month-when-billed-annually, so a year is 12x
    expect(planPeriodCents('pro', 'annual')).toBe(2400 * 12);
    expect(planPeriodCents('max', 'monthly')).toBe(4500);
    expect(planPeriodCents('enterprise', 'annual')).toBe(0);
  });

  it('accepts legacy tier names', () => {
    expect(planPeriodCents('business', 'monthly')).toBe(planPeriodCents('max', 'monthly'));
    expect(planPeriodCents('starter', 'monthly')).toBe(0);
  });

  it('applies percentage discounts with rounding and clamps to the subtotal', () => {
    const pct = (v: number) => ({ discountType: 'PERCENTAGE' as const, discountValue: v, currency: 'USD' });
    expect(computeDiscountCents(3000, pct(25))).toBe(750);
    expect(computeDiscountCents(3333, pct(33))).toBe(1100);
    expect(computeDiscountCents(3000, pct(100))).toBe(3000);
    expect(computeDiscountCents(3000, pct(150))).toBe(3000);
    expect(computeDiscountCents(3000, pct(-5))).toBe(0);
  });

  it('applies fixed discounts and never exceeds the subtotal', () => {
    const fixed = (v: number) => ({ discountType: 'FIXED' as const, discountValue: v, currency: 'USD' });
    expect(computeDiscountCents(3000, fixed(500))).toBe(500);
    expect(computeDiscountCents(3000, fixed(99_999))).toBe(3000);
    expect(computeDiscountCents(0, fixed(500))).toBe(0);
    expect(computeDiscountCents(3000, null)).toBe(0);
  });

  it('computes tax on the discounted amount and rounds to a cent', () => {
    expect(computeTaxCents(2700, 18)).toBe(486);
    expect(computeTaxCents(0, 18)).toBe(0);
    expect(computeTaxCents(1000, 0)).toBe(0);
  });

  it('builds a full breakdown: subtotal - discount + tax, renewal at full price', () => {
    const b = computePriceBreakdown({
      planTier: 'pro',
      billingInterval: 'monthly',
      discount: { discountType: 'PERCENTAGE', discountValue: 10, currency: 'USD' },
      taxRatePercent: 10,
    });
    expect(b).toMatchObject({ subtotalCents: 3000, discountCents: 300, taxCents: 270, totalCents: 2970, renewalCents: 3000 });
  });

  it('a 100% discount yields a zero total with no tax and a non-negative result', () => {
    const b = computePriceBreakdown({
      planTier: 'max',
      billingInterval: 'annual',
      discount: { discountType: 'PERCENTAGE', discountValue: 100, currency: 'USD' },
      taxRatePercent: 20,
    });
    expect(b.totalCents).toBe(0);
    expect(b.taxCents).toBe(0);
    expect(b.renewalCents).toBe(planPeriodCents('max', 'annual'));
  });
});
