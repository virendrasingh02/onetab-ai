import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { zodBody } from '@org/api-common';
import {
  fetchLinkPreviewSchema,
  updateMessageLinkPreviewSchema,
  type FetchLinkPreviewInput,
  type UpdateMessageLinkPreviewInput,
} from '@org/validation';
import { LinkPreviewService } from './link-preview.service.js';

@Controller({ path: 'link-preview', version: '1' })
export class LinkPreviewController {
  constructor(private readonly linkPreviews: LinkPreviewService) {}

  /**
   * Fetches preview metadata for a URL safely.
   */
  @Get()
  async getPreview(@Query() query: FetchLinkPreviewInput) {
    const validated = fetchLinkPreviewSchema.parse(query);
    return this.linkPreviews.getPreview(validated.url);
  }

  /**
   * Updates per-message link preview visibility.
   */
  @Patch('messages/:id')
  @HttpCode(HttpStatus.OK)
  async updateMessageVisibility(
    @Param('id') messageId: string,
    @Body(zodBody(updateMessageLinkPreviewSchema))
    body: UpdateMessageLinkPreviewInput,
  ) {
    await this.linkPreviews.setMessageVisibility(messageId, body.visibility);
    return { success: true, messageId, visibility: body.visibility };
  }

  /**
   * Gets per-message link preview visibility override.
   */
  @Get('messages/:id')
  async getMessageVisibility(@Param('id') messageId: string) {
    const visibility = await this.linkPreviews.getMessageVisibility(messageId);
    return { messageId, visibility };
  }
}

@Controller({ path: 'messages', version: '1' })
export class MessagesLinkPreviewController {
  constructor(private readonly linkPreviews: LinkPreviewService) {}

  /**
   * Alias endpoint: PATCH /messages/:id/link-preview
   */
  @Patch(':id/link-preview')
  @HttpCode(HttpStatus.OK)
  async updateMessageVisibility(
    @Param('id') messageId: string,
    @Body(zodBody(updateMessageLinkPreviewSchema))
    body: UpdateMessageLinkPreviewInput,
  ) {
    await this.linkPreviews.setMessageVisibility(messageId, body.visibility);
    return { success: true, messageId, visibility: body.visibility };
  }
}
