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
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  CurrentUser,
  RequireWorkspacePermissions,
  WorkspaceId,
  zodBody,
} from '@org/api-common';
import {
  createAgentScheduleSchema,
  createAIEntitySchema,
  executeAIEntitySchema,
  updateAgentScheduleSchema,
  updateAIEntitySchema,
  type ExecuteAIEntityInput,
} from '@org/validation';
import { WorkspacePermission } from '@org/types';
import type { AIEntityType } from '@org/types';
import {
  AIEntitiesService,
  type CreateEntityDto,
  type UpdateEntityDto,
} from './ai-entities.service.js';
import { AIRuntimeService } from './ai-runtime.service.js';
import { CanManageAIEntity } from './ai-entity-access.guard.js';

/**
 * Unified controller for all AI Entities (AI Agents and AI Coworkers).
 *
 * Provides a consolidated REST API with type-aware querying and execution.
 */
@Controller({ path: 'workspaces/:workspaceId/ai/entities', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class AIEntitiesController {
  constructor(
    private readonly entitiesService: AIEntitiesService,
    private readonly runtimeService: AIRuntimeService,
  ) {}

  @Get()
  getEntities(
    @WorkspaceId() workspaceId: string,
    @Query('type') type?: AIEntityType,
  ) {
    return this.entitiesService.getEntities(workspaceId, type);
  }

  @Get('logs')
  getWorkspaceLogs(
    @WorkspaceId() workspaceId: string,
    @Query('type') type?: AIEntityType,
  ) {
    return this.entitiesService.getWorkspaceLogs(workspaceId, type);
  }

  @Get(':id')
  getEntity(
    @WorkspaceId() workspaceId: string,
    @Param('id') entityId: string,
  ) {
    return this.entitiesService.getEntity(workspaceId, entityId);
  }

  @Post()
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  createEntity(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(createAIEntitySchema)) body: CreateEntityDto,
  ) {
    return this.entitiesService.createEntity(workspaceId, userId, body);
  }

  @Patch(':id')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('id')
  updateEntity(
    @WorkspaceId() workspaceId: string,
    @Param('id') entityId: string,
    @Body(zodBody(updateAIEntitySchema)) body: UpdateEntityDto,
  ) {
    return this.entitiesService.updateEntity(workspaceId, entityId, body);
  }

  @Delete(':id')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEntity(
    @WorkspaceId() workspaceId: string,
    @Param('id') entityId: string,
  ) {
    return this.entitiesService.deleteEntity(workspaceId, entityId);
  }

  @Post(':id/execute')
  // Running an agent spends workspace credits and can act through its
  // linked apps; a read-only guest could previously call this.
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  executeEntity(
    @WorkspaceId() workspaceId: string,
    @Param('id') entityId: string,
    @Body(zodBody(executeAIEntitySchema)) body: ExecuteAIEntityInput,
  ) {
    return this.runtimeService.executeTurn(
      workspaceId,
      entityId,
      body.promptText,
      {
        channelId: body.channelId,
        channelName: body.channelName,
        projectId: body.projectId,
        projectName: body.projectName,
      },
    );
  }

  @Get(':id/logs')
  getEntityLogs(
    @WorkspaceId() workspaceId: string,
    @Param('id') entityId: string,
  ) {
    return this.entitiesService.getEntityLogs(workspaceId, entityId);
  }

  @Post(':id/schedules')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('id')
  createSchedule(
    @WorkspaceId() workspaceId: string,
    @Param('id') entityId: string,
    @Body(zodBody(createAgentScheduleSchema)) body: { cronExpression: string; description?: string },
  ) {
    return this.entitiesService.createSchedule(workspaceId, entityId, body);
  }

  @Patch(':id/schedules/:scheduleId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('id')
  updateSchedule(
    @WorkspaceId() workspaceId: string,
    @Param('id') entityId: string,
    @Param('scheduleId') scheduleId: string,
    @Body(zodBody(updateAgentScheduleSchema))
    body: { cronExpression?: string; description?: string; isActive?: boolean },
  ) {
    return this.entitiesService.updateSchedule(workspaceId, entityId, scheduleId, body);
  }

  @Delete(':id/schedules/:scheduleId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @CanManageAIEntity('id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSchedule(
    @WorkspaceId() workspaceId: string,
    @Param('id') entityId: string,
    @Param('scheduleId') scheduleId: string,
  ): Promise<void> {
    return this.entitiesService.deleteSchedule(workspaceId, entityId, scheduleId);
  }
}
