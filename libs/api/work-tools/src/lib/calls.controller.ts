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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WorkspaceRoleGuard } from '@org/api-auth';
import {
  CurrentUser,
  RequireWorkspacePermissions,
  WorkspaceId,
  zodBody,
} from '@org/api-common';
import {
  WorkspacePermission,
  type CurrentUser as CurrentUserType,
} from '@org/types';
import {
  appendCallTranscriptSchema,
  askCallQuestionSchema,
  callNotesAssistSchema,
  callSummaryFeedbackSchema,
  createCallActionItemSchema,
  createCallDecisionSchema,
  createCallNoteSchema,
  generateCallSummarySchema,
  regenerateCallSummarySectionSchema,
  shareCallSummarySchema,
  startCallSchema,
  updateCallActionItemSchema,
  updateCallDecisionSchema,
  updateCallNoteSchema,
  updateCallSchema,
  updateCallSummarySchema,
  upsertMyCallNoteSchema,
  type AppendCallTranscriptInput,
  type AskCallQuestionInput,
  type CallNotesAssistInput,
  type CallSummaryFeedbackInput,
  type CreateCallActionItemInput,
  type CreateCallDecisionInput,
  type CreateCallNoteInput,
  type GenerateCallSummaryInput,
  type RegenerateCallSummarySectionInput,
  type ShareCallSummaryInput,
  type StartCallInput,
  type UpdateCallActionItemInput,
  type UpdateCallDecisionInput,
  type UpdateCallInput,
  type UpdateCallNoteInput,
  type UpdateCallSummaryInput,
  type UpsertMyCallNoteInput,
} from '@org/validation';
import { CallSummaryService } from './call-summary.service.js';
import { CallsService } from './calls.service.js';

/**
 * Call sessions and their notes / AI summary / decisions / action items /
 * transcript. Every handler passes the caller through: who may see a call is
 * decided per call by `CallAccessService`, not by workspace membership alone.
 */
@Controller({
  path: 'workspaces/:workspaceId/calls',
  version: '1',
})
@UseGuards(WorkspaceRoleGuard)
export class CallsController {
  constructor(
    private readonly calls: CallsService,
    private readonly summary: CallSummaryService,
  ) {}

  @Get()
  list(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: CurrentUserType,
    @Query('conversationId') conversationId?: string,
    @Query('meetingId') meetingId?: string,
    @Query('status') status?: string,
  ) {
    return this.calls.listCalls(workspaceId, user.id, {
      conversationId,
      meetingId,
      status,
    });
  }

