import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { AIInfrastructureModule } from '@org/api-ai';
import { MatrixModule } from '@org/api-matrix';
import { AgentMatrixBridgeService } from './agent-matrix-bridge.service.js';
import {
  AgentsController,
  ChannelAgentsController,
} from './agents.controller.js';
import { AgentsService } from './agents.service.js';
import { MCPToolRegistryService } from './mcp-tool-registry.service.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    AIInfrastructureModule,
    MatrixModule,
  ],
  controllers: [AgentsController, ChannelAgentsController],
  providers: [AgentsService, MCPToolRegistryService, AgentMatrixBridgeService],
  exports: [AgentsService, MCPToolRegistryService],
})
export class AgentsModule {}
