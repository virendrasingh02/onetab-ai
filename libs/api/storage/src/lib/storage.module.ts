import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { StorageService } from './storage.service.js';
import { UploadController } from './upload.controller.js';
import { UploadService } from './upload.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
  controllers: [UploadController],
  providers: [StorageService, UploadService],
  exports: [StorageService, UploadService],
})
export class StorageModule {}
