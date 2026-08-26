import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, Public, WorkspaceId, WorkspaceRoles } from '@org/api-common';
import {
  WorkspaceRole,
  type IntegrationExecuteRequestInput,
  type ReplyMessageInput,
  type SendMessageInput,
} from '@org/types';
import type { Response } from 'express';
import { IntegrationsService } from './integrations.service.js';
import { NotionImporterService } from './notion-importer.service.js';
import { SlackImporterService } from './slack-importer.service.js';

@Controller({ version: '1' })
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly slackImporter: SlackImporterService,
    private readonly notionImporter: NotionImporterService,
  ) {}

  // --- Public / Global OAuth Callback Endpoints -----------------------------

  @Public()
  @Get('integrations/:provider/callback')
  async handleGlobalOAuthCallback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const result = await this.integrationsService.handleOAuthCallback(code, state);

    if (result.redirectUrl) {
      return res.redirect(
        `${result.redirectUrl}?integration_connected=${provider.toLowerCase()}&status=success`,
      );
    }

    // Default HTML response with script to communicate with opener or redirect
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Integration Connected</title></head>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc;">
          <div style="text-align: center; padding: 2rem; background: #1e293b; border-radius: 1rem; border: 1px solid #334155;">
            <h2 style="color: #22c55e; margin-bottom: 0.5rem;">Connection Successful!</h2>
            <p style="color: #94a3b8; font-size: 0.875rem;">You have connected ${provider.toUpperCase()} to OneTab AI.</p>
            <p style="color: #64748b; font-size: 0.75rem; margin-top: 1rem;">This window will close automatically...</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'INTEGRATION_CONNECTED', provider: '${provider}' }, '*');
              setTimeout(() => window.close(), 1200);
            } else {
              setTimeout(() => { window.location.href = '/integrations'; }, 1500);
            }
          </script>
        </body>
      </html>
    `);
  }

  // --- Workspace-scoped Integrations Endpoints -------------------------------

  @Get('workspaces/:workspaceId/integrations')
  @UseGuards(WorkspaceRoleGuard)
  getConnectedIntegrations(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.integrationsService.getConnectedIntegrations(workspaceId, userId);
  }

  @Get('workspaces/:workspaceId/integrations/providers')
  @UseGuards(WorkspaceRoleGuard)
  getAvailableProviders() {
    return this.integrationsService.getAvailableProviders();
  }

  @Get('workspaces/:workspaceId/integrations/:id')
  @UseGuards(WorkspaceRoleGuard)
  getIntegrationDetail(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') integrationId: string,
  ) {
    return this.integrationsService.getIntegrationDetail(integrationId, userId, workspaceId);
  }

  @Post('workspaces/:workspaceId/integrations/:provider/connect')
  @UseGuards(WorkspaceRoleGuard)
  connectProvider(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('provider') provider: string,
    @Body()
    body: {
      scopeType?: 'WORKSPACE' | 'USER';
      accessToken?: string;
      config?: Record<string, unknown>;
      redirectUri?: string;
    },
  ) {
    return this.integrationsService.initiateConnect({
      provider,
      workspaceId,
      userId,
      scopeType: body.scopeType,
      config: body.config,
      redirectUri: body.redirectUri,
    });
  }

  @Post('workspaces/:workspaceId/integrations/:id/disconnect')
  @UseGuards(WorkspaceRoleGuard)
  disconnectIntegration(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') integrationId: string,
  ) {
    return this.integrationsService.disconnectIntegration(integrationId, userId, workspaceId);
  }

  @Delete('workspaces/:workspaceId/integrations/:provider')
  @UseGuards(WorkspaceRoleGuard)
  legacyDisconnect(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('provider') provider: string,
  ) {
    const integrationId = `${workspaceId}_${provider.toUpperCase()}`;
    return this.integrationsService.disconnectIntegration(integrationId, userId, workspaceId);
  }

  @Post('workspaces/:workspaceId/integrations/:id/sync')
  @UseGuards(WorkspaceRoleGuard)
  triggerSync(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') integrationId: string,
  ) {
    return this.integrationsService.triggerSync(integrationId, userId, workspaceId);
  }

  @Get('workspaces/:workspaceId/integrations/:id/jobs')
  @UseGuards(WorkspaceRoleGuard)
  getSyncJobs(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') integrationId: string,
  ) {
    return this.integrationsService.getSyncJobs(integrationId, userId, workspaceId);
  }

  // --- Normalized Message & Thread Endpoints ---------------------------------

  @Get('workspaces/:workspaceId/integrations/:id/messages')
  @UseGuards(WorkspaceRoleGuard)
  getMessages(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') integrationId: string,
    @Query('q') query?: string,
    @Query('pageToken') pageToken?: string,
    @Query('maxResults') maxResults?: string,
  ) {
    return this.integrationsService.getMessages(integrationId, userId, workspaceId, {
      query,
      pageToken,
      maxResults: maxResults ? Number.parseInt(maxResults, 10) : 20,
    });
  }

  @Get('workspaces/:workspaceId/integrations/:id/threads/:threadId')
  @UseGuards(WorkspaceRoleGuard)
  getThread(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') integrationId: string,
    @Param('threadId') threadId: string,
  ) {
    return this.integrationsService.getThread(integrationId, threadId, userId, workspaceId);
  }

  @Post('workspaces/:workspaceId/integrations/:id/messages')
  @UseGuards(WorkspaceRoleGuard)
  sendMessage(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') integrationId: string,
    @Body() body: SendMessageInput,
  ) {
    return this.integrationsService.sendMessage(integrationId, body, userId, workspaceId);
  }

  @Post('workspaces/:workspaceId/integrations/:id/reply')
  @UseGuards(WorkspaceRoleGuard)
  replyMessage(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') integrationId: string,
    @Body() body: ReplyMessageInput,
  ) {
    return this.integrationsService.replyMessage(integrationId, body, userId, workspaceId);
  }

  @Post('workspaces/:workspaceId/integrations/:id/drafts')
  @UseGuards(WorkspaceRoleGuard)
  createDraft(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') integrationId: string,
    @Body() body: SendMessageInput,
  ) {
    return this.integrationsService.createDraft(integrationId, body, userId, workspaceId);
  }

  @Patch('workspaces/:workspaceId/integrations/:id/messages/:messageId/labels')
  @UseGuards(WorkspaceRoleGuard)
  modifyLabels(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') integrationId: string,
    @Param('messageId') messageId: string,
    @Body() body: { addLabelIds?: string[]; removeLabelIds?: string[] },
  ) {
    return this.integrationsService.modifyLabels(
      integrationId,
      messageId,
      body.addLabelIds,
      body.removeLabelIds,
      userId,
      workspaceId,
    );
  }

  // --- Custom API Execution & Testing Endpoints ------------------------------

  @Post('workspaces/:workspaceId/integrations/custom/test')
  @UseGuards(WorkspaceRoleGuard)
  testCustomApiConnection(
    @Body() body: Record<string, unknown>,
  ) {
    return this.integrationsService.testCustomApi(body);
  }

  @Post('workspaces/:workspaceId/integrations/:id/custom/execute')
  @UseGuards(WorkspaceRoleGuard)
  executeCustomRequest(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') integrationId: string,
    @Body() body: IntegrationExecuteRequestInput,
  ) {
    return this.integrationsService.executeCustomRequest(
      integrationId,
      body,
      userId,
      workspaceId,
    );
  }

  // --- Legacy Import Archive Endpoints ---------------------------------------

  @Post('workspaces/:workspaceId/integrations/import/slack')
  @UseGuards(WorkspaceRoleGuard)
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

  @Post('workspaces/:workspaceId/integrations/import/notion')
  @UseGuards(WorkspaceRoleGuard)
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
