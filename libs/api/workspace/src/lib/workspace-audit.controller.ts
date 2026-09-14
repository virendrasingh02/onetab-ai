import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  RequireWorkspacePermissions,
  WorkspaceId,
} from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import { WorkspaceAuditService } from './workspace-audit.service.js';

@Controller({ path: 'workspaces/:workspaceId/audit-logs', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class WorkspaceAuditController {
  constructor(private readonly auditService: WorkspaceAuditService) {}

  @Get()
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_MEMBERS)
  list(
    @WorkspaceId() workspaceId: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.auditService.list(workspaceId, {
      action,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }
}
