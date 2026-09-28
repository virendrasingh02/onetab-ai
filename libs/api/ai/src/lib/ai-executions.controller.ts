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
  ZodValidationPipe,
} from '@org/api-common';
import { aiExecutionFilterSchema } from '@org/validation';
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
    @Query(new ZodValidationPipe(aiExecutionFilterSchema)) filters: AIExecutionFilter,
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

  /** Stops a run that is waiting on a person; see `cancelExecution`. */
  @Post(':id/cancel')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  cancel(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.executionsService.cancelExecution(workspaceId, id);
  }

  // Retry lives in `AIRunsController` (@org/api-automations): re-running a
  // run needs the workflow engine and the agent runtime, which this library
  // sits below.
}
