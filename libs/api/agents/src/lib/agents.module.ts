import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { AIInfrastructureModule } from '@org/api-ai';
import { IntegrationsModule } from '@org/api-integrations';
import { MatrixModule } from '@org/api-matrix';
import { RealtimeModule } from '@org/api-realtime';
import { WorkspaceModule } from '@org/api-workspace';
import { AgentApprovalListener } from './agent-approval.listener.js';
import { AgentMatrixBridgeService } from './agent-matrix-bridge.service.js';
import { AgentScheduleSweepService } from './agent-schedule-sweep.service.js';
import {
  AgentsController,
  ChannelAgentsController,
} from './agents.controller.js';
import { AIEntitiesController } from './ai-entities.controller.js';
import { AgentsService } from './agents.service.js';
import { AIEntitiesService } from './ai-entities.service.js';
import { AIRuntimeService } from './ai-runtime.service.js';
import { IntegrationToolBridgeService } from './integration-tool-bridge.service.js';
import { MCPToolRegistryService } from './mcp-tool-registry.service.js';

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
  ],
  controllers: [
    AgentsController,
    ChannelAgentsController,
    AIEntitiesController,
  ],
  providers: [
    AgentsService,
    AIEntitiesService,
    AIRuntimeService,
    MCPToolRegistryService,
    IntegrationToolBridgeService,
    AgentMatrixBridgeService,
    AgentApprovalListener,
    AgentScheduleSweepService,
  ],
  exports: [
    AgentsService,
    AIEntitiesService,
    AIRuntimeService,
    MCPToolRegistryService,
  ],
})
export class AgentsModule {}
