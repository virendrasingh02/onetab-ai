import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { MatrixAdminService } from './matrix-admin.service.js';
import { MatrixAuthService } from './matrix-auth.service.js';
import { MatrixBotMessagingService } from './matrix-bot-messaging.service.js';
import { MatrixInboundRouterService } from './matrix-inbound-router.service.js';
import { MatrixSyncService } from './matrix-sync.service.js';
import {
  MatrixAppserviceController,
  MatrixController,
} from './matrix.controller.js';
import { NotificationBridgeService } from './notification-bridge.service.js';

/**
 * The Matrix bridge.
 *
 * Speaks HTTP to the homeserver rather than embedding matrix-js-sdk: the SDK
 * is ESM-only and browser-oriented, while this module's job is provisioning
 * and event intake, both of which are plain REST.
 */
@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [MatrixController, MatrixAppserviceController],
  providers: [
    MatrixAdminService,
    MatrixAuthService,
    MatrixBotMessagingService,
    MatrixInboundRouterService,
    MatrixSyncService,
    NotificationBridgeService,
  ],
  exports: [
    MatrixAdminService,
    MatrixAuthService,
    MatrixBotMessagingService,
    MatrixInboundRouterService,
  ],
})
export class MatrixModule {}
