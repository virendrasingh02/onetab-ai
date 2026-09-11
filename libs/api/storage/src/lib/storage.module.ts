import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { MediaProcessingModule } from '@org/api-media-processing';
import { StorageService } from './storage.service.js';
import { UploadCleanupService } from './upload-cleanup.service.js';
import {
  PublicFileController,
  UploadController,
} from './upload.controller.js';
import { UploadService } from './upload.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, MediaProcessingModule],
  controllers: [UploadController, PublicFileController],
  providers: [StorageService, UploadService, UploadCleanupService],
  exports: [StorageService, UploadService, MediaProcessingModule],
})
export class StorageModule {}
