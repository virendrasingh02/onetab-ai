import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { AIInfrastructureModule } from '@org/api-ai';
import { AgentsController } from './agents.controller.js';
import { AgentsService } from './agents.service.js';
import { MCPToolRegistryService } from './mcp-tool-registry.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, AIInfrastructureModule],
  controllers: [AgentsController],
  providers: [AgentsService, MCPToolRegistryService],
  exports: [AgentsService, MCPToolRegistryService],
})
export class AgentsModule {}
