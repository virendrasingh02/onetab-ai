import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, WorkspaceId, WorkspaceMemberRole, WorkspacePolicies } from '@org/api-common';
import { isPolicyRoleAllowed, type CustomConnectorInput, type WorkspacePolicy, type WorkspaceRole } from '@org/types';
import { ConnectorRegistryService } from './connector-registry.service.js';
import { CustomConnectorsService } from './custom-connectors.service.js';

/** `whoCanInstallApps` (Settings → Permissions & Policies) governs workspace-wide connectors. */
const canInstallApps = (role: WorkspaceRole | undefined, policies: WorkspacePolicy | undefined) =>
  !policies || isPolicyRoleAllowed(role, policies.whoCanInstallApps);

/**
 * The App Connectors center's API. Connect / disconnect / run an action stay
 * on the existing `integrations` routes; this adds what every connector can
 * do (manifest), its usage and history, a real connection test, and the
 * connectors a workspace defines itself.
 */
@Controller({ version: '1' })
export class ConnectorsController {
  constructor(
    private readonly registry: ConnectorRegistryService,
    private readonly custom: CustomConnectorsService,
  ) {}

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

  // --- Connectors the workspace builds itself --------------------------------

  @Post('workspaces/:workspaceId/connectors-custom')
  @UseGuards(WorkspaceRoleGuard)
  createCustom(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @WorkspaceMemberRole() role: WorkspaceRole | undefined,
    @WorkspacePolicies() policies: WorkspacePolicy | undefined,
    @Body() body: CustomConnectorInput,
  ) {
    return this.custom.create(workspaceId, userId, body, canInstallApps(role, policies));
  }

  @Post('workspaces/:workspaceId/connectors-custom/test-connection')
  @UseGuards(WorkspaceRoleGuard)
  testCustomConnection(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @WorkspaceMemberRole() role: WorkspaceRole | undefined,
    @WorkspacePolicies() policies: WorkspacePolicy | undefined,
    @Body() body: { connector: CustomConnectorInput; integrationId?: string },
  ) {
    return this.custom.testConnection(workspaceId, userId, body, canInstallApps(role, policies));
  }

  @Post('workspaces/:workspaceId/connectors-custom/test-action')
  @UseGuards(WorkspaceRoleGuard)
  testCustomAction(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @WorkspaceMemberRole() role: WorkspaceRole | undefined,
    @WorkspacePolicies() policies: WorkspacePolicy | undefined,
    @Body()
    body: { connector: CustomConnectorInput; actionId: string; values?: Record<string, unknown>; confirm?: boolean; integrationId?: string },
  ) {
    return this.custom.preview(workspaceId, userId, body, canInstallApps(role, policies));
  }

  @Put('workspaces/:workspaceId/connectors-custom/:integrationId')
  @UseGuards(WorkspaceRoleGuard)
  updateCustom(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @WorkspaceMemberRole() role: WorkspaceRole | undefined,
    @WorkspacePolicies() policies: WorkspacePolicy | undefined,
    @Param('integrationId') integrationId: string,
    @Body() body: CustomConnectorInput,
  ) {
    return this.custom.update(workspaceId, userId, integrationId, body, canInstallApps(role, policies));
  }

  @Delete('workspaces/:workspaceId/connectors-custom/:integrationId')
  @UseGuards(WorkspaceRoleGuard)
  removeCustom(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @WorkspaceMemberRole() role: WorkspaceRole | undefined,
    @WorkspacePolicies() policies: WorkspacePolicy | undefined,
    @Param('integrationId') integrationId: string,
  ) {
    return this.custom.remove(workspaceId, userId, integrationId, canInstallApps(role, policies));
  }
}
