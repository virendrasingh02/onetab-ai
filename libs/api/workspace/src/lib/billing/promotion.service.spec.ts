import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PromotionService } from './promotion.service.js';

describe('PromotionService', () => {
  let service: PromotionService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      promotion: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
      promotionRedemption: {
        create: vi.fn(),
        count: vi.fn(),
      },
      $transaction: vi.fn((callbacks) => Promise.all(callbacks)),
    };

    service = new PromotionService(mockPrisma);
  });

  it('validates active code s1nu00780 with 100% discount', async () => {
    mockPrisma.promotion.findUnique.mockResolvedValue(null);
    mockPrisma.promotion.upsert.mockResolvedValue({
      id: 'p_1',
      code: 's1nu00780',
      discountType: 'PERCENTAGE',
      discountValue: 100.0,
      applicablePlans: ['starter', 'pro', 'business'],
      validFrom: new Date(),
      validUntil: null,
      maxRedemptions: null,
      redemptionsCount: 0,
      perUserLimit: 1,
      active: true,
    });

    const res = await service.validatePromotion('s1nu00780', 'pro');
    expect(res.valid).toBe(true);
    expect(res.discountPercent).toBe(100);
    expect(res.finalMonthlyPrice).toBe(0);
  });

  it('rejects expired promotion codes', async () => {
    mockPrisma.promotion.findUnique.mockResolvedValue({
      id: 'p_expired',
      code: 'EXPIRED100',
      discountType: 'PERCENTAGE',
      discountValue: 100.0,
      applicablePlans: ['pro'],
      validFrom: new Date('2020-01-01'),
      validUntil: new Date('2021-01-01'),
      active: true,
      redemptionsCount: 0,
      perUserLimit: 1,
    });

    const res = await service.validatePromotion('EXPIRED100', 'pro');
    expect(res.valid).toBe(false);
    expect(res.message).toContain('expired');
  });

  it('rejects promotion when per-user redemption limit reached', async () => {
    mockPrisma.promotion.findUnique.mockResolvedValue({
      id: 'p_used',
      code: 'ONCE_ONLY',
      discountType: 'PERCENTAGE',
      discountValue: 50.0,
      applicablePlans: ['pro'],
      validFrom: new Date(),
      validUntil: null,
      active: true,
      maxRedemptions: null,
      redemptionsCount: 5,
      perUserLimit: 1,
    });

    mockPrisma.promotionRedemption.count.mockResolvedValue(1);

    const res = await service.validatePromotion('ONCE_ONLY', 'pro', 'ws_1', 'user_1');
    expect(res.valid).toBe(false);
    expect(res.message).toContain('already redeemed');
  });

  it('records promotion redemption upon subscription checkout', async () => {
    mockPrisma.promotion.findUnique.mockResolvedValue({
      id: 'p_1',
      code: 's1nu00780',
    });

    await service.recordRedemption('s1nu00780', 'ws_1', 'user_1');
    expect(mockPrisma.promotionRedemption.create).toHaveBeenCalledWith({
      data: {
        promotionId: 'p_1',
        workspaceId: 'ws_1',
        userId: 'user_1',
      },
    });
  });
});
