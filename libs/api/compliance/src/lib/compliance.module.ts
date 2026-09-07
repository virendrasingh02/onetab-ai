import { Module } from '@nestjs/common';
import { PrismaModule } from '@org/database';
import { ComplianceController } from './compliance.controller.js';
import { ComplianceRuleEngineService } from './compliance-rule-engine.service.js';
import { ComplianceService } from './compliance.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ComplianceController],
  providers: [ComplianceService, ComplianceRuleEngineService],
  exports: [ComplianceService, ComplianceRuleEngineService],
})
export class ComplianceModule {}
