import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CanManageWorkflow } from '@org/api-agents';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  CurrentUser,
  Public,
  RequireWorkspacePermissions,
  WorkspaceId,
  zodBody,
} from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import {
  agentVersionSchema,
  createWorkflowSchema,
  locationEventSchema,
  triggerWorkflowSchema,
  updateWorkflowSchema,
  type CreateWorkflowInput,
  type LocationEventInput,
  type UpdateWorkflowInput,
} from '@org/validation';
import { AutomationsService } from './automations.service.js';
import { LocationAutomationService } from './location-automation.service.js';

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
  constructor(
    private readonly automationsService: AutomationsService,
    private readonly locationService: LocationAutomationService,
  ) {}

  @Get('workflows')
  getWorkflows(@WorkspaceId() workspaceId: string) {
    return this.automationsService.getWorkflows(workspaceId);
  }

  /** Workspace-wide run history for the execution-logs screen. */
  @Get('executions')
  getWorkspaceExecutions(@WorkspaceId() workspaceId: string) {
    return this.automationsService.getWorkspaceExecutions(workspaceId);
  }

  /** Unified operational dashboard metrics. */
  @Get('overview')
  getAutomationOverview(@WorkspaceId() workspaceId: string) {
    return this.automationsService.getAutomationOverview(workspaceId);
  }

  /** Scheduled workflows and their next run timetable. */
  @Get('schedules')
  getSchedules(@WorkspaceId() workspaceId: string) {
    return this.automationsService.getSchedules(workspaceId);
  }

  /** Error monitoring and error group classification. */
  @Get('errors')
  getErrorMonitoring(@WorkspaceId() workspaceId: string) {
    return this.automationsService.getErrorMonitoring(workspaceId);
  }

  /** Dynamically available triggers and actions catalog. */
  @Get('catalog')
  getCatalog(@WorkspaceId() workspaceId: string) {
    return this.automationsService.getCatalog(workspaceId);
  }

  @Post('workflows')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  createWorkflow(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(createWorkflowSchema)) body: CreateWorkflowInput,
  ) {
    return this.automationsService.createWorkflow(workspaceId, userId, body);
  }

  @Patch('workflows/:workflowId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageWorkflow('workflowId')
  updateWorkflow(
    @WorkspaceId() workspaceId: string,
    @Param('workflowId') workflowId: string,
    @Body(zodBody(updateWorkflowSchema)) body: UpdateWorkflowInput,
  ) {
    return this.automationsService.updateWorkflow(
      workspaceId,
      workflowId,
      body,
    );
  }

  @Delete('workflows/:workflowId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageWorkflow('workflowId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteWorkflow(
    @WorkspaceId() workspaceId: string,
    @Param('workflowId') workflowId: string,
  ): Promise<void> {
    return this.automationsService.deleteWorkflow(workspaceId, workflowId);
  }

  @Post('workflows/:workflowId/trigger')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  triggerWorkflow(
    @WorkspaceId() workspaceId: string,
    @Param('workflowId') workflowId: string,
    @Body(zodBody(triggerWorkflowSchema)) body: Record<string, unknown>,
  ) {
    return this.automationsService.triggerWorkflow(
      workspaceId,
      workflowId,
      body,
    );
  }

  @Post('workflows/:workflowId/webhook')
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  triggerWebhook(
    @WorkspaceId() workspaceId: string,
    @Param('workflowId') workflowId: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-webhook-secret') secretHeader?: string,
  ) {
    return this.automationsService.triggerWebhook(
      workspaceId,
      workflowId,
      body,
      secretHeader,
    );
  }

  @Get('workflows/:workflowId')
  getWorkflow(
    @WorkspaceId() workspaceId: string,
    @Param('workflowId') workflowId: string,
  ) {
    return this.automationsService.getWorkflow(workspaceId, workflowId);
  }

  @Get('workflows/:workflowId/versions')
  listVersions(
    @WorkspaceId() workspaceId: string,
    @Param('workflowId') workflowId: string,
  ) {
    return this.automationsService.listVersions(workspaceId, workflowId);
  }

  @Post('workflows/:workflowId/versions')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageWorkflow('workflowId')
  createVersion(
    @WorkspaceId() workspaceId: string,
    @Param('workflowId') workflowId: string,
    @Body(zodBody(agentVersionSchema)) body: { summary?: string },
  ) {
    return this.automationsService.snapshot(workspaceId, workflowId, { summary: body.summary });
  }

  @Post('workflows/:workflowId/publish')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageWorkflow('workflowId')
  publish(
    @WorkspaceId() workspaceId: string,
    @Param('workflowId') workflowId: string,
    @Body(zodBody(agentVersionSchema)) body: { summary?: string },
  ) {
    return this.automationsService.snapshot(workspaceId, workflowId, {
      summary: body.summary,
      publish: true,
    });
  }

  @Post('workflows/:workflowId/versions/:version/restore')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageWorkflow('workflowId')
  restoreVersion(
    @WorkspaceId() workspaceId: string,
    @Param('workflowId') workflowId: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.automationsService.restoreVersion(workspaceId, workflowId, version);
  }

  @Get('workflows/:workflowId/executions')
  getExecutions(
    @WorkspaceId() workspaceId: string,
    @Param('workflowId') workflowId: string,
  ) {
    return this.automationsService.getExecutions(workspaceId, workflowId);
  }

  /** The caller's device location; starts their own Location-triggered agents. */
  @Post('location/events')
  @HttpCode(HttpStatus.OK)
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  ingestLocationEvent(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(locationEventSchema)) body: LocationEventInput,
  ) {
    return this.locationService.processLocationEvent(workspaceId, userId, {
      latitude: body.latitude,
      longitude: body.longitude,
      accuracy: body.accuracy,
      recordedAt: body.recordedAt === undefined ? new Date() : new Date(body.recordedAt),
    });
  }
}
