import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, WorkspaceId, WorkspaceRoles } from '@org/api-common';
import { WorkspaceRole, type OAuthAppInput } from '@org/types';
import { OAuthAppCredentialsService } from '../core/oauth-app-credentials.service.js';

/**
 * A workspace's own OAuth apps for connectors. Anyone in the workspace can see
 * which apps are set up (the connect screens need it); only admins change them.
 * Secrets are write-only — they are never returned.
 */
@Controller({ version: '1' })
export class OAuthAppsController {
  constructor(private readonly oauthApps: OAuthAppCredentialsService) {}

  @Get('workspaces/:workspaceId/oauth-apps')
  @UseGuards(WorkspaceRoleGuard)
  list(@WorkspaceId() workspaceId: string) {
    return this.oauthApps.list(workspaceId);
  }

  @Put('workspaces/:workspaceId/oauth-apps/:appKey')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.ADMIN)
  save(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('appKey') appKey: string,
    @Body() body: OAuthAppInput,
  ) {
    return this.oauthApps.upsert(workspaceId, userId, appKey, body);
  }

  @Delete('workspaces/:workspaceId/oauth-apps/:appKey')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.ADMIN)
  remove(@WorkspaceId() workspaceId: string, @CurrentUser('id') userId: string, @Param('appKey') appKey: string) {
    return this.oauthApps.remove(workspaceId, userId, appKey);
  }
}
