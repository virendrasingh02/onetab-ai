import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@org/database';
import {
  ACTIVE_PROMOTION_CODE,
  PLANS_CONFIG,
  normalizePlanTier,
  type PlanTier,
  type PromotionDto,
  type ValidatePromotionResponse,
} from '@org/types';

@Injectable()
export class PromotionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates a promotional code for a specific plan tier and workspace/user.
   */
  async validatePromotion(
    code: string,
    planTierInput: PlanTier,
    workspaceId?: string,
    userId?: string,
  ): Promise<ValidatePromotionResponse> {
    const cleanCode = (code || '').trim();
    if (!cleanCode) {
      throw new BadRequestException('Promotional code is required.');
    }

    const planTier = normalizePlanTier(planTierInput);
    const planConfig = PLANS_CONFIG[planTier];

    // Query DB for promotion or match pre-configured active code
    let promo = await this.prisma.promotion.findUnique({
      where: { code: cleanCode },
    });

    // Fallback/auto-seed for active system code s1nu00780
    if (!promo && cleanCode.toLowerCase() === ACTIVE_PROMOTION_CODE.toLowerCase()) {
      promo = await this.prisma.promotion.upsert({
        where: { code: ACTIVE_PROMOTION_CODE },
        create: {
          code: ACTIVE_PROMOTION_CODE,
          discountType: 'PERCENTAGE',
          discountValue: 100.0,
          applicablePlans: ['starter', 'pro', 'business'],
          active: true,
        },
        update: {
          active: true,
        },
      });
    }

    if (!promo || !promo.active) {
      return {
        valid: false,
        code: cleanCode,
        discountPercent: 0,
        finalMonthlyPrice: planConfig.pricing.monthly,
        finalAnnualPrice: planConfig.pricing.annual,
        message: 'Invalid or inactive promotional code.',
      };
    }

    const now = new Date();
    if (promo.validUntil && promo.validUntil < now) {
      return {
        valid: false,
        code: cleanCode,
        discountPercent: 0,
        finalMonthlyPrice: planConfig.pricing.monthly,
        finalAnnualPrice: planConfig.pricing.annual,
        message: 'This promotional code has expired.',
      };
    }

    if (promo.maxRedemptions && promo.redemptionsCount >= promo.maxRedemptions) {
      return {
        valid: false,
        code: cleanCode,
        discountPercent: 0,
        finalMonthlyPrice: planConfig.pricing.monthly,
        finalAnnualPrice: planConfig.pricing.annual,
        message: 'This promotion has reached its maximum redemptions limit.',
      };
    }

    const applicable = promo.applicablePlans.map((p) => p.toLowerCase());
    if (!applicable.includes(planTier)) {
      return {
        valid: false,
        code: cleanCode,
        discountPercent: 0,
        finalMonthlyPrice: planConfig.pricing.monthly,
        finalAnnualPrice: planConfig.pricing.annual,
        message: `This promotional code is not applicable to the ${planConfig.name} plan.`,
      };
    }

    // Check per-user limit if userId supplied
    if (userId) {
      const userRedemptions = await this.prisma.promotionRedemption.count({
        where: { promotionId: promo.id, userId },
      });
      if (userRedemptions >= promo.perUserLimit) {
        return {
          valid: false,
          code: cleanCode,
          discountPercent: 0,
          finalMonthlyPrice: planConfig.pricing.monthly,
          finalAnnualPrice: planConfig.pricing.annual,
          message: 'You have already redeemed this promotional code.',
        };
      }
    }

    const discountPercent = promo.discountValue;
    const finalMonthlyPrice = Math.max(
      0,
      Number((planConfig.pricing.monthly * (1 - discountPercent / 100)).toFixed(2)),
    );
    const finalAnnualPrice = Math.max(
      0,
      Number((planConfig.pricing.annual * (1 - discountPercent / 100)).toFixed(2)),
    );

    const promoDto: PromotionDto = {
      id: promo.id,
      code: promo.code,
      discountType: promo.discountType as any,
      discountValue: promo.discountValue,
      applicablePlans: promo.applicablePlans as PlanTier[],
      validFrom: promo.validFrom.toISOString(),
      validUntil: promo.validUntil?.toISOString() ?? null,
      maxRedemptions: promo.maxRedemptions,
      redemptionsCount: promo.redemptionsCount,
      perUserLimit: promo.perUserLimit,
      active: promo.active,
    };

    return {
      valid: true,
      code: promo.code,
      discountPercent,
      finalMonthlyPrice,
      finalAnnualPrice,
      message: `${discountPercent}% discount applied with code ${promo.code}!`,
      promotion: promoDto,
    };
  }

  /**
   * Records a promotion redemption when checkout/upgrade completes.
   */
  async recordRedemption(
    code: string,
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const promo = await this.prisma.promotion.findUnique({
      where: { code },
    });
    if (!promo) return;

    await this.prisma.$transaction([
      this.prisma.promotionRedemption.create({
        data: {
          promotionId: promo.id,
          workspaceId,
          userId,
        },
      }),
      this.prisma.promotion.update({
        where: { id: promo.id },
        data: {
          redemptionsCount: { increment: 1 },
        },
      }),
    ]);
  }

  /**
   * Lists all promotions (Admin).
   */
  async listPromotions(): Promise<PromotionDto[]> {
    const promos = await this.prisma.promotion.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return promos.map((p) => ({
      id: p.id,
      code: p.code,
      discountType: p.discountType as any,
      discountValue: p.discountValue,
      applicablePlans: p.applicablePlans as PlanTier[],
      validFrom: p.validFrom.toISOString(),
      validUntil: p.validUntil?.toISOString() ?? null,
      maxRedemptions: p.maxRedemptions,
      redemptionsCount: p.redemptionsCount,
      perUserLimit: p.perUserLimit,
      active: p.active,
    }));
  }

  /**
   * Creates or updates a promotion (Admin).
   */
  async savePromotion(data: {
    code: string;
    discountType?: 'PERCENTAGE' | 'FIXED';
    discountValue: number;
    applicablePlans?: string[];
    validUntil?: string;
    maxRedemptions?: number;
    perUserLimit?: number;
    active?: boolean;
  }): Promise<PromotionDto> {
    const promo = await this.prisma.promotion.upsert({
      where: { code: data.code.trim().toUpperCase() },
      create: {
        code: data.code.trim().toUpperCase(),
        discountType: data.discountType ?? 'PERCENTAGE',
        discountValue: data.discountValue,
        applicablePlans: data.applicablePlans ?? ['starter', 'pro', 'business'],
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        maxRedemptions: data.maxRedemptions ?? null,
        perUserLimit: data.perUserLimit ?? 1,
        active: data.active ?? true,
      },
      update: {
        discountType: data.discountType ?? 'PERCENTAGE',
        discountValue: data.discountValue,
        applicablePlans: data.applicablePlans,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        maxRedemptions: data.maxRedemptions,
        perUserLimit: data.perUserLimit,
        active: data.active,
      },
    });

    return {
      id: promo.id,
      code: promo.code,
      discountType: promo.discountType as any,
      discountValue: promo.discountValue,
      applicablePlans: promo.applicablePlans as PlanTier[],
      validFrom: promo.validFrom.toISOString(),
      validUntil: promo.validUntil?.toISOString() ?? null,
      maxRedemptions: promo.maxRedemptions,
      redemptionsCount: promo.redemptionsCount,
      perUserLimit: promo.perUserLimit,
      active: promo.active,
    };
  }
}
