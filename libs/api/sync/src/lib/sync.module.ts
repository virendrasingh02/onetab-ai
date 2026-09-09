import { Module } from '@nestjs/common';
import { AuthModule } from '@org/api-auth';
import { PrismaModule } from '@org/database';
import { SyncController } from './sync.controller.js';
import { SyncService } from './sync.service.js';

/**
 * Incremental background-sync API. Depends only on Prisma (reads) and the auth
 * module (for `WorkspaceRoleGuard`). No writes, no events, no schema change.
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
