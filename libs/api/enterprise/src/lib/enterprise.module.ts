import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { EnterpriseController } from './enterprise.controller.js';
import { EnterpriseService } from './enterprise.service.js';
import { SCIMService } from './scim.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
  controllers: [EnterpriseController],
  providers: [EnterpriseService, SCIMService],
  exports: [EnterpriseService, SCIMService],
})
export class EnterpriseModule {}
