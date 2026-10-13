import { describe, expect, it, vi } from 'vitest';
import { PromotionService, couponStatus, normalizeCouponCode } from './promotion.service.js';

const NOW = new Date('2026-10-14T12:00:00Z');
const base = {
  id: 'p1',
  code: 'X',
  active: true,
  validFrom: new Date('2026-01-01'),
  validUntil: null,
  maxRedemptions: null,
  redemptionsCount: 0,
} as never;

describe('normalizeCouponCode', () => {
  it('trims and upper-cases', () => {
    expect(normalizeCouponCode('  demo ')).toBe('DEMO');
    expect(normalizeCouponCode(undefined)).toBe('');
  });
});

describe('couponStatus', () => {
  it('is ACTIVE inside its window', () => {
    expect(couponStatus(base, NOW)).toBe('ACTIVE');
  });
  it('covers every status', () => {
    expect(couponStatus({ ...(base as object), active: false } as never, NOW)).toBe('INACTIVE');
    expect(couponStatus({ ...(base as object), validFrom: new Date('2027-01-01') } as never, NOW)).toBe('SCHEDULED');
    expect(couponStatus({ ...(base as object), validUntil: new Date('2026-10-01') } as never, NOW)).toBe('EXPIRED');
    expect(couponStatus({ ...(base as object), maxRedemptions: 2, redemptionsCount: 2 } as never, NOW)).toBe('EXHAUSTED');
    expect(couponStatus({ ...(base as object), maxRedemptions: 2, redemptionsCount: 1 } as never, NOW)).toBe('ACTIVE');
  });
});

describe('PromotionService.savePromotion validation', () => {
  const make = () => {
    const prisma = {
      promotion: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() },
    };
    const audit = { record: vi.fn() };
    return { svc: new PromotionService(prisma as never, { get: () => undefined } as never, audit as never), prisma };
  };

  it.each([
    [{ code: 'ab' }, /3-32/],
    [{ code: 'GOOD', discountType: 'PERCENTAGE', discountValue: 101 }, /exceed 100/],
    [{ code: 'GOOD', discountType: 'PERCENTAGE', discountValue: -1 }, /zero or more/],
    [{ code: 'GOOD', discountType: 'FIXED', discountValue: 10.5 }, /integer/],
    [{ code: 'GOOD', freeCheckoutPolicy: 'ALWAYS' }, /policy/],
    [{ code: 'GOOD', validFrom: '2026-10-10', validUntil: '2026-10-01' }, /after the start/],
  ])('rejects %j', async (input, message) => {
    const { svc, prisma } = make();
    await expect(svc.savePromotion(input as never, 'admin')).rejects.toThrow(message);
    expect(prisma.promotion.upsert).not.toHaveBeenCalled();
  });
});
