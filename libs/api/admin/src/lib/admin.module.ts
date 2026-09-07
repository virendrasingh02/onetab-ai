import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { CacheModule } from '@org/api-cache';
import { PrismaModule } from '@org/database';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { AdminAppVersionsController } from './app-versions.controller.js';
import { AppVersionsPublicController } from './app-versions-public.controller.js';
import { AppVersionsService } from './app-versions.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, CacheModule],
  controllers: [
    AdminController,
    AdminAppVersionsController,
    AppVersionsPublicController,
  ],
  providers: [AdminService, AppVersionsService],
  exports: [AdminService, AppVersionsService],
})
export class AdminModule {}
