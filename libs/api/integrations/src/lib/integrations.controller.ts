import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, WorkspaceId, WorkspaceRoles } from '@org/api-common';
import { WorkspaceRole } from '@org/types';
import { IntegrationsService } from './integrations.service.js';
import { SlackImporterService } from './slack-importer.service.js';
import { NotionImporterService } from './notion-importer.service.js';

/**
 * Third-party connections for one workspace.
 *
 * Guarded by the workspace path parameter — the previous `?workspaceId=` shape
 * let any signed-in account enumerate another tenant's connected providers and
 * write imported content into their workspace.
 *
 * Connecting and importing require ADMIN: both hand an outside system a
 * foothold in the workspace, which is not an ordinary member's decision.
 */
@Controller({ path: 'workspaces/:workspaceId/integrations', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly slackImporter: SlackImporterService,
    private readonly notionImporter: NotionImporterService,
  ) {}

  @Get()
  getConnectedIntegrations(@WorkspaceId() workspaceId: string) {
    return this.integrationsService.getConnectedIntegrations(workspaceId);
  }

  @Post(':provider/connect')
  @WorkspaceRoles(WorkspaceRole.ADMIN)
  connectProvider(
    @WorkspaceId() workspaceId: string,
    @Param('provider') provider: string,
    @Body() body: { accessToken?: string; config?: Record<string, unknown> },
  ) {
    return this.integrationsService.connectProvider(
      workspaceId,
      provider.toUpperCase(),
      body.accessToken,
      body.config,
    );
  }

  @Delete(':provider')
  @WorkspaceRoles(WorkspaceRole.ADMIN)
  disconnectProvider(
    @WorkspaceId() workspaceId: string,
    @Param('provider') provider: string,
  ) {
    return this.integrationsService.disconnectProvider(
      workspaceId,
      provider.toUpperCase(),
    );
  }

  @Post('import/slack')
  @WorkspaceRoles(WorkspaceRole.ADMIN)
  importSlackArchive(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      channels: Array<{ name: string; topic?: string; messagesCount: number }>;
    },
  ) {
    return this.slackImporter.importSlackArchive(
      workspaceId,
      userId,
      body.channels,
    );
  }

  @Post('import/notion')
  @WorkspaceRoles(WorkspaceRole.ADMIN)
  importNotionPages(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { pages: Array<{ title: string; content: string }> },
  ) {
    return this.notionImporter.importNotionPages(
      workspaceId,
      userId,
      body.pages,
    );
  }
}
