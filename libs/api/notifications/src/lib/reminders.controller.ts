import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, WorkspaceId, zodBody } from '@org/api-common';
import type { CurrentUser as CurrentUserType } from '@org/types';
import {
  createMessageReminderSchema,
  type CreateMessageReminderInput,
} from '@org/validation';
import { RemindersService } from './reminders.service.js';

/** The caller's own message reminders — the user always comes from the token. */
@Controller({ path: 'workspaces/:workspaceId/reminders', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get()
  list(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.reminders.listPending(workspaceId, user.id);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(createMessageReminderSchema)) body: CreateMessageReminderInput,
  ) {
    return this.reminders.create(workspaceId, user.id, body);
  }

  @Delete(':reminderId')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: CurrentUserType,
    @Param('reminderId') reminderId: string,
  ): Promise<void> {
    return this.reminders.cancel(workspaceId, user.id, reminderId);
  }
}
