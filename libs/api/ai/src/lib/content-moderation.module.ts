import { Module } from '@nestjs/common';
import { ContentModerationService } from './content-moderation.service.js';

/** On its own so Storage and User can use it without the whole AI module. */
@Module({
  providers: [ContentModerationService],
  exports: [ContentModerationService],
})
export class ContentModerationModule {}
