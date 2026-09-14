import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { AIInfrastructureModule } from '@org/api-ai';
import { MatrixModule } from '@org/api-matrix';
import { RealtimeModule } from '@org/api-realtime';
import { AgentMatrixBridgeService } from './agent-matrix-bridge.service.js';
import {
  AgentsController,
  ChannelAgentsController,
} from './agents.controller.js';
import { AIEntitiesController } from './ai-entities.controller.js';
import { AgentsService } from './agents.service.js';
import { AIEntitiesService } from './ai-entities.service.js';
import { AIRuntimeService } from './ai-runtime.service.js';
import { MCPToolRegistryService } from './mcp-tool-registry.service.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    AIInfrastructureModule,
    MatrixModule,
    RealtimeModule,
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
    AgentMatrixBridgeService,
  ],
  exports: [
    AgentsService,
    AIEntitiesService,
    AIRuntimeService,
    MCPToolRegistryService,
  ],
})
export class AgentsModule {}
