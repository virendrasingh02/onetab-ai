import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { WorkToolsController } from './work-tools.controller.js';
import { WorkToolsService } from './work-tools.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
  controllers: [WorkToolsController],
  providers: [WorkToolsService],
  exports: [WorkToolsService],
})
export class WorkToolsModule {}
