import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { IntegrationsController } from './integrations.controller.js';
import { IntegrationsService } from './integrations.service.js';
import { SlackImporterService } from './slack-importer.service.js';
import { NotionImporterService } from './notion-importer.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, SlackImporterService, NotionImporterService],
  exports: [IntegrationsService, SlackImporterService, NotionImporterService],
})
export class IntegrationsModule {}
