import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { AIInfrastructureModule } from '@org/api-ai';
import { AutomationsController } from './automations.controller.js';
import { AutomationsService } from './automations.service.js';
import { WorkflowEngineService } from './workflow-engine.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, AIInfrastructureModule],
  controllers: [AutomationsController],
  providers: [AutomationsService, WorkflowEngineService],
  exports: [AutomationsService, WorkflowEngineService],
})
export class AutomationsModule {}
