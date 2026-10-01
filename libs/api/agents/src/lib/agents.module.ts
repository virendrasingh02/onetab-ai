import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { AIInfrastructureModule } from '@org/api-ai';
import { IntegrationsModule } from '@org/api-integrations';
import { MatrixModule } from '@org/api-matrix';
import { RealtimeModule } from '@org/api-realtime';
import { WorkToolsModule } from '@org/api-work-tools';
import { WorkspaceModule } from '@org/api-workspace';
import { AgentApprovalListener } from './agent-approval.listener.js';
import { AgentMatrixBridgeService } from './agent-matrix-bridge.service.js';
import { AgentScheduleSweepService } from './agent-schedule-sweep.service.js';
import {
  AgentsController,
  ChannelAgentsController,
} from './agents.controller.js';
import { AIEntitiesController } from './ai-entities.controller.js';
import { AgentStudioAiModeController } from './agent-studio-ai-mode.controller.js';
import { AgentsService } from './agents.service.js';
import { AIEntitiesService } from './ai-entities.service.js';
import { AIRuntimeService } from './ai-runtime.service.js';
import { AgentStudioAiModeService } from './agent-studio-ai-mode.service.js';
import { IntegrationToolBridgeService } from './integration-tool-bridge.service.js';
import { MCPToolRegistryService } from './mcp-tool-registry.service.js';
import { FirecrawlService } from './firecrawl.service.js';
import { AIResourceManageGuard } from './ai-entity-access.guard.js';
import { AgentOutputDeliveryService } from './agent-output-delivery.service.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    AIInfrastructureModule,
    IntegrationsModule,
    MatrixModule,
    RealtimeModule,
    WorkspaceModule,
    // Agent tools create and update tasks through WorkToolsService, so they
    // get identifiers, events and notifications like any other task.
    WorkToolsModule,
  ],
  controllers: [
    AgentsController,
    ChannelAgentsController,
    AIEntitiesController,
    AgentStudioAiModeController,
  ],
  providers: [
    AgentsService,
    AIEntitiesService,
    AIRuntimeService,
    AgentStudioAiModeService,
    MCPToolRegistryService,
    FirecrawlService,
    IntegrationToolBridgeService,
    AgentMatrixBridgeService,
    AgentApprovalListener,
    AgentScheduleSweepService,
    AgentOutputDeliveryService,
    AIResourceManageGuard,
  ],
  exports: [
    AIResourceManageGuard,
    AgentsService,
    AIEntitiesService,
    AIRuntimeService,
    AgentStudioAiModeService,
    MCPToolRegistryService,
    FirecrawlService,
  ],
})
export class AgentsModule {}
