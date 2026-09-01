import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '@org/database';
import { PresenceService } from './presence.service.js';
import { RealtimeDomainBridgeListener } from './realtime-domain-bridge.listener.js';
import { RealtimeGatewayService } from './realtime-gateway.service.js';
import { RealtimeController } from './realtime.controller.js';

@Module({
  imports: [ConfigModule, PrismaModule, JwtModule.register({})],
  controllers: [RealtimeController],
  providers: [
    RealtimeGatewayService,
    PresenceService,
    RealtimeDomainBridgeListener,
  ],
  exports: [RealtimeGatewayService, PresenceService],
})
export class RealtimeModule {}
