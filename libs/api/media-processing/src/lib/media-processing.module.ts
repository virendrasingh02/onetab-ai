import { Module } from '@nestjs/common';
import { CacheModule } from '@org/api-cache';
import { ImageProcessingService } from './image-processing.service.js';
import { ImageSecurityService } from './image-security.service.js';
import { MediaQueueService } from './media-queue.service.js';

@Module({
  imports: [CacheModule],
  providers: [ImageSecurityService, ImageProcessingService, MediaQueueService],
  exports: [ImageSecurityService, ImageProcessingService, MediaQueueService],
})
export class MediaProcessingModule {}