  @Post()
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  start(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(startCallSchema)) body: StartCallInput,
  ) {
    return this.calls.startCall(workspaceId, user.id, body);
  }

  @Get(':callId')
  get(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: CurrentUserType,
    @Param('callId') callId: string,
  ) {
    return this.calls.getCall(workspaceId, user.id, callId);
  }

  @Patch(':callId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  update(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: CurrentUserType,
    @Param('callId') callId: string,
    @Body(zodBody(updateCallSchema)) body: UpdateCallInput,
  ) {
    return this.calls.updateCall(workspaceId, user.id, callId, body);
  }

  /** Idempotent — both ends of a call report the hang-up. */
  @Post(':callId/end')
  @HttpCode(HttpStatus.OK)
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  end(
    @WorkspaceId() workspaceId: string,
    @Param('callId') callId: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.calls.endCall(workspaceId, user.id, callId);
  }

  // --- Call Notes ---

  @Get(':callId/notes')
  getNotes(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: CurrentUserType,
    @Param('callId') callId: string,
  ) {
    return this.calls.getNotes(workspaceId, user.id, callId);
  }

  /** The live editor's autosave target — the caller's one running note. */
  @Put(':callId/notes/mine')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  upsertMyNote(
    @WorkspaceId() workspaceId: string,
    @Param('callId') callId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(upsertMyCallNoteSchema)) body: UpsertMyCallNoteInput,
  ) {
    return this.calls.upsertMyNote(workspaceId, callId, user.id, body);
  }

  @Post(':callId/notes')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  addNote(
    @WorkspaceId() workspaceId: string,
    @Param('callId') callId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(createCallNoteSchema)) body: CreateCallNoteInput,
  ) {
    return this.calls.addNote(workspaceId, callId, user.id, body);
  }

  @Patch(':callId/notes/:noteId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  updateNote(
    @WorkspaceId() workspaceId: string,
    @Param('callId') callId: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(updateCallNoteSchema)) body: UpdateCallNoteInput,
  ) {
    return this.calls.updateNote(workspaceId, callId, noteId, user.id, body);
  }

  @Delete(':callId/notes/:noteId')
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteNote(
    @WorkspaceId() workspaceId: string,
    @Param('callId') callId: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: CurrentUserType,
  ): Promise<void> {
    return this.calls.deleteNote(workspaceId, callId, noteId, user.id);
  }

  // --- AI Summary ---

  @Get(':callId/summary')
  getSummary(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: CurrentUserType,
    @Param('callId') callId: string,
  ) {
    return this.summary.getSummary(workspaceId, user.id, callId);
  }

  @Post(':callId/summary/generate')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  generateSummary(
    @WorkspaceId() workspaceId: string,
    @Param('callId') callId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(generateCallSummarySchema)) body: GenerateCallSummaryInput,
  ) {
    return this.summary.generateSummary(workspaceId, user.id, callId, {
      force: body.force,
    });
  }

  @Post(':callId/summary/regenerate')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  regenerateSummary(
    @WorkspaceId() workspaceId: string,
    @Param('callId') callId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(regenerateCallSummarySectionSchema))
    body: RegenerateCallSummarySectionInput,
  ) {
    return this.summary.regenerate(workspaceId, user.id, callId, body);
  }

  @Patch(':callId/summary')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  updateSummary(
    @WorkspaceId() workspaceId: string,
    @Param('callId') callId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(updateCallSummarySchema)) body: UpdateCallSummaryInput,
  ) {
    return this.summary.updateSummary(workspaceId, user.id, callId, body);
  }

  @Post(':callId/summary/ask')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  askQuestion(
    @WorkspaceId() workspaceId: string,
    @Param('callId') callId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(askCallQuestionSchema)) body: AskCallQuestionInput,
  ) {
    return this.summary.askQuestion(workspaceId, user.id, callId, body);
  }

  @Post(':callId/ai/assist')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  assistNotes(
    @WorkspaceId() workspaceId: string,
    @Param('callId') callId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(callNotesAssistSchema)) body: CallNotesAssistInput,
  ) {
    return this.summary.assistNotes(workspaceId, user.id, callId, body);
  }

  @Post(':callId/summary/feedback')
  @HttpCode(HttpStatus.NO_CONTENT)
  feedback(
    @WorkspaceId() workspaceId: string,
    @Param('callId') callId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(callSummaryFeedbackSchema)) body: CallSummaryFeedbackInput,
  ) {
    return this.summary.submitFeedback(workspaceId, user.id, callId, body);
  }

  @Post(':callId/summary/share')
  @HttpCode(HttpStatus.OK)
  share(
    @WorkspaceId() workspaceId: string,
    @Param('callId') callId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(shareCallSummarySchema)) body: ShareCallSummaryInput,
  ) {
    return this.summary.shareSummary(workspaceId, user.id, callId, body);
  }

  // --- Action Items ---

  @Get(':callId/action-items')
  listActionItems(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: CurrentUserType,
    @Param('callId') callId: string,
  ) {
    return this.calls.listActionItems(workspaceId, user.id, callId);
  }

  @Post(':callId/action-items')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  addActionItem(
    @WorkspaceId() workspaceId: string,
    @Param('callId') callId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(createCallActionItemSchema)) body: CreateCallActionItemInput,
  ) {
    return this.calls.addActionItem(workspaceId, callId, user.id, body);
  }

  @Patch(':callId/action-items/:id')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  updateActionItem(
    @WorkspaceId() workspaceId: string,
    @Param('callId') callId: string,
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(updateCallActionItemSchema)) body: UpdateCallActionItemInput,
  ) {
    return this.calls.updateActionItem(workspaceId, callId, id, user.id, body);
  }

  @Delete(':callId/action-items/:id')
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteActionItem(
    @WorkspaceId() workspaceId: string,
    @Param('callId') callId: string,
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ): Promise<void> {
    return this.calls.deleteActionItem(workspaceId, callId, id, user.id);
  }

  @Post(':callId/action-items/:id/convert-to-task')
  @HttpCode(HttpStatus.OK)
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  convertActionItemToTask(
    @WorkspaceId() workspaceId: string,
    @Param('callId') callId: string,
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
    @Query('projectId') projectId?: string,
  ) {
    return this.calls.convertActionItemToTask(
      workspaceId,
      callId,
      id,
      user.id,
      projectId,
    );
  }

  // --- Decisions ---

  @Get(':callId/decisions')
  listDecisions(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: CurrentUserType,
    @Param('callId') callId: string,
  ) {
    return this.calls.listDecisions(workspaceId, user.id, callId);
  }

  @Post(':callId/decisions')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  addDecision(
    @WorkspaceId() workspaceId: string,
    @Param('callId') callId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(createCallDecisionSchema)) body: CreateCallDecisionInput,
  ) {
    return this.calls.addDecision(workspaceId, callId, user.id, body);
  }

  @Patch(':callId/decisions/:id')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  updateDecision(
    @WorkspaceId() workspaceId: string,
    @Param('callId') callId: string,
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(updateCallDecisionSchema)) body: UpdateCallDecisionInput,
  ) {
    return this.calls.updateDecision(workspaceId, callId, id, user.id, body);
  }

  @Delete(':callId/decisions/:id')
  @RequireWorkspacePermissions(WorkspacePermission.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDecision(
    @WorkspaceId() workspaceId: string,
    @Param('callId') callId: string,
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ): Promise<void> {
    return this.calls.deleteDecision(workspaceId, callId, id, user.id);
  }

  // --- Transcript ---

  @Get(':callId/transcript')
  getTranscript(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: CurrentUserType,
    @Param('callId') callId: string,
  ) {
    return this.calls.getTranscript(workspaceId, user.id, callId);
  }

  @Post(':callId/transcript')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  appendTranscript(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: CurrentUserType,
    @Param('callId') callId: string,
    @Body(zodBody(appendCallTranscriptSchema)) body: AppendCallTranscriptInput,
  ) {
    return this.calls.appendTranscript(workspaceId, user.id, callId, body);
  }
}
