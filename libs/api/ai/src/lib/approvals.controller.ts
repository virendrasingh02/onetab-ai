import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  CurrentUser,
  RequireWorkspacePermissions,
  WorkspaceId,
  WorkspacePermissions,
  zodBody,
} from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import type { ApprovalDecisionInput } from '@org/types';
import { approvalDecisionSchema } from '@org/validation';
import { ApprovalsService } from './approvals.service.js';

@Controller({ path: 'workspaces/:workspaceId/approvals', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get()
  list(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @WorkspacePermissions() permissions: readonly WorkspacePermission[] | undefined,
    @Query('state') state?: string,
  ) {
    return this.approvalsService.listApprovals(workspaceId, state, { userId, permissions });
  }

  @Get(':id')
  get(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.approvalsService.getApproval(workspaceId, id);
  }

  @Post(':id/decide')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  decide(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') approverId: string,
    @WorkspacePermissions() permissions: readonly WorkspacePermission[] | undefined,
    @Param('id') id: string,
    @Body(zodBody(approvalDecisionSchema)) body: ApprovalDecisionInput,
  ) {
    return this.approvalsService.decide(
      workspaceId,
      id,
      { userId: approverId, permissions },
      body,
    );
  }
}
