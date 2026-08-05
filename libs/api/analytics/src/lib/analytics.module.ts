import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '@org/database';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';
import { ErrorTrackingService } from './error-tracking.service.js';
import { HealthService } from './health.service.js';
import { MetricsService } from './metrics.service.js';
import { ReportsService } from './reports.service.js';
import { TelemetryInterceptor } from './telemetry.interceptor.js';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    MetricsService,
    ErrorTrackingService,
    HealthService,
    ReportsService,
    // Registered here rather than in AppModule so importing this module is all
    // it takes to start collecting request telemetry.
    { provide: APP_INTERCEPTOR, useClass: TelemetryInterceptor },
  ],
  exports: [
    AnalyticsService,
    MetricsService,
    ErrorTrackingService,
    HealthService,
    ReportsService,
  ],
})
export class AnalyticsModule {}
