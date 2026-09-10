import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { CacheModule } from '@org/api-cache';
import { PrismaModule } from '@org/database';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { AdminAnalyticsController } from './admin-analytics.controller.js';
import { AdminAnalyticsService } from './admin-analytics.service.js';
import { AdminAppVersionsController } from './app-versions.controller.js';
import { AppVersionsPublicController } from './app-versions-public.controller.js';
import { AppVersionsService } from './app-versions.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, CacheModule],
  controllers: [
    AdminController,
    AdminAnalyticsController,
    AdminAppVersionsController,
    AppVersionsPublicController,
  ],
  providers: [AdminService, AdminAnalyticsService, AppVersionsService],
  exports: [AdminService, AdminAnalyticsService, AppVersionsService],
})
export class AdminModule {}

