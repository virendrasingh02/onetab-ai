import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, WorkspaceId, zodBody } from '@org/api-common';
import {
  createScheduledMessageSchema,
  updateScheduledMessageSchema,
  type CreateScheduledMessageInput,
  type UpdateScheduledMessageInput,
} from '@org/validation';
import { ScheduledMessagesService } from './scheduled-messages.service.js';

/** A member's own scheduled sends — never another member's (brief: composer "send later"). */
@Controller({ path: 'workspaces/:workspaceId/scheduled-messages', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class ScheduledMessagesController {
  constructor(private readonly service: ScheduledMessagesService) {}

  @Get()
  list(@WorkspaceId() workspaceId: string, @CurrentUser('id') userId: string) {
    return this.service.list(workspaceId, userId);
  }

  @Post()
  create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(createScheduledMessageSchema))
    body: CreateScheduledMessageInput,
  ) {
    return this.service.create(workspaceId, userId, body);
  }

  @Patch(':id')
  update(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body(zodBody(updateScheduledMessageSchema))
    body: UpdateScheduledMessageInput,
  ) {
    return this.service.update(workspaceId, userId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.service.cancel(workspaceId, userId, id);
  }
}
