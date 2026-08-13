import { Module } from '@nestjs/common';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { MarketplaceController } from './marketplace.controller.js';
import { MarketplaceService } from './marketplace.service.js';
import { PluginSDKService } from './plugin-sdk.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MarketplaceController],
  providers: [MarketplaceService, PluginSDKService],
  exports: [MarketplaceService, PluginSDKService],
})
export class MarketplaceModule {}
