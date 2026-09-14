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
import { WorkspacePermission } from '@org/types';
import { IntegrationsService } from './integrations.service.js';

/**
 * Which apps a channel has added — mirrors `ChannelAgentsController` /
 * `ChannelCoworkersController` exactly (brief §4). `AppMatrixBridgeService`
 * reads these rows the same way it already reads `ChannelAgent`/
 * `ChannelCoworker` to decide whether a connected app may act in a channel.
 */
@Controller({
  path: 'workspaces/:workspaceId/channels/:channelId/apps',
  version: '1',
})
@UseGuards(WorkspaceRoleGuard)
export class ChannelAppsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  list(
    @WorkspaceId() workspaceId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.integrationsService.listChannelApps(workspaceId, channelId);
  }

  @Post()
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  add(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('channelId') channelId: string,
    @Body() body: { integrationId: string },
  ) {
    return this.integrationsService.addChannelApp(
      workspaceId,
      channelId,
      body.integrationId,
      userId,
    );
  }

  @Patch(':integrationId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  setEnabled(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('channelId') channelId: string,
    @Param('integrationId') integrationId: string,
    @Body() body: { isEnabled: boolean },
  ) {
    return this.integrationsService.setChannelAppEnabled(
      workspaceId,
      channelId,
      integrationId,
      body.isEnabled,
      userId,
    );
  }

  @Delete(':integrationId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('channelId') channelId: string,
    @Param('integrationId') integrationId: string,
  ): Promise<void> {
    return this.integrationsService.removeChannelApp(
      workspaceId,
      channelId,
      integrationId,
      userId,
    );
  }
}
