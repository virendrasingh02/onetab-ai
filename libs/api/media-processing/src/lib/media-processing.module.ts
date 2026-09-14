import { Module } from '@nestjs/common';
import { CacheModule } from '@org/api-cache';
import { ImageProcessingService } from './image-processing.service.js';
import { ImageSecurityService } from './image-security.service.js';
import { MediaQueueService } from './media-queue.service.js';
import { LinkPreviewService } from './link-preview.service.js';
import {
  LinkPreviewController,
  MessagesLinkPreviewController,
} from './link-preview.controller.js';

@Module({
  imports: [CacheModule],
  controllers: [LinkPreviewController, MessagesLinkPreviewController],
  providers: [
    ImageSecurityService,
    ImageProcessingService,
    MediaQueueService,
    LinkPreviewService,
  ],
  exports: [
    ImageSecurityService,
    ImageProcessingService,
    MediaQueueService,
    LinkPreviewService,
  ],
})
export class MediaProcessingModule {}
