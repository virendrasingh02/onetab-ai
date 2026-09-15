import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  RequireWorkspacePermissions,
  WorkspaceId,
} from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import type { AIExecutionFilter } from '@org/types';
import { AIExecutionsService } from './ai-executions.service.js';

@Controller({ path: 'workspaces/:workspaceId/ai-executions', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class AIExecutionsController {
  constructor(private readonly executionsService: AIExecutionsService) {}

  @Get()
  list(
    @WorkspaceId() workspaceId: string,
    @Query() filters: AIExecutionFilter,
  ) {
    return this.executionsService.listExecutions(workspaceId, filters);
  }

  @Get(':id')
  get(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.executionsService.getExecution(workspaceId, id);
  }

  @Post(':id/cancel')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  cancel(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.executionsService.cancelExecution(workspaceId, id);
  }

  @Post(':id/retry')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  retry(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.executionsService.retryExecution(workspaceId, id);
  }
}
