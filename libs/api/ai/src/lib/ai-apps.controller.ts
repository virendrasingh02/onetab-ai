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
import { Throttle } from '@nestjs/throttler';
import {
  createAIAppSchema,
  publishAIAppSchema,
  triggerWorkflowSchema,
  updateAIAppSchema,
} from '@org/validation';
import {
  CurrentUser,
  RequireWorkspacePermissions,
  WorkspaceId,
  zodBody,
} from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import type { CreateAIAppInput } from '@org/types';
import { AIAppsService } from './ai-apps.service.js';

@Controller({ path: 'workspaces/:workspaceId/ai-apps', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class AIAppsController {
  constructor(private readonly appsService: AIAppsService) {}

  @Get()
  list(@WorkspaceId() workspaceId: string) {
    return this.appsService.listApps(workspaceId);
  }

  @Get(':id')
  get(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.appsService.getApp(workspaceId, id);
  }

  @Post()
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(createAIAppSchema)) body: CreateAIAppInput,
  ) {
    return this.appsService.createApp(workspaceId, userId, body);
  }

  @Patch(':id')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  update(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body(zodBody(updateAIAppSchema)) body: Partial<CreateAIAppInput>,
  ) {
    return this.appsService.updateApp(workspaceId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  delete(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.appsService.deleteApp(workspaceId, id);
  }

  @Post(':id/publish')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  publish(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body(zodBody(publishAIAppSchema)) { isPublished }: { isPublished: boolean },
  ) {
    return this.appsService.publishApp(workspaceId, id, isPublished);
  }

  @Post(':id/execute')
  // Runs a model on the workspace's credits; a guest could call it before.
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  execute(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body(zodBody(triggerWorkflowSchema)) payload: Record<string, unknown>,
  ) {
    return this.appsService.executeApp(workspaceId, userId, id, payload);
  }
}
