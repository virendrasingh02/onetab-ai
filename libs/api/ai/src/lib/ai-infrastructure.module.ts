import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIInfrastructureService } from './ai-infrastructure.service.js';

@Module({
  imports: [ConfigModule],
  providers: [AIInfrastructureService],
  exports: [AIInfrastructureService],
})
export class AIInfrastructureModule {}
