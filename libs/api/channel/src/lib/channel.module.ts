import { Module } from '@nestjs/common';
import { AuthModule } from '@org/api-auth';
import { ChannelMembershipExpiryService } from './channel-membership-expiry.service.js';
import { ChannelController } from './channel.controller.js';
import { ChannelService } from './channel.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ChannelController],
  providers: [ChannelService, ChannelMembershipExpiryService],
  exports: [ChannelService],
})
export class ChannelModule {}
