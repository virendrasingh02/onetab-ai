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
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, WorkspaceId } from '@org/api-common';
import {
  NotificationsService,
  type NotificationPreferenceInput,
  type PushRegistrationInput,
} from './notifications.service.js';

/**
 * Notification settings and the activity feed for one workspace.
 *
 * Every route acts on the caller's own preferences — the user id comes from the
 * token, never from the request, so one member cannot read or rewrite another's
 * notification settings.
 */
@Controller({ path: 'workspaces/:workspaceId/notifications', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('preferences')
  getPreferences(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notifications.getPreferences(workspaceId, userId);
  }

  @Patch('preferences')
  updatePreferences(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() body: NotificationPreferenceInput,
  ) {
    return this.notifications.updatePreferences(workspaceId, userId, body);
  }

  @Get('feed')
  feed(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.notifications.feed(
      workspaceId,
      userId,
      limit ? Math.min(Number(limit) || 50, 200) : undefined,
    );
  }
}

/**
 * Push devices belong to the person, not to a workspace, so these sit outside
 * the workspace path — one registration serves every workspace they are in.
 */
@Controller({ path: 'notifications/devices', version: '1' })
export class PushDeviceController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.notifications.listDevices(userId);
  }

  @Post()
  register(
    @CurrentUser('id') userId: string,
    @Body() body: PushRegistrationInput,
  ) {
    return this.notifications.registerDevice(userId, body);
  }

  @Delete(':registrationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(
    @CurrentUser('id') userId: string,
    @Param('registrationId') registrationId: string,
  ): Promise<void> {
    return this.notifications.revokeDevice(userId, registrationId);
  }
}
