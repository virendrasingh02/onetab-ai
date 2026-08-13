import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { AIInfrastructureService } from './ai-infrastructure.service.js';
import { AIPlatformController } from './ai-platform.controller.js';
import { PromptTemplateController } from './prompt-template.controller.js';
import { PromptTemplateService } from './prompt-template.service.js';

@Module({
  imports: [ConfigModule, AuthModule, PrismaModule],
  controllers: [AIPlatformController, PromptTemplateController],
  providers: [AIInfrastructureService, PromptTemplateService],
  exports: [AIInfrastructureService, PromptTemplateService],
})
export class AIInfrastructureModule {}
