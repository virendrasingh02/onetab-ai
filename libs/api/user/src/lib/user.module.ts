import { Module } from '@nestjs/common';
import { AuthModule } from '@org/api-auth';
import { MatrixModule } from '@org/api-matrix';
import { ScheduledStatusApplierService } from './scheduled-status-applier.service.js';
import { ScheduledStatusService } from './scheduled-status.service.js';
import { UserController, WorkspaceUserController } from './user.controller.js';
import { UserService } from './user.service.js';

@Module({
  imports: [AuthModule, MatrixModule],
  controllers: [UserController, WorkspaceUserController],
  providers: [
    UserService,
    ScheduledStatusService,
    ScheduledStatusApplierService,
  ],
  exports: [UserService],
})
export class UserModule {}
