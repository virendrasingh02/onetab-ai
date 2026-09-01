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
  RequireWorkspacePermissions,
  WorkspaceId,
  zodBody,
} from '@org/api-common';
import { WorkspacePermission } from '@org/types';
import type { CurrentUser as CurrentUserType, MeetingStatus } from '@org/types';
import {
  createMeetingActionItemSchema,
  createMeetingDecisionSchema,
  createMeetingNoteSchema,
  createMeetingSchema,
  meetingParticipantsSchema,
  meetingRsvpSchema,
  updateMeetingSchema,
  type CreateMeetingActionItemInput,
  type CreateMeetingDecisionInput,
  type CreateMeetingInput,
  type CreateMeetingNoteInput,
  type MeetingParticipantsInput,
  type MeetingRsvpInput,
  type UpdateMeetingInput,
} from '@org/validation';
import { MeetingsService } from './meetings.service.js';

@Controller({
  path: 'workspaces/:workspaceId/work-tools/meetings',
  version: '1',
})
@UseGuards(WorkspaceRoleGuard)
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  list(
    @WorkspaceId() workspaceId: string,
    @Query('status') status?: MeetingStatus,
    @Query('projectId') projectId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('scope') scope?: 'upcoming' | 'past' | 'all',
  ) {
    return this.meetings.list(workspaceId, {
      status,
      projectId,
      from,
      to,
      scope,
    });
  }

  // Recycle bin — must precede `:meetingId`.
  @Get('trash')
  listTrash(@WorkspaceId() workspaceId: string) {
    return this.meetings.listDeleted(workspaceId);
  }

  @Get(':meetingId')
  get(
    @WorkspaceId() workspaceId: string,
    @Param('meetingId') meetingId: string,
  ) {
    return this.meetings.get(workspaceId, meetingId);
  }

  @Post()
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(createMeetingSchema)) body: CreateMeetingInput,
  ) {
    return this.meetings.create(workspaceId, user.id, body);
  }

  @Patch(':meetingId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  update(
    @WorkspaceId() workspaceId: string,
    @Param('meetingId') meetingId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(updateMeetingSchema)) body: UpdateMeetingInput,
  ) {
    return this.meetings.update(workspaceId, meetingId, user.id, body);
  }

  @Post(':meetingId/cancel')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  cancel(
    @WorkspaceId() workspaceId: string,
    @Param('meetingId') meetingId: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.meetings.cancel(workspaceId, meetingId, user.id);
  }

  @Post(':meetingId/end')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  end(
    @WorkspaceId() workspaceId: string,
    @Param('meetingId') meetingId: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.meetings.end(workspaceId, meetingId, user.id);
  }

  @Post(':meetingId/restore')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  restore(
    @WorkspaceId() workspaceId: string,
    @Param('meetingId') meetingId: string,
  ) {
    return this.meetings.restore(workspaceId, meetingId);
  }

  @Delete(':meetingId')
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @WorkspaceId() workspaceId: string,
    @Param('meetingId') meetingId: string,
  ): Promise<void> {
    return this.meetings.remove(workspaceId, meetingId);
  }

  // --- participants -------------------------------------------------------

  @Post(':meetingId/participants')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  addParticipants(
    @WorkspaceId() workspaceId: string,
    @Param('meetingId') meetingId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(meetingParticipantsSchema)) body: MeetingParticipantsInput,
  ) {
    return this.meetings.addParticipants(
      workspaceId,
      meetingId,
      user.id,
      body.userIds,
    );
  }

  @Delete(':meetingId/participants/:userId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  removeParticipant(
    @WorkspaceId() workspaceId: string,
    @Param('meetingId') meetingId: string,
    @Param('userId') userId: string,
  ) {
    return this.meetings.removeParticipant(workspaceId, meetingId, userId);
  }

  @Post(':meetingId/rsvp')
  respond(
    @WorkspaceId() workspaceId: string,
    @Param('meetingId') meetingId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(meetingRsvpSchema)) body: MeetingRsvpInput,
  ) {
    return this.meetings.respond(workspaceId, meetingId, user.id, body.rsvp);
  }

  // --- notes & decisions ------------------------------------------------

  @Post(':meetingId/notes')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  addNote(
    @WorkspaceId() workspaceId: string,
    @Param('meetingId') meetingId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(createMeetingNoteSchema)) body: CreateMeetingNoteInput,
  ) {
    return this.meetings.addNote(workspaceId, meetingId, user.id, body);
  }

  @Delete(':meetingId/notes/:noteId')
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteNote(
    @WorkspaceId() workspaceId: string,
    @Param('meetingId') meetingId: string,
    @Param('noteId') noteId: string,
  ): Promise<void> {
    return this.meetings.deleteNote(workspaceId, meetingId, noteId);
  }

  @Post(':meetingId/decisions')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  addDecision(
    @WorkspaceId() workspaceId: string,
    @Param('meetingId') meetingId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(createMeetingDecisionSchema))
    body: CreateMeetingDecisionInput,
  ) {
    return this.meetings.addDecision(workspaceId, meetingId, user.id, body);
  }

  @Delete(':meetingId/decisions/:decisionId')
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDecision(
    @WorkspaceId() workspaceId: string,
    @Param('meetingId') meetingId: string,
    @Param('decisionId') decisionId: string,
  ): Promise<void> {
    return this.meetings.deleteDecision(workspaceId, meetingId, decisionId);
  }

  // --- action items ----------------------------------------------------

  @Get(':meetingId/action-items')
  listActionItems(
    @WorkspaceId() workspaceId: string,
    @Param('meetingId') meetingId: string,
  ) {
    return this.meetings.listActionItems(workspaceId, meetingId);
  }

  @Post(':meetingId/action-items')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  addActionItem(
    @WorkspaceId() workspaceId: string,
    @Param('meetingId') meetingId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(createMeetingActionItemSchema))
    body: CreateMeetingActionItemInput,
  ) {
    return this.meetings.addActionItem(workspaceId, meetingId, user.id, body);
  }
}
