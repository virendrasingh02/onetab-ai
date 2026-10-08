import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, WorkspaceId } from '@org/api-common';
import { ConnectorRegistryService } from './connector-registry.service.js';

/**
 * The App Connectors center's API. Connect / disconnect / run an action stay
 * on the existing `integrations` routes; this adds what every connector can
 * do (manifest), its usage and history, and a real connection test.
 */
@Controller({ version: '1' })
export class ConnectorsController {
  constructor(private readonly registry: ConnectorRegistryService) {}

  @Get('workspaces/:workspaceId/connectors')
  @UseGuards(WorkspaceRoleGuard)
  list(@WorkspaceId() workspaceId: string, @CurrentUser('id') userId: string) {
    return this.registry.list(workspaceId, userId);
  }

  @Get('workspaces/:workspaceId/connectors/:provider')
  @UseGuards(WorkspaceRoleGuard)
  detail(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('provider') provider: string,
  ) {
    return this.registry.detail(workspaceId, userId, provider);
  }

  @Post('workspaces/:workspaceId/integrations/:id/test')
  @UseGuards(WorkspaceRoleGuard)
  test(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') integrationId: string,
  ) {
    return this.registry.testConnection(workspaceId, userId, integrationId);
  }
}
