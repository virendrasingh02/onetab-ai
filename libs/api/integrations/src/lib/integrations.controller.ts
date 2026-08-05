import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@org/api-auth';
import { CurrentUser } from '@org/api-common';
import { IntegrationsService } from './integrations.service.js';
import { SlackImporterService } from './slack-importer.service.js';
import { NotionImporterService } from './notion-importer.service.js';

@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly slackImporter: SlackImporterService,
    private readonly notionImporter: NotionImporterService
  ) {}

  @Get()
  getConnectedIntegrations(@Query('workspaceId') workspaceId: string) {
    return this.integrationsService.getConnectedIntegrations(workspaceId);
  }

  @Post(':provider/connect')
  connectProvider(
    @Param('provider') provider: string,
    @Body() body: { workspaceId: string; accessToken?: string; config?: Record<string, unknown> }
  ) {
    return this.integrationsService.connectProvider(body.workspaceId, provider.toUpperCase(), body.accessToken, body.config);
  }

  @Post('import/slack')
  importSlackArchive(
    @CurrentUser('id') userId: string,
    @Body() body: { workspaceId: string; channels: Array<{ name: string; topic?: string; messagesCount: number }> }
  ) {
    return this.slackImporter.importSlackArchive(body.workspaceId, userId, body.channels);
  }

  @Post('import/notion')
  importNotionPages(
    @CurrentUser('id') userId: string,
    @Body() body: { workspaceId: string; pages: Array<{ title: string; content: string }> }
  ) {
    return this.notionImporter.importNotionPages(body.workspaceId, userId, body.pages);
  }
}
