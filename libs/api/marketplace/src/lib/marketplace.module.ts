import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { CatalogService } from './catalog.service.js';
import { MarketplaceController } from './marketplace.controller.js';
import { MarketplaceService } from './marketplace.service.js';
import { PluginSDKService } from './plugin-sdk.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
  controllers: [MarketplaceController],
  providers: [MarketplaceService, PluginSDKService, CatalogService],
  exports: [MarketplaceService, PluginSDKService, CatalogService],
})
export class MarketplaceModule {}
