import { Module } from '@nestjs/common';
import { AuthModule } from '@org/api-auth';
import { ChannelController } from './channel.controller.js';
import { ChannelService } from './channel.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ChannelController],
  providers: [ChannelService],
  exports: [ChannelService],
})
export class ChannelModule {}
