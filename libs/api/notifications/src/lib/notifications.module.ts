import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import {
  NotificationsController,
  PushDeviceController,
} from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
  controllers: [NotificationsController, PushDeviceController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
