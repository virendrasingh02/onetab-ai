import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRoleGuard } from '@org/api-auth';
import { CurrentUser, WorkspaceId, zodBody } from '@org/api-common';
import { startHuddleSchema, type StartHuddleInput } from '@org/validation';
import { HuddleService } from './huddle.service.js';

/** Huddles (brief §6 / §7). Class-guarded by workspace membership. */
@Controller({ path: 'workspaces/:workspaceId/huddles', version: '1' })
@UseGuards(WorkspaceRoleGuard)
export class HuddleController {
  constructor(private readonly huddles: HuddleService) {}

  /** Whether embedded media is available (Element Call configured). */
  @Get('config')
  getConfig() {
    return this.huddles.config();
  }

  /** The active huddle for a Matrix room, or null. */
  @Get('for-room')
  forRoom(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Query('roomId') roomId: string,
  ) {
    return this.huddles.forRoom(workspaceId, userId, roomId);
  }

  /** Start (or join the existing) huddle in a conversation. */
  @Post()
  start(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(startHuddleSchema)) body: StartHuddleInput,
  ) {
    return this.huddles.start(workspaceId, userId, body);
  }

  @Post(':id/join')
  join(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.huddles.join(workspaceId, userId, id);
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  leave(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.huddles.leave(workspaceId, userId, id);
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.NO_CONTENT)
  end(
    @WorkspaceId() workspaceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.huddles.end(workspaceId, userId, id);
  }
}
