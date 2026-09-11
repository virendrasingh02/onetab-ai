import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { MatrixModule } from '@org/api-matrix';
import { AppMatrixBridgeService } from './app-matrix-bridge.service.js';
import { IntegrationEncryptionService } from './core/integration-encryption.service.js';
import { IntegrationLoggerService } from './core/integration-logger.service.js';
import { IntegrationManagerService } from './core/integration-manager.service.js';
import { IntegrationPermissionService } from './core/integration-permission.service.js';
import { IntegrationSyncService } from './core/integration-sync.service.js';
import { OAuthService } from './core/oauth.service.js';
import { SSRFGuardService } from './core/ssrf-guard.service.js';
import { WebhookService } from './core/webhook.service.js';
import { IntegrationsController } from './integrations.controller.js';
import { IntegrationsService } from './integrations.service.js';
import { NotionImporterService } from './notion-importer.service.js';
import { CustomApiProvider } from './providers/custom-api.provider.js';
import { GitHubProvider } from './providers/github.provider.js';
import { GmailProvider } from './providers/gmail.provider.js';
import { GoogleCalendarProvider } from './providers/google-calendar.provider.js';
import { GoogleDocsProvider } from './providers/google-docs.provider.js';
import { GoogleDriveProvider } from './providers/google-drive.provider.js';
import { GoogleSheetsProvider } from './providers/google-sheets.provider.js';
import { LinearProvider } from './providers/linear.provider.js';
import { NotionProvider } from './providers/notion.provider.js';
import { OneTabAppProvider } from './providers/onetab-app.provider.js';
import { SlackProvider } from './providers/slack.provider.js';
import { TrelloProvider } from './providers/trello.provider.js';
import { SlackImporterService } from './slack-importer.service.js';
import { WebhooksController } from './webhooks.controller.js';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, MatrixModule],
  controllers: [IntegrationsController, WebhooksController],
  providers: [
    // Core Services
    IntegrationEncryptionService,
    SSRFGuardService,
    OAuthService,
    IntegrationLoggerService,
    IntegrationPermissionService,
    WebhookService,
    IntegrationSyncService,
    IntegrationManagerService,
    IntegrationsService,

    // Provider Adapters
    GmailProvider,
    GoogleCalendarProvider,
    GoogleDriveProvider,
    GoogleDocsProvider,
    GoogleSheetsProvider,
    GitHubProvider,
    LinearProvider,
    NotionProvider,
    SlackProvider,
    TrelloProvider,
    CustomApiProvider,
    OneTabAppProvider,

    // Importers
    SlackImporterService,
    NotionImporterService,

    // Chat bridge
    AppMatrixBridgeService,
  ],
  exports: [
    IntegrationManagerService,
    IntegrationsService,
    IntegrationEncryptionService,
    SSRFGuardService,
    OAuthService,
    WebhookService,
    IntegrationSyncService,
    GmailProvider,
    GoogleCalendarProvider,
    GoogleDriveProvider,
    GoogleDocsProvider,
    GoogleSheetsProvider,
    GitHubProvider,
    LinearProvider,
    NotionProvider,
    SlackProvider,
    TrelloProvider,
    CustomApiProvider,
    SlackImporterService,
    NotionImporterService,
  ],
})
export class IntegrationsModule {}
