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
} from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import type { ApprovalDecisionInput } from '@org/types';
import { ApprovalsService } from './approvals.service.js';

@Controller({ path: 'workspaces/:workspaceId/approvals', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get()
  list(
    @WorkspaceId() workspaceId: string,
    @Query('state') state?: string,
  ) {
    return this.approvalsService.listApprovals(workspaceId, state);
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
    @Param('id') id: string,
    @Body() body: ApprovalDecisionInput,
  ) {
    return this.approvalsService.decide(workspaceId, id, approverId, body);
  }
}
