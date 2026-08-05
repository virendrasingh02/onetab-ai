import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { AIInfrastructureService } from './ai-infrastructure.service.js';
import { AIPlatformController } from './ai-platform.controller.js';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [AIPlatformController],
  providers: [AIInfrastructureService],
  exports: [AIInfrastructureService],
})
export class AIInfrastructureModule {}
