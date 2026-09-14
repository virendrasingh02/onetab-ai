import { Module } from '@nestjs/common';
import { AuthModule } from '@org/api-auth';
import { ChannelAutoArchiveService } from './channel-auto-archive.service.js';
import { ChannelMembershipExpiryService } from './channel-membership-expiry.service.js';
import { ChannelController } from './channel.controller.js';
import { ChannelService } from './channel.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ChannelController],
  providers: [
    ChannelService,
    ChannelMembershipExpiryService,
    ChannelAutoArchiveService,
  ],
  exports: [ChannelService],
})
export class ChannelModule {}
