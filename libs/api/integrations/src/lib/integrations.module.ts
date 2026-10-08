import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { MatrixModule } from '@org/api-matrix';
import { AppMatrixBridgeService } from './app-matrix-bridge.service.js';
import { ChannelAppsController } from './channel-apps.controller.js';
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
import { MicrosoftTeamsProvider } from './providers/microsoft-teams.provider.js';
import { SlackProvider } from './providers/slack.provider.js';
import { TrelloProvider } from './providers/trello.provider.js';
import { SlackImporterService } from './slack-importer.service.js';
import { WebhooksController } from './webhooks.controller.js';
import { MigrationController } from './migration/migration.controller.js';
import { SlackCapabilityChecker } from './migration/slack-capability-checker.service.js';
import { SlackApiMigrationProvider } from './migration/slack-api-migration.provider.js';
import { SlackExportMigrationProvider } from './migration/slack-export-migration.provider.js';
import { MigrationReadinessService } from './migration/migration-readiness.service.js';
import { MigrationMappingService } from './migration/migration-mapping.service.js';
import { MigrationValidationService } from './migration/migration-validation.service.js';
import { MigrationAiAdvisorService } from './migration/migration-ai-advisor.service.js';
import { MigrationWorkerService } from './migration/migration-worker.service.js';
import { MigrationEngineService } from './migration/migration-engine.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, MatrixModule],
  controllers: [
    IntegrationsController,
    WebhooksController,
    ChannelAppsController,
    MigrationController,
  ],
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

    // Migration Engine Services
    SlackCapabilityChecker,
    SlackApiMigrationProvider,
    SlackExportMigrationProvider,
    MigrationReadinessService,
    MigrationMappingService,
    MigrationValidationService,
    MigrationAiAdvisorService,
    MigrationWorkerService,
    MigrationEngineService,

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
    MicrosoftTeamsProvider,
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
    SlackCapabilityChecker,
    SlackApiMigrationProvider,
    SlackExportMigrationProvider,
    MigrationReadinessService,
    MigrationMappingService,
    MigrationValidationService,
    MigrationAiAdvisorService,
    MigrationWorkerService,
    MigrationEngineService,
  ],
})
export class IntegrationsModule {}
