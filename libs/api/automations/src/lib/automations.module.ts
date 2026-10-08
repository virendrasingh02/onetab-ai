import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { AIInfrastructureModule } from '@org/api-ai';
import { AgentsModule } from '@org/api-agents';
import { IntegrationsModule } from '@org/api-integrations';
import { RealtimeModule } from '@org/api-realtime';
import { AutomationTriggerListener } from './automation-trigger.listener.js';
import { AIRunsController } from './ai-runs.controller.js';
import { AutomationsController } from './automations.controller.js';
import { AutomationsService } from './automations.service.js';
import { AgentArchitectController } from './studio/agent-architect.controller.js';
import { AgentArchitectService } from './studio/agent-architect.service.js';
import { AgentPlannerService } from './studio/agent-planner.service.js';
import { AgentStudioController } from './studio/agent-studio.controller.js';
import { AgentStudioService } from './studio/agent-studio.service.js';
import { CanvasAgentRunController } from './studio/canvas-agent-run.controller.js';
import { CanvasAgentRunService } from './studio/canvas-agent-run.service.js';
import { ConnectorTriggerPollerService } from './studio/connector-trigger-poller.service.js';
import { WorkflowEngineService } from './workflow-engine.service.js';
import { WorkflowScheduleListener } from './workflow-schedule.listener.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    AIInfrastructureModule,
    AgentsModule,
    IntegrationsModule,
    // Live run updates (`ai.run.updated`) for the Studio.
    RealtimeModule,
  ],
  controllers: [AutomationsController, AIRunsController, AgentStudioController, CanvasAgentRunController, AgentArchitectController],
  providers: [
    AutomationsService,
    WorkflowEngineService,
    AutomationTriggerListener,
    WorkflowScheduleListener,
    AgentPlannerService,
    AgentStudioService,
    AgentArchitectService,
    CanvasAgentRunService,
    // Starts switched-on agents on app events (New email, New issue…).
    ConnectorTriggerPollerService,
  ],
  exports: [AutomationsService, WorkflowEngineService, AgentStudioService],
})
export class AutomationsModule {}
