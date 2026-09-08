import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  CurrentUser,
  RequireWorkspacePermissions,
  WorkspaceId,
  WorkspaceMemberRole,
  zodBody,
} from '@org/api-common';
import { WorkspacePermission, type WorkspaceRole } from '@org/types';
import {
  postAnonymousMessageSchema,
  removeAnonymousMessageSchema,
  reportAnonymousMessageSchema,
  updateChannelAnonymousSettingsSchema,
  type PostAnonymousMessageInput,
  type RemoveAnonymousMessageInput,
  type ReportAnonymousMessageInput,
  type UpdateChannelAnonymousSettingsInput,
} from '@org/validation';
import { AnonymousMessagingService } from './anonymous-messaging.service.js';

/**
 * Anonymous messaging (brief §2 / §13). Class-guarded by `WorkspaceRoleGuard`;
 * the sensitive routes additionally require `MANAGE_SETTINGS` (configure) or
 * `MODERATE_ANONYMOUS` (list / reveal / remove / audit).
 */
@Controller({
  path: 'workspaces/:workspaceId/channels/:channelId/anonymous',
  version: '1',
})
@UseGuards(WorkspaceRoleGuard)
export class AnonymousController {
  constructor(private readonly anon: AnonymousMessagingService) {}

  @Get('settings')
  getSettings(
    @WorkspaceId() workspaceId: string,
    @Param('channelId') channelId: string,
    @CurrentUser('id') userId: string,
    @WorkspaceMemberRole() role: WorkspaceRole,
  ) {
    return this.anon.getSettings(workspaceId, channelId, userId, role);
  }

  @Put('settings')
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  updateSettings(
    @WorkspaceId() workspaceId: string,
    @Param('channelId') channelId: string,
    @Body(zodBody(updateChannelAnonymousSettingsSchema))
    body: UpdateChannelAnonymousSettingsInput,
  ) {
    return this.anon.updateSettings(workspaceId, channelId, body);
  }

  @Post('messages')
  postMessage(
    @WorkspaceId() workspaceId: string,
    @Param('channelId') channelId: string,
    @CurrentUser('id') userId: string,
    @WorkspaceMemberRole() role: WorkspaceRole,
    @Body(zodBody(postAnonymousMessageSchema))
    body: PostAnonymousMessageInput,
  ) {
    return this.anon.postMessage(workspaceId, channelId, userId, role, body);
  }

  @Post('messages/:eventId/report')
  @HttpCode(HttpStatus.NO_CONTENT)
  report(
    @WorkspaceId() workspaceId: string,
    @Param('channelId') channelId: string,
    @Param('eventId') eventId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(reportAnonymousMessageSchema))
    body: ReportAnonymousMessageInput,
  ): Promise<void> {
    return this.anon.report(workspaceId, channelId, userId, eventId, body.reason);
  }

  @Get('moderation')
  @RequireWorkspacePermissions(WorkspacePermission.MODERATE_ANONYMOUS)
  listModeration(
    @WorkspaceId() workspaceId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.anon.listModeration(workspaceId, channelId);
  }

  @Post('messages/:id/reveal')
  @RequireWorkspacePermissions(WorkspacePermission.MODERATE_ANONYMOUS)
  reveal(
    @WorkspaceId() workspaceId: string,
    @Param('channelId') channelId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.anon.revealAuthor(workspaceId, channelId, userId, id);
  }

  @Post('messages/:id/remove')
  @RequireWorkspacePermissions(WorkspacePermission.MODERATE_ANONYMOUS)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @WorkspaceId() workspaceId: string,
    @Param('channelId') channelId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(removeAnonymousMessageSchema))
    body: RemoveAnonymousMessageInput,
  ): Promise<void> {
    return this.anon.removeMessage(
      workspaceId,
      channelId,
      userId,
      id,
      body.reason,
    );
  }

  @Get('audit')
  @RequireWorkspacePermissions(WorkspacePermission.MODERATE_ANONYMOUS)
  listAudit(
    @WorkspaceId() workspaceId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.anon.listAudit(workspaceId, channelId);
  }
}
