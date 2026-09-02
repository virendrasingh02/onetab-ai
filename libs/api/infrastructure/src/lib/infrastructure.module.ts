import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIInfrastructureModule } from '@org/api-ai';
import { CacheModule } from '@org/api-cache';
import { MatrixModule } from '@org/api-matrix';
import { SearchModule } from '@org/api-search';
import { StorageModule } from '@org/api-storage';
import { PrismaModule } from '@org/database';
import { DistributedThrottlerStorageService } from './distributed-throttler-storage.service.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    CacheModule,
    StorageModule,
    SearchModule,
    AIInfrastructureModule,
    MatrixModule,
  ],
  providers: [DistributedThrottlerStorageService],
  exports: [
    PrismaModule,
    CacheModule,
    StorageModule,
    SearchModule,
    AIInfrastructureModule,
    MatrixModule,
    DistributedThrottlerStorageService,
  ],
})
export class InfrastructureModule {}

