import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentsModule } from '@org/api-agents';
import { AIInfrastructureModule } from '@org/api-ai';
import { AuthModule } from '@org/api-auth';
import { MatrixModule } from '@org/api-matrix';
import { RealtimeModule } from '@org/api-realtime';
import { PrismaModule } from '@org/database';
import { CoworkerRuntimeService } from './coworker-runtime.service.js';
import {
  ChannelCoworkersController,
  CoworkersController,
  ProjectCoworkersController,
} from './coworkers.controller.js';
import { CoworkersService } from './coworkers.service.js';

/**
 * AI Coworkers — the persistent-teammate layer above AI Agents.
 *
 * Imports `AgentsModule` to reuse `AgentsService` (delegation calls) and
 * `MCPToolRegistryService` (the shared tool registry) rather than
 * duplicating either; imports `MatrixModule` for the same bot-identity/
 * inbound-routing seam `AgentsModule` already uses.
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    AIInfrastructureModule,
    MatrixModule,
    RealtimeModule,
    AgentsModule,
  ],
  controllers: [
    CoworkersController,
    ChannelCoworkersController,
    ProjectCoworkersController,
  ],
  providers: [CoworkersService, CoworkerRuntimeService],
  exports: [CoworkersService, CoworkerRuntimeService],
})
export class CoworkersModule {}
