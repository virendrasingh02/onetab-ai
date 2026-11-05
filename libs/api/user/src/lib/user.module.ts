import { Module } from '@nestjs/common';
import { AuthModule } from '@org/api-auth';
import { IntegrationsModule } from '@org/api-integrations';
import { MatrixModule } from '@org/api-matrix';
import { WorkspaceModule } from '@org/api-workspace';
import { AccountDeletionService } from './account-deletion.service.js';
import { BookmarksController } from './bookmarks.controller.js';
import { BookmarksService } from './bookmarks.service.js';
import { ScheduledStatusApplierService } from './scheduled-status-applier.service.js';
import { ScheduledStatusService } from './scheduled-status.service.js';
import {
  AccountController,
  AdminSafetyController,
  SafetyController,
} from './safety.controller.js';
import { SafetyService } from './safety.service.js';
import { UserController, WorkspaceUserController } from './user.controller.js';
import { UserService } from './user.service.js';

import { StorageModule } from '@org/api-storage';
import { MediaProcessingModule } from '@org/api-media-processing';

@Module({
  imports: [
    AuthModule,
    MatrixModule,
    StorageModule,
    MediaProcessingModule,
    WorkspaceModule,
    IntegrationsModule,
  ],
  controllers: [
    // Before UserController: its `:id` routes would otherwise claim `me/*`.
    AccountController,
    SafetyController,
    AdminSafetyController,
    UserController,
    WorkspaceUserController,
    BookmarksController,
  ],
  providers: [
    AccountDeletionService,
    SafetyService,
    UserService,
    ScheduledStatusService,
    ScheduledStatusApplierService,
    BookmarksService,
  ],
  exports: [UserService, BookmarksService],
})
export class UserModule {}
