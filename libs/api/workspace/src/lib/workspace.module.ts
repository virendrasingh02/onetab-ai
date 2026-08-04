import { Module } from '@nestjs/common';
import { AuthModule } from '@org/api-auth';
import { WorkspaceController } from './workspace.controller.js';
import { WorkspaceService } from './workspace.service.js';

@Module({
  // AuthModule supplies WorkspaceRoleGuard, which this module's routes use.
  imports: [AuthModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
