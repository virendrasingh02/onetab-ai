import { Module } from '@nestjs/common';
import { AIInfrastructureModule } from '@org/api-ai';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { AgentInstallController } from './agent-install.controller.js';
import { AgentInstallService } from './agent-install.service.js';
import { MarketplaceController } from './marketplace.controller.js';
import { MarketplaceService } from './marketplace.service.js';
import { PluginSDKService } from './plugin-sdk.service.js';

@Module({
  imports: [PrismaModule, AuthModule, AIInfrastructureModule],
  controllers: [MarketplaceController, AgentInstallController],
  providers: [MarketplaceService, PluginSDKService, AgentInstallService],
  exports: [MarketplaceService, PluginSDKService, AgentInstallService],
})
export class MarketplaceModule {}
