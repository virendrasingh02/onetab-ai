import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  Public,
  RequireWorkspacePermissions,
  WorkspaceId,
  zodBody,
} from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import {
  inboundEmailSchema,
  updateChannelEmailSettingsSchema,
  type InboundEmailInput,
  type UpdateChannelEmailSettingsInput,
} from '@org/validation';
import { InboundEmailService } from './inbound-email.service.js';

/** Per-channel inbound-email config (brief §5). */
@Controller({
  path: 'workspaces/:workspaceId/channels/:channelId/email',
  version: '1',
})
@UseGuards(WorkspaceRoleGuard)
export class ChannelEmailController {
  constructor(private readonly email: InboundEmailService) {}

  @Get()
  getSettings(
    @WorkspaceId() workspaceId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.email.getSettings(workspaceId, channelId);
  }

  @Put()
  @RequireWorkspacePermissions(WorkspacePermission.MANAGE_SETTINGS)
  updateSettings(
    @WorkspaceId() workspaceId: string,
    @Param('channelId') channelId: string,
    @Body(zodBody(updateChannelEmailSettingsSchema))
    body: UpdateChannelEmailSettingsInput,
  ) {
    return this.email.updateSettings(workspaceId, channelId, body);
  }
}

/**
 * The provider inbound-email webhook. `@Public()` — the shared secret in
 * `?secret=` (checked in the service against `INBOUND_EMAIL_SECRET`) is the
 * only auth, matching the Matrix appservice pattern. Always 200s on a handled
 * payload so the provider does not retry.
 */
@Controller({ path: 'email', version: '1' })
export class InboundEmailController {
  constructor(private readonly email: InboundEmailService) {}

  @Post('inbound')
  @Public()
  @HttpCode(HttpStatus.OK)
  inbound(
    @Query('secret') secret: string | undefined,
    @Body(zodBody(inboundEmailSchema)) body: InboundEmailInput,
  ) {
    return this.email.handleInbound(secret, body);
  }
}
