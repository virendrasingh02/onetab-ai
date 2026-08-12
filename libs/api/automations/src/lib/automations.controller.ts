import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, WorkspaceId } from '@org/api-common';
import { AutomationsService } from './automations.service.js';

/**
 * Automation workflows for one workspace.
 *
 * Guarded by the workspace path parameter. The previous `?workspaceId=` shape
 * under `JwtAuthGuard` alone let any signed-in account read another tenant's
 * workflows and trigger them.
 */
@Controller({ path: 'workspaces/:workspaceId/automations', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Get('workflows')
  getWorkflows(@WorkspaceId() workspaceId: string) {
    return this.automationsService.getWorkflows(workspaceId);
  }

  /** Workspace-wide run history for the execution-logs screen. */
  @Get('executions')
  getWorkspaceExecutions(@WorkspaceId() workspaceId: string) {
    return this.automationsService.getWorkspaceExecutions(workspaceId);
  }

  @Post('workflows')
  createWorkflow(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      name: string;
      description?: string;
      triggerType?: string;
      nodesJson?: string;
      edgesJson?: string;
    },
  ) {
    return this.automationsService.createWorkflow(workspaceId, userId, body);
  }

  @Patch('workflows/:workflowId')
  updateWorkflow(
    @WorkspaceId() workspaceId: string,
    @Param('workflowId') workflowId: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      triggerType?: string;
      nodesJson?: string;
      edgesJson?: string;
      isActive?: boolean;
    },
  ) {
    return this.automationsService.updateWorkflow(
      workspaceId,
      workflowId,
      body,
    );
  }

  @Delete('workflows/:workflowId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteWorkflow(
    @WorkspaceId() workspaceId: string,
    @Param('workflowId') workflowId: string,
  ): Promise<void> {
    return this.automationsService.deleteWorkflow(workspaceId, workflowId);
  }

  @Post('workflows/:workflowId/trigger')
  triggerWorkflow(
    @WorkspaceId() workspaceId: string,
    @Param('workflowId') workflowId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.automationsService.triggerWorkflow(
      workspaceId,
      workflowId,
      body,
    );
  }

  @Get('workflows/:workflowId/executions')
  getExecutions(
    @WorkspaceId() workspaceId: string,
    @Param('workflowId') workflowId: string,
  ) {
    return this.automationsService.getExecutions(workspaceId, workflowId);
  }
}
