import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, WorkspaceId } from '@org/api-common';
import {
  dismissAttentionItemSchema,
  snoozeAttentionItemSchema,
  type DismissAttentionItemInput,
  type SnoozeAttentionItemInput,
} from '@org/validation';
import { AttentionService } from './attention.service.js';
import { CatchUpService } from './catch-up.service.js';

@Controller({ path: 'workspaces/:workspaceId/intelligence', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class IntelligenceController {
  constructor(
    private readonly attention: AttentionService,
    private readonly catchUp: CatchUpService,
  ) {}

  @Get('attention')
  getAttention(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.attention.getAttention(workspaceId, userId);
  }

  @Post('attention/snooze')
  @HttpCode(HttpStatus.NO_CONTENT)
  async snoozeAttention(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() body: SnoozeAttentionItemInput,
  ): Promise<void> {
    const parsed = snoozeAttentionItemSchema.parse(body);
    await this.attention.snooze(
      workspaceId,
      userId,
      parsed.itemKey,
      parsed.snoozeDurationMinutes,
    );
  }

  @Post('attention/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  async dismissAttention(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() body: DismissAttentionItemInput,
  ): Promise<void> {
    const parsed = dismissAttentionItemSchema.parse(body);
    await this.attention.dismiss(workspaceId, userId, parsed.itemKey);
  }

  @Get('catch-up')
  getCatchUp(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.catchUp.getCatchUp(workspaceId, userId);
  }
}
