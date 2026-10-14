import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { MatrixModule } from '@org/api-matrix';
import { AppMatrixBridgeService } from './app-matrix-bridge.service.js';
import { ChannelAppsController } from './channel-apps.controller.js';
import { CustomConnectorsService } from './connectors/custom-connectors.service.js';
import { ConnectorRegistryService } from './connectors/connector-registry.service.js';
import { ConnectorGroupsController } from './connectors/connector-groups.controller.js';
import { ConnectorGroupsService } from './connectors/connector-groups.service.js';
import { ConnectorsController } from './connectors/connectors.controller.js';
import { ConnectorWebhookService } from './connectors/connector-webhook.service.js';
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
import { CustomConnectorProvider } from './providers/custom-connector.provider.js';
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
import { AttendanceProvider } from './providers/attendance.provider.js';
import { ShopifyProvider } from './providers/shopify.provider.js';
import { WhatsAppProvider } from './providers/whatsapp.provider.js';
import { VercelProvider } from './providers/vercel.provider.js';
import { HubSpotProvider } from './providers/hubspot.provider.js';
import { JiraProvider } from './providers/jira.provider.js';
import { ClickUpProvider } from './providers/clickup.provider.js';
import { AsanaProvider } from './providers/asana.provider.js';
import { ZendeskProvider } from './providers/zendesk.provider.js';
import { IntercomProvider } from './providers/intercom.provider.js';
import { AirtableProvider } from './providers/airtable.provider.js';
import { StripeProvider } from './providers/stripe.provider.js';
import { RazorpayProvider } from './providers/razorpay.provider.js';
import { WooCommerceProvider } from './providers/woocommerce.provider.js';
import { TelegramProvider } from './providers/telegram.provider.js';
import { SalesforceProvider } from './providers/salesforce.provider.js';
import { WordPressProvider } from './providers/wordpress.provider.js';
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
    ConnectorsController,
    ConnectorGroupsController,
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
    ConnectorRegistryService,
    CustomConnectorsService,
    ConnectorWebhookService,
    ConnectorGroupsService,

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
    CustomConnectorProvider,
    OneTabAppProvider,
    AttendanceProvider,
    ShopifyProvider,
    WhatsAppProvider,
    WordPressProvider,
    VercelProvider,
    HubSpotProvider,
    JiraProvider,
    ClickUpProvider,
    AsanaProvider,
    ZendeskProvider,
    IntercomProvider,
    AirtableProvider,
    StripeProvider,
    RazorpayProvider,
    WooCommerceProvider,
    TelegramProvider,
    SalesforceProvider,

    // Importers
    SlackImporterService,
    NotionImporterService,

    // Chat bridge
    AppMatrixBridgeService,
  ],
  exports: [
    IntegrationManagerService,
    IntegrationsService,
    ConnectorRegistryService,
    CustomConnectorsService,
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
    AttendanceProvider,
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
