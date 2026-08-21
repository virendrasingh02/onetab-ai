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

@Module({
  imports: [ConfigModule, AuthModule, PrismaModule],
  controllers: [AIPlatformController, PromptTemplateController],
  providers: [
    AIEncryptionService,
    ProviderRegistryService,
    ModelRegistryService,
    ModelResolverService,
    AICredentialService,
    AIInfrastructureService,
    PromptTemplateService,
  ],
  exports: [
    AIEncryptionService,
    ProviderRegistryService,
    ModelRegistryService,
    ModelResolverService,
    AICredentialService,
    AIInfrastructureService,
    PromptTemplateService,
  ],
})
export class AIInfrastructureModule {}
