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
import {
  CurrentUser,
  WorkspaceId,
  toUpload,
  zodBody,
} from '@org/api-common';
import {
  addChannelMembersSchema,
  channelPreferencesSchema,
  createChannelSchema,
  createPinSchema,
  updateChannelSchema,
  type AddChannelMembersInput,
  type ChannelPreferencesInput,
  type CreateChannelInput,
  type CreatePinInput,
  type UpdateChannelInput,
} from '@org/validation';
import { ChannelService } from './channel.service.js';

@Controller({ path: 'workspaces/:workspaceId/channels', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class ChannelController {
  constructor(private readonly channels: ChannelService) {}

  @Get()
  list(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.channels.list(workspaceId, userId, {
      includeArchived: includeArchived === 'true',
    });
  }

  @Post()
  create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(createChannelSchema)) body: CreateChannelInput,
  ) {
    return this.channels.create(workspaceId, userId, body);
  }

  @Get('by-slug/:slug')
  findOne(
    @WorkspaceId() workspaceId: string,
    @Param('slug') slug: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.channels.findBySlug(workspaceId, slug, userId);
  }

  @Patch(':channelId')
  update(
    @WorkspaceId() workspaceId: string,
    @Param('channelId') channelId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(updateChannelSchema)) body: UpdateChannelInput,
  ) {
    return this.channels.update(workspaceId, channelId, userId, body);
  }

  @Post(':channelId/archive')
  archive(
    @WorkspaceId() workspaceId: string,
    @Param('channelId') channelId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.channels.setArchived(workspaceId, channelId, userId, true);
  }

  @Post(':channelId/unarchive')
  unarchive(
    @WorkspaceId() workspaceId: string,
    @Param('channelId') channelId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.channels.setArchived(workspaceId, channelId, userId, false);
  }

  @Post(':channelId/make-private')
  makePrivate(
    @WorkspaceId() workspaceId: string,
    @Param('channelId') channelId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.channels.makePrivate(workspaceId, channelId, userId);
  }

  // --- membership ---------------------------------------------------------

  @Get(':channelId/members')
  listMembers(@Param('channelId') channelId: string) {
    return this.channels.listMembers(channelId);
  }

  @Post(':channelId/members')
  addMembers(
    @WorkspaceId() workspaceId: string,
    @Param('channelId') channelId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(addChannelMembersSchema)) body: AddChannelMembersInput,
  ) {
    return this.channels.addMembers(workspaceId, channelId, userId, body);
  }

  @Delete(':channelId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @WorkspaceId() workspaceId: string,
    @Param('channelId') channelId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser('id') actorId: string,
  ): Promise<void> {
    return this.channels.removeMember(
      workspaceId,
      channelId,
      actorId,
      targetUserId,
    );
  }

  @Post(':channelId/join')
  @HttpCode(HttpStatus.NO_CONTENT)
  join(
    @Param('channelId') channelId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.channels.join(channelId, userId);
  }

  @Patch(':channelId/preferences')
  @HttpCode(HttpStatus.NO_CONTENT)
  setPreferences(
    @Param('channelId') channelId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(channelPreferencesSchema)) body: ChannelPreferencesInput,
  ): Promise<void> {
    return this.channels.setPreferences(channelId, userId, body);
  }

  @Post(':channelId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(
    @Param('channelId') channelId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.channels.markRead(channelId, userId);
  }

  // --- pins & files -------------------------------------------------------

  @Get(':channelId/pins')
  listPins(@Param('channelId') channelId: string) {
    return this.channels.listPins(channelId);
  }

  @Post(':channelId/pins')
  createPin(
    @Param('channelId') channelId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(createPinSchema)) body: CreatePinInput,
  ) {
    return this.channels.createPin(channelId, userId, body);
  }

  @Delete(':channelId/pins/:pinId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePin(
    @Param('channelId') channelId: string,
    @Param('pinId') pinId: string,
  ): Promise<void> {
    return this.channels.removePin(channelId, pinId);
  }

  @Get(':channelId/files')
  async listFiles(@Param('channelId') channelId: string) {
    const uploads = await this.channels.listUploads(channelId);
    return uploads.map(toUpload);
  }
}
