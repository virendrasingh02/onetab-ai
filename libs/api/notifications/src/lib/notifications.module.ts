import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { ActivityWriterService } from './activity-writer.service.js';
import { DomainEventsListener } from './domain-events.listener.js';
import { NotificationCenterService } from './notification-center.service.js';
import {
  NotificationsController,
  PushDeviceController,
} from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
  controllers: [NotificationsController, PushDeviceController],
  providers: [
    NotificationsService,
    NotificationCenterService,
    ActivityWriterService,
    // Bridges the app event bus onto notification + activity rows. Registered
    // as a provider so NestJS instantiates it and its @OnEvent handlers bind.
    DomainEventsListener,
  ],
  exports: [
    NotificationsService,
    NotificationCenterService,
    ActivityWriterService,
  ],
})
export class NotificationsModule {}
