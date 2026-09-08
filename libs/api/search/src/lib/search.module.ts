import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { FederatedSearchController } from './federated-search.controller.js';
import { FederatedSearchService } from './federated-search.service.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
  controllers: [SearchController, FederatedSearchController],
  providers: [SearchService, FederatedSearchService],
  exports: [SearchService],
})
export class SearchModule {}
