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
import {
  CurrentUser,
  RequireWorkspacePermissions,
  WorkspaceId,
} from '@org/api-common';
import type { CoworkerPermissions } from '@org/types';
import { WorkspacePermission } from '@org/types';
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
    @Body()
    body: {
      name: string;
      role?: string;
      description?: string;
      avatarUrl?: string | null;
      personality?: string;
      systemInstructions?: string;
      provider?: string;
      model?: string;
      permissions?: CoworkerPermissions;
      configuration?: Record<string, unknown>;
      agentIds?: string[];
      integrationIds?: string[];
    },
  ) {
    return this.coworkersService.createCoworker(workspaceId, userId, body);
  }

  @Patch(':coworkerId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  updateCoworker(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
    @Body()
    body: {
      name?: string;
      role?: string;
      description?: string;
      avatarUrl?: string | null;
      personality?: string;
      systemInstructions?: string;
      provider?: string;
      model?: string;
      isActive?: boolean;
      permissions?: CoworkerPermissions;
      configuration?: Record<string, unknown>;
    },
  ) {
    return this.coworkersService.updateCoworker(workspaceId, coworkerId, body);
  }

  @Delete(':coworkerId')
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCoworker(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
  ): Promise<void> {
    return this.coworkersService.deleteCoworker(workspaceId, coworkerId);
  }

  @Post(':coworkerId/execute')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  async executeCoworker(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
    @Body() body: { promptText: string; channelId?: string; projectId?: string },
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
  linkAgent(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
    @Body() body: { agentId: string },
  ) {
    return this.coworkersService.linkAgent(workspaceId, coworkerId, body.agentId);
  }

  @Delete(':coworkerId/agents/:agentId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  unlinkAgent(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
    @Param('agentId') agentId: string,
  ) {
    return this.coworkersService.unlinkAgent(workspaceId, coworkerId, agentId);
  }

  @Post(':coworkerId/apps')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  linkApp(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
    @Body() body: { integrationId: string },
  ) {
    return this.coworkersService.linkApp(workspaceId, coworkerId, body.integrationId);
  }

  @Delete(':coworkerId/apps/:integrationId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  unlinkApp(
    @WorkspaceId() workspaceId: string,
    @Param('coworkerId') coworkerId: string,
    @Param('integrationId') integrationId: string,
  ) {
    return this.coworkersService.unlinkApp(workspaceId, coworkerId, integrationId);
  }
}

/**
 * Which coworkers a channel has added. Mirrors `ChannelAgentsController`
 * exactly — `CoworkerMatrixBridgeService` reads these rows to decide who may
 * answer in a channel's Matrix room.
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
    @Body() body: { coworkerId: string },
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
    @Body() body: { isEnabled: boolean },
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
    @Body() body: { coworkerId: string },
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
