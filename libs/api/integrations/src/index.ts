export { IntegrationsModule } from './lib/integrations.module.js';
export { IntegrationsService } from './lib/integrations.service.js';
export { IntegrationsController } from './lib/integrations.controller.js';
export { WebhooksController } from './lib/webhooks.controller.js';
export { SlackImporterService } from './lib/slack-importer.service.js';
export { NotionImporterService } from './lib/notion-importer.service.js';

export { IntegrationManagerService } from './lib/core/integration-manager.service.js';
export { IntegrationEncryptionService } from './lib/core/integration-encryption.service.js';
export { SSRFGuardService } from './lib/core/ssrf-guard.service.js';
export { OAuthService } from './lib/core/oauth.service.js';
export { WebhookService } from './lib/core/webhook.service.js';
export { IntegrationSyncService } from './lib/core/integration-sync.service.js';
export { IntegrationLoggerService } from './lib/core/integration-logger.service.js';
export { IntegrationPermissionService } from './lib/core/integration-permission.service.js';

export { GmailProvider } from './lib/providers/gmail.provider.js';
export { CustomApiProvider } from './lib/providers/custom-api.provider.js';
export { OneTabAppProvider } from './lib/providers/onetab-app.provider.js';

export type {
  ProviderAdapter,
  TokenResult,
  ResolvedCredential,
  SyncResult,
  WebhookProcessResult,
  MessageQuery,
} from './lib/core/provider-adapter.interface.js';

export { MigrationController } from './lib/migration/migration.controller.js';
export { SlackCapabilityChecker } from './lib/migration/slack-capability-checker.service.js';
export { SlackApiMigrationProvider } from './lib/migration/slack-api-migration.provider.js';
export { SlackExportMigrationProvider } from './lib/migration/slack-export-migration.provider.js';
export { MigrationReadinessService } from './lib/migration/migration-readiness.service.js';
export { MigrationMappingService } from './lib/migration/migration-mapping.service.js';
export { MigrationValidationService } from './lib/migration/migration-validation.service.js';
export { MigrationAiAdvisorService } from './lib/migration/migration-ai-advisor.service.js';
export { MigrationWorkerService } from './lib/migration/migration-worker.service.js';
export { MigrationEngineService } from './lib/migration/migration-engine.service.js';
export type { MigrationProvider } from './lib/migration/migration-provider.interface.js';
