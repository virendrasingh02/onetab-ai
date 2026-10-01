import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { Throttle } from '@nestjs/throttler';
import {
  CurrentUser,
  RequireWorkspacePermissions,
  WorkspaceId,
  WorkspaceMemberRole,
  WorkspacePolicies,
  zodBody,
} from '@org/api-common';
import {
  createCoworkerSchema,
  executeAIEntitySchema,
  linkAgentSchema,
  linkCoworkerSchema,
  linkIntegrationSchema,
  setEnabledSchema,
  updateCoworkerSchema,
  type CreateCoworkerInput,
  type UpdateCoworkerInput,
} from '@org/validation';
import type { WorkspacePolicy, WorkspaceRole } from '@org/types';
import { isPolicyRoleAllowed, WorkspacePermission } from '@org/types';
import { CanManageAIEntity } from '@org/api-agents';
import { CoworkerRuntimeService } from './coworker-runtime.service.js';
import { CoworkersService } from './coworkers.service.js';

/**
 * A workspace's own AI Coworkers.
 *
 * Same guard shape as `AgentsController` — the workspace is a guarded path
 * parameter, not a query param under `JwtAuthGuard` alone, so one tenant can
 * never list, create in, or execute another tenant's coworkers.
 */
@Controller({ path: 'workspaces/:workspaceId/coworkers', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class CoworkersController {
  constructor(
    private readonly coworkersService: CoworkersService,
    private readonly runtime: CoworkerRuntimeService,
  ) {}

  @Get()
  getCoworkers(@WorkspaceId() workspaceId: string) {
    return this.coworkersService.getCoworkers(workspaceId);
  }

  /** Workspace-wide telemetry — declared above `:coworkerId` so it isn't
   *  swallowed as a coworker id. */
  @Get('logs')
  getWorkspaceLogs(@WorkspaceId() workspaceId: string) {
    return this.coworkersService.getWorkspaceLogs(workspaceId);
  }

  @Get(':coworkerId')
  getCoworker(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
  ) {
    return this.coworkersService.getCoworker(workspaceId, coworkerId);
  }

  @Post()
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  createCoworker(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @WorkspaceMemberRole() role: WorkspaceRole | undefined,
    @WorkspacePolicies() policies: WorkspacePolicy | undefined,
    @Body(zodBody(createCoworkerSchema)) body: CreateCoworkerInput,
  ) {
    // Settings → Permissions & Policies → "Who can create AI Coworkers".
    if (policies && !isPolicyRoleAllowed(role, policies.whoCanCreateCoworkers)) {
      throw new ForbiddenException(
        'You do not have permission to create AI coworkers in this workspace.',
      );
    }
    return this.coworkersService.createCoworker(workspaceId, userId, body);
  }

  @Patch(':coworkerId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('coworkerId')
  updateCoworker(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
    @Body(zodBody(updateCoworkerSchema)) body: UpdateCoworkerInput,
  ) {
    return this.coworkersService.updateCoworker(workspaceId, coworkerId, body);
  }

  @Delete(':coworkerId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('coworkerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCoworker(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
  ): Promise<void> {
    return this.coworkersService.deleteCoworker(workspaceId, coworkerId);
  }

  @Post(':coworkerId/execute')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async executeCoworker(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
    @Body(zodBody(executeAIEntitySchema))
    body: { promptText: string; channelId?: string; projectId?: string },
  ) {
    const result = await this.runtime.executeTurn(
      workspaceId,
      coworkerId,
      body.promptText,
      { channelId: body.channelId, projectId: body.projectId },
    );
    return result;
  }

  @Get(':coworkerId/logs')
  getExecutionLogs(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
  ) {
    return this.coworkersService.getExecutionLogs(workspaceId, coworkerId);
  }

  @Get(':coworkerId/agents')
  async listLinkedAgents(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
  ) {
    const coworker = await this.coworkersService.getCoworker(workspaceId, coworkerId);
    return coworker.agentLinks;
  }

  @Post(':coworkerId/agents')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('coworkerId')
  linkAgent(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
    @Body(zodBody(linkAgentSchema)) body: { agentId: string },
  ) {
    return this.coworkersService.linkAgent(workspaceId, coworkerId, body.agentId);
  }

  @Delete(':coworkerId/agents/:agentId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('coworkerId')
  unlinkAgent(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
    @Param('agentId') agentId: string,
  ) {
    return this.coworkersService.unlinkAgent(workspaceId, coworkerId, agentId);
  }

  @Post(':coworkerId/apps')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('coworkerId')
  linkApp(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
    @Body(zodBody(linkIntegrationSchema)) body: { integrationId: string },
  ) {
    return this.coworkersService.linkApp(workspaceId, coworkerId, body.integrationId);
  }

  @Delete(':coworkerId/apps/:integrationId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('coworkerId')
  unlinkApp(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
    @Param('integrationId') integrationId: string,
  ) {
    return this.coworkersService.unlinkApp(workspaceId, coworkerId, integrationId);
  }

  // -------------------------------------------------------------------------
  // Tracker Monitors
  // -------------------------------------------------------------------------

  @Get(':coworkerId/monitors')
  listMonitors(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
  ) {
    return this.coworkersService.listMonitors(workspaceId, coworkerId);
  }

  @Post(':coworkerId/monitors')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('coworkerId')
  createMonitor(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
    @CurrentUser('id') userId: string,
    @Body() body: any,
  ) {
    return this.coworkersService.createMonitor(workspaceId, coworkerId, userId, body);
  }

  @Patch(':coworkerId/monitors/:monitorId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('coworkerId')
  updateMonitor(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
    @Param('monitorId') monitorId: string,
    @Body() body: any,
  ) {
    return this.coworkersService.updateMonitor(workspaceId, coworkerId, monitorId, body);
  }

  @Delete(':coworkerId/monitors/:monitorId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('coworkerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMonitor(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
    @Param('monitorId') monitorId: string,
  ): Promise<void> {
    return this.coworkersService.deleteMonitor(workspaceId, coworkerId, monitorId);
  }

  // -------------------------------------------------------------------------
  // Scheduler Schedules
  // -------------------------------------------------------------------------

  @Get(':coworkerId/schedules')
  listSchedules(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
  ) {
    return this.coworkersService.listSchedules(workspaceId, coworkerId);
  }

  @Post(':coworkerId/schedules')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('coworkerId')
  createSchedule(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
    @Body() body: { cronExpression: string; description?: string },
  ) {
    return this.coworkersService.createSchedule(workspaceId, coworkerId, body);
  }

  @Patch(':coworkerId/schedules/:scheduleId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('coworkerId')
  updateSchedule(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
    @Param('scheduleId') scheduleId: string,
    @Body() body: { cronExpression?: string; description?: string; isActive?: boolean },
  ) {
    return this.coworkersService.updateSchedule(workspaceId, coworkerId, scheduleId, body);
  }

  @Delete(':coworkerId/schedules/:scheduleId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('coworkerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSchedule(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
    @Param('scheduleId') scheduleId: string,
  ): Promise<void> {
    return this.coworkersService.deleteSchedule(workspaceId, coworkerId, scheduleId);
  }
}

/**
 * Which coworkers a channel has added. Mirrors `ChannelAgentsController`
 * exactly — `AgentMatrixBridgeService` (`@org/api-agents`, unified across
 * both entity types) reads these rows to decide who may answer in a
 * channel's Matrix room.
 */
@Controller({
  path: 'workspaces/:workspaceId/channels/:channelId/coworkers',
  version: '1',
})
@UseGuards(WorkspaceRoleGuard)
export class ChannelCoworkersController {
  constructor(private readonly coworkersService: CoworkersService) {}

  @Get()
  list(
    @WorkspaceId() workspaceId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.coworkersService.listChannelCoworkers(workspaceId, channelId);
  }

  @Post()
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  add(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('channelId') channelId: string,
    @Body(zodBody(linkCoworkerSchema)) body: { coworkerId: string },
  ) {
    return this.coworkersService.addChannelCoworker(
      workspaceId,
      channelId,
      body.coworkerId,
      userId,
    );
  }

  @Patch(':coworkerId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  setEnabled(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('channelId') channelId: string,
    @Param('coworkerId') coworkerId: string,
    @Body(zodBody(setEnabledSchema)) body: { isEnabled: boolean },
  ) {
    return this.coworkersService.setChannelCoworkerEnabled(
      workspaceId,
      channelId,
      coworkerId,
      body.isEnabled,
      userId,
    );
  }

  @Delete(':coworkerId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('channelId') channelId: string,
    @Param('coworkerId') coworkerId: string,
  ): Promise<void> {
    return this.coworkersService.removeChannelCoworker(
      workspaceId,
      channelId,
      coworkerId,
      userId,
    );
  }
}

/** Which coworkers a project has added. */
@Controller({
  path: 'workspaces/:workspaceId/projects/:projectId/coworkers',
  version: '1',
})
@UseGuards(WorkspaceRoleGuard)
export class ProjectCoworkersController {
  constructor(private readonly coworkersService: CoworkersService) {}

  @Get()
  list(
    @WorkspaceId() workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.coworkersService.listProjectCoworkers(workspaceId, projectId);
  }

  @Post()
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  add(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @Body(zodBody(linkCoworkerSchema)) body: { coworkerId: string },
  ) {
    return this.coworkersService.addProjectCoworker(
      workspaceId,
      projectId,
      body.coworkerId,
      userId,
    );
  }

  @Delete(':coworkerId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @WorkspaceId() workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('coworkerId') coworkerId: string,
  ): Promise<void> {
    return this.coworkersService.removeProjectCoworker(
      workspaceId,
      projectId,
      coworkerId,
    );
  }
}
