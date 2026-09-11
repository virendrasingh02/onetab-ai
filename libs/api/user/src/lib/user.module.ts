import { Module } from '@nestjs/common';
import { AuthModule } from '@org/api-auth';
import { MatrixModule } from '@org/api-matrix';
import { BookmarksController } from './bookmarks.controller.js';
import { BookmarksService } from './bookmarks.service.js';
import { ScheduledStatusApplierService } from './scheduled-status-applier.service.js';
import { ScheduledStatusService } from './scheduled-status.service.js';
import { UserController, WorkspaceUserController } from './user.controller.js';
import { UserService } from './user.service.js';

import { StorageModule } from '@org/api-storage';
import { MediaProcessingModule } from '@org/api-media-processing';

@Module({
  imports: [AuthModule, MatrixModule, StorageModule, MediaProcessingModule],
  controllers: [
    UserController,
    WorkspaceUserController,
    BookmarksController,
  ],
  providers: [
    UserService,
    ScheduledStatusService,
    ScheduledStatusApplierService,
    BookmarksService,
  ],
  exports: [UserService, BookmarksService],
})
export class UserModule {}
