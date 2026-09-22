import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { AIInfrastructureModule } from '@org/api-ai';
import { AgentsModule } from '@org/api-agents';
import { IntegrationsModule } from '@org/api-integrations';
import { AutomationTriggerListener } from './automation-trigger.listener.js';
import { AutomationsController } from './automations.controller.js';
import { AutomationsService } from './automations.service.js';
import { WorkflowEngineService } from './workflow-engine.service.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    AIInfrastructureModule,
    AgentsModule,
    IntegrationsModule,
  ],
  controllers: [AutomationsController],
  providers: [
    AutomationsService,
    WorkflowEngineService,
    AutomationTriggerListener,
  ],
  exports: [AutomationsService, WorkflowEngineService],
})
export class AutomationsModule {}
