import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  CurrentUser,
  RequireWorkspacePermissions,
  WorkspaceId,
  WorkspaceMemberRole,
} from '@org/api-common';

import {
  WorkspacePermission,
  type DowngradePlanInput,
  type EnterpriseInquiryInput,
  type PlanTier,
  type SaveCustomLLMInput,
  type TestCustomLLMInput,
  type UpgradePlanInput,
} from '@org/types';
import { BillingService } from './billing.service.js';

@Controller({ path: 'workspaces/:workspaceId/billing', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  getBillingSummary(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberRole() role?: any,
  ) {
    return this.billingService.getBillingSummary(workspaceId, role);
  }

  @Post('upgrade')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_BILLING)
  upgradePlan(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() input: UpgradePlanInput,
  ) {
    return this.billingService.upgradePlan(workspaceId, userId, input);
  }

  @Get('downgrade-impact')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_BILLING)
  getDowngradeImpact(
    @WorkspaceId() workspaceId: string,
    @Query('targetPlan') targetPlan: PlanTier,
  ) {
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
    return this.billingService.submitEnterpriseInquiry(
      workspaceId,
      userId,
      input,
    );
  }

  @Get('custom-llm')
  getCustomLLMConfig(@WorkspaceId() workspaceId: string) {
    return this.billingService.getCustomLLMConfig(workspaceId);
  }

  @Post('custom-llm')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  saveCustomLLMConfig(
    @WorkspaceId() workspaceId: string,
    @Body() input: SaveCustomLLMInput,
  ) {
    return this.billingService.saveCustomLLMConfig(workspaceId, input);
  }

  @Post('custom-llm/test')
  testCustomLLMConnection(@Body() input: TestCustomLLMInput) {
    return this.billingService.testCustomLLMConnection(input);
  }

  @Get('invoices')
  getInvoices(@WorkspaceId() workspaceId: string) {
    return this.billingService.getInvoices(workspaceId);
  }
}
