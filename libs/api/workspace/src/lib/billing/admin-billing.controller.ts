import { Body, Controller, Get, Header, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { SystemRoleGuard } from '@org/api-auth';
import { CurrentUser, SystemRoles } from '@org/api-common';
import { SystemRole, type SavePromotionInput } from '@org/types';
import { AdminBillingService, type DateRange } from './admin-billing.service.js';
import { PromotionService } from './promotion.service.js';

const toDate = (v?: string): Date | undefined => {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(+d) ? undefined : d;
};
const toInt = (v?: string): number | undefined => {
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const range = (from?: string, to?: string): DateRange => ({ from: toDate(from), to: toDate(to) });

/**
 * Platform-wide billing administration — coupons, subscriptions, invoices,
 * metrics. SUPERADMIN only (the guard answers 404 to everyone else), which is
 * what keeps workspace admins out of global coupon and cross-tenant data.
 */
@Controller({ path: 'admin/billing', version: '1' })
@UseGuards(SystemRoleGuard)
@SystemRoles(SystemRole.SUPERADMIN)
export class AdminBillingController {
  constructor(
    private readonly admin: AdminBillingService,
    private readonly promotions: PromotionService,
  ) {}

  @Get('coupons')
  listCoupons() {
    return this.promotions.listPromotions();
  }

  @Put('coupons')
  saveCoupon(@CurrentUser('id') actorId: string, @Body() input: SavePromotionInput) {
    return this.promotions.savePromotion(input, actorId);
  }

  @Get('coupons/:code/redemptions')
  couponRedemptions(@Param('code') code: string) {
    return this.promotions.listRedemptions(code);
  }

  @Get('subscriptions')
  subscriptions(
    @Query('search') search?: string,
    @Query('plan') plan?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.admin.listSubscriptions({
      search,
      plan,
      status,
      source,
      page: toInt(page),
      pageSize: toInt(pageSize),
    });
  }

  @Get('subscriptions.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="subscriptions.csv"')
  subscriptionsCsv(@Query('plan') plan?: string, @Query('status') status?: string) {
    return this.admin.exportSubscriptionsCsv({ plan, status });
  }

  @Post('subscriptions/:workspaceId/contract')
  setContract(
    @CurrentUser('id') actorId: string,
    @Param('workspaceId') workspaceId: string,
    @Body()
    input: {
      periodEnd: string;
      billingInterval?: 'monthly' | 'annual';
      seatsTotal?: number;
      note?: string;
    },
  ) {
    return this.admin.setContract(workspaceId, actorId, input);
  }

  @Get('invoices')
  invoices(
    @Query('status') status?: string,
    @Query('workspaceId') workspaceId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.admin.listInvoices({
      status,
      workspaceId,
      ...range(from, to),
      page: toInt(page),
      pageSize: toInt(pageSize),
    });
  }

  @Get('invoices.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="invoices.csv"')
  invoicesCsv(@Query('status') status?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.admin.exportInvoicesCsv({ status, ...range(from, to) });
  }

  @Get('stats')
  stats(@Query('from') from?: string, @Query('to') to?: string) {
    return this.admin.stats(range(from, to));
  }

  @Get('audit')
  audit(@Query('workspaceId') workspaceId?: string, @Query('take') take?: string) {
    return this.admin.listAudit({ workspaceId, take: toInt(take) });
  }

  @Get('webhooks')
  webhooks(@Query('take') take?: string) {
    return this.admin.listWebhookEvents(toInt(take));
  }
}
