import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  CurrentUser,
  RequireWorkspacePermissions,
  WorkspaceId,
  WorkspaceMemberRole,
} from '@org/api-common';
import { PrismaService } from '@org/database';
import {
  WorkspacePermission,
  type CheckoutPlanInput,
  type DowngradePlanInput,
  type EnterpriseInquiryInput,
  type PlanTier,
  type SaveCustomLLMInput,
  type TestCustomLLMInput,
  type TopUpCreditsInput,
  type UpgradePlanInput,
  type ValidatePromotionInput,
} from '@org/types';
import { BillingService } from './billing.service.js';
import { CheckoutService } from './checkout.service.js';
import { CreditService } from './credit.service.js';
import { PromotionService } from './promotion.service.js';

/**
 * Workspace-scoped billing. `WorkspaceRoleGuard` resolves the caller's role in
 * *this* workspace from the URL, so a member of workspace A can never read or
 * change workspace B's billing; money-moving routes additionally need
 * MANAGE_BILLING.
 */
@Controller({ path: 'workspaces/:workspaceId/billing', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly checkoutService: CheckoutService,
    private readonly creditService: CreditService,
    private readonly promotionService: PromotionService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getBillingSummary(@WorkspaceId() workspaceId: string, @WorkspaceMemberRole() role?: any) {
    return this.billingService.getBillingSummary(workspaceId, role);
  }

  /** Server-computed price (incl. coupon) for the checkout screen. */
  @Post('quote')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_BILLING)
  quote(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() input: CheckoutPlanInput,
  ) {
    return this.checkoutService.quote(workspaceId, userId, input);
  }

  @Post('checkout')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_BILLING)
  checkout(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() input: CheckoutPlanInput,
  ) {
    return this.checkoutService.createCheckout(workspaceId, userId, input);
  }

  /** Kept for older clients; identical to `checkout`. */
  @Post('upgrade')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_BILLING)
  upgradePlan(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() input: UpgradePlanInput,
  ) {
    return this.checkoutService.createCheckout(workspaceId, userId, input);
  }

  @Get('checkout/:checkoutId')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_BILLING)
  getCheckout(@WorkspaceId() workspaceId: string, @Param('checkoutId') checkoutId: string) {
    return this.checkoutService.getCheckout(workspaceId, checkoutId);
  }

  @Post('checkout/:checkoutId/cancel')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_BILLING)
  cancelCheckout(@WorkspaceId() workspaceId: string, @Param('checkoutId') checkoutId: string) {
    return this.checkoutService.cancelCheckout(workspaceId, checkoutId);
  }

  @Post('cancel')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_BILLING)
  cancelSubscription(@WorkspaceId() workspaceId: string, @CurrentUser('id') userId: string) {
    return this.billingService.cancelSubscription(workspaceId, userId);
  }

  @Post('reactivate')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_BILLING)
  reactivate(@WorkspaceId() workspaceId: string, @CurrentUser('id') userId: string) {
    return this.billingService.reactivateSubscription(workspaceId, userId);
  }

  @Post('portal')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_BILLING)
  portal(@WorkspaceId() workspaceId: string) {
    return this.billingService.createPortalSession(workspaceId);
  }

  @Post('promotion/validate')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_BILLING)
  validatePromotion(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() input: ValidatePromotionInput,
  ) {
    return this.promotionService.validatePromotion(
      input.code,
      input.planTier,
      input.billingInterval,
      workspaceId,
      userId,
    );
  }

  /** Coupons this workspace has used. */
  @Get('redemptions')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_BILLING)
  async redemptions(@WorkspaceId() workspaceId: string) {
    const rows = await this.prisma.promotionRedemption.findMany({
      where: { workspaceId },
      include: { promotion: { select: { code: true } } },
      orderBy: { redeemedAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.promotion.code,
      status: r.status,
      discountCents: r.discountCents,
      currency: r.currency,
      redeemedAt: r.redeemedAt.toISOString(),
    }));
  }

  @Get('credits')
  getCredits(@WorkspaceId() workspaceId: string) {
    return this.creditService.getOrCreateAccount(workspaceId);
  }

  /** Starts a paid checkout; credits are added only after the provider confirms payment. */
  @Post('credits/top-up')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_BILLING)
  topUpCredits(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() input: TopUpCreditsInput,
  ) {
    return this.checkoutService.createTopUpCheckout(
      workspaceId,
      userId,
      Number(input.amount),
      input.idempotencyKey,
    );
  }

  @Get('downgrade-impact')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_BILLING)
  getDowngradeImpact(@WorkspaceId() workspaceId: string, @Query('targetPlan') targetPlan: PlanTier) {
    return this.billingService.getDowngradeImpact(workspaceId, targetPlan);
  }

  @Post('downgrade')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_BILLING)
  downgradePlan(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() input: DowngradePlanInput,
  ) {
    return this.billingService.downgradePlan(workspaceId, userId, input);
  }

  @Post('enterprise-inquiry')
  submitEnterpriseInquiry(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() input: EnterpriseInquiryInput,
  ) {
    return this.billingService.submitEnterpriseInquiry(workspaceId, userId, input);
  }

  @Get('custom-llm')
  getCustomLLMConfig(@WorkspaceId() workspaceId: string) {
    return this.billingService.getCustomLLMConfig(workspaceId);
  }

  @Post('custom-llm')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  saveCustomLLMConfig(@WorkspaceId() workspaceId: string, @Body() input: SaveCustomLLMInput) {
    return this.billingService.saveCustomLLMConfig(workspaceId, input);
  }

  @Post('custom-llm/test')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  testCustomLLMConnection(@Body() input: TestCustomLLMInput) {
    return this.billingService.testCustomLLMConnection(input);
  }

  @Get('invoices')
  getInvoices(@WorkspaceId() workspaceId: string) {
    return this.billingService.getInvoices(workspaceId);
  }
}
