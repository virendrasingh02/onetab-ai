import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { AIEncryptionService } from './ai-encryption.service.js';
import { AICredentialService } from './ai-credential.service.js';
import { AIInfrastructureService } from './ai-infrastructure.service.js';
import { AIPlatformController } from './ai-platform.controller.js';
import { ModelRegistryService } from './model-registry.service.js';
import { ModelResolverService } from './model-resolver.service.js';
import { PromptTemplateController } from './prompt-template.controller.js';
import { PromptTemplateService } from './prompt-template.service.js';
import { ProviderRegistryService } from './provider-registry.service.js';
import { QdrantVectorService } from './qdrant-vector.service.js';
import { RagIngestListener } from './rag-ingest.listener.js';
import { KnowledgeService } from './knowledge.service.js';
import { KnowledgeController } from './knowledge.controller.js';
import { AIStudioService } from './ai-studio.service.js';
import { AIStudioController } from './ai-studio.controller.js';
import { AIAppsService } from './ai-apps.service.js';
import { AIAppsController } from './ai-apps.controller.js';
import { ApprovalsService } from './approvals.service.js';
import { ApprovalsController } from './approvals.controller.js';
import { AISecretsService } from './ai-secrets.service.js';
import { AISecretsController } from './ai-secrets.controller.js';
import { MCPService } from './mcp.service.js';
import { MCPController } from './mcp.controller.js';
import { AIFeedbackService } from './ai-feedback.service.js';
import { AIFeedbackController } from './ai-feedback.controller.js';
import { AIExecutionsService } from './ai-executions.service.js';
import { AIExecutionsController } from './ai-executions.controller.js';

@Module({
  imports: [ConfigModule, AuthModule, PrismaModule],
  controllers: [
    AIPlatformController,
    PromptTemplateController,
    KnowledgeController,
    AIStudioController,
    AIAppsController,
    ApprovalsController,
    AISecretsController,
    MCPController,
    AIFeedbackController,
    AIExecutionsController,
  ],
  providers: [
    AIEncryptionService,
    ProviderRegistryService,
    ModelRegistryService,
    ModelResolverService,
    AICredentialService,
    QdrantVectorService,
    AIInfrastructureService,
    PromptTemplateService,
    RagIngestListener,
    KnowledgeService,
    AIStudioService,
    AIAppsService,
    ApprovalsService,
    AISecretsService,
    MCPService,
    AIFeedbackService,
    AIExecutionsService,
  ],
  exports: [
    AIEncryptionService,
    ProviderRegistryService,
    ModelRegistryService,
    ModelResolverService,
    AICredentialService,
    QdrantVectorService,
    AIInfrastructureService,
    PromptTemplateService,
    KnowledgeService,
    AIStudioService,
    AIAppsService,
    ApprovalsService,
    AISecretsService,
    MCPService,
    AIFeedbackService,
    AIExecutionsService,
  ],
})
export class AIInfrastructureModule {}
