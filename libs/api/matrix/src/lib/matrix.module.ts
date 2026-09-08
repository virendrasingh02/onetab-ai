import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { AnonymousController } from './anonymous.controller.js';
import { AnonymousMessagingService } from './anonymous-messaging.service.js';
import {
  ChannelEmailController,
  InboundEmailController,
} from './email.controller.js';
import { InboundEmailService } from './inbound-email.service.js';
import { MatrixAdminService } from './matrix-admin.service.js';
import { MatrixAuthService } from './matrix-auth.service.js';
import { MatrixBotMessagingService } from './matrix-bot-messaging.service.js';
import { MatrixInboundRouterService } from './matrix-inbound-router.service.js';
import { MatrixMembershipListener } from './matrix-membership.listener.js';
import { MatrixReconcilerService } from './matrix-reconciler.service.js';
import { MatrixSpaceService } from './matrix-space.service.js';
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
  controllers: [
    MatrixController,
    MatrixAppserviceController,
    AnonymousController,
    ChannelEmailController,
    InboundEmailController,
  ],
  providers: [
    MatrixAdminService,
    MatrixAuthService,
    MatrixBotMessagingService,
    AnonymousMessagingService,
    InboundEmailService,
    MatrixInboundRouterService,
    MatrixMembershipListener,
    MatrixReconcilerService,
    MatrixSpaceService,
    MatrixSyncService,
    NotificationBridgeService,
  ],
  exports: [
    MatrixAdminService,
    MatrixAuthService,
    MatrixBotMessagingService,
    MatrixInboundRouterService,
    MatrixSpaceService,
  ],
})
export class MatrixModule {}
