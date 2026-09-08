import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { ContextLinksService } from './context-links.service.js';
import { MeetingsController } from './meetings.controller.js';
import { MeetingsService } from './meetings.service.js';
import { WorkToolsController } from './work-tools.controller.js';
import { WorkToolsService } from './work-tools.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
  controllers: [WorkToolsController, MeetingsController],
  providers: [WorkToolsService, MeetingsService, ContextLinksService],
  exports: [WorkToolsService, MeetingsService, ContextLinksService],
})
export class WorkToolsModule {}
