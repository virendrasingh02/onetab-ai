import { Module } from '@nestjs/common';
import { AuthModule } from '@org/api-auth';
import { StorageModule } from '@org/api-storage';
import { WorkspaceController } from './workspace.controller.js';
import { WorkspaceService } from './workspace.service.js';

@Module({
  // AuthModule supplies WorkspaceRoleGuard, which this module's routes use.
  // StorageModule supplies StorageService, which holds uploaded logos.
  imports: [AuthModule, StorageModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
