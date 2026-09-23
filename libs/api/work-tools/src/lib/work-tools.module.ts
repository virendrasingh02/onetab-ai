import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIInfrastructureModule } from '@org/api-ai';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { CallAccessService } from './call-access.service.js';
import { CallSummaryService } from './call-summary.service.js';
import { CallsController } from './calls.controller.js';
import { CallsService } from './calls.service.js';
import { ContextLinksService } from './context-links.service.js';
import { MeetingsController } from './meetings.controller.js';
import { MeetingsService } from './meetings.service.js';
import { WorkToolsController } from './work-tools.controller.js';
import { WorkToolsService } from './work-tools.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, AIInfrastructureModule],
  controllers: [WorkToolsController, MeetingsController, CallsController],
  providers: [
    WorkToolsService,
    MeetingsService,
    ContextLinksService,
    CallAccessService,
    CallsService,
    CallSummaryService,
  ],
  exports: [
    WorkToolsService,
    MeetingsService,
    ContextLinksService,
    CallAccessService,
    CallsService,
    CallSummaryService,
  ],
})
export class WorkToolsModule {}
