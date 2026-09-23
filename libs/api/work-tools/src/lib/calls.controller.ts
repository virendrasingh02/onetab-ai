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
import {
  WorkspacePermission,
  type CallSessionStatus,
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
} from '@org/validation';
import { CallSummaryService } from './call-summary.service.js';
import { CallsService } from './calls.service.js';

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
    @Query('conversationId') conversationId?: string,
    @Query('meetingId') meetingId?: string,
    @Query('status') status?: CallSessionStatus,
  ) {
    return this.calls.listCalls(workspaceId, {
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
    @Param('callId') callId: string,
  ) {
    return this.calls.getCall(workspaceId, callId);
  }

  @Patch(':callId')
  @RequireWorkspacePermissions(WorkspacePermission.UPDATE)
  update(
    @WorkspaceId() workspaceId: string,
    @Param('callId') callId: string,
    @Body(zodBody(updateCallSchema)) body: UpdateCallInput,
  ) {
    return this.calls.updateCall(workspaceId, callId, body);
  }

  @Post(':callId/end')
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
    @Param('callId') callId: string,
  ) {
    return this.calls.getNotes(workspaceId, callId);
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
    @Param('callId') callId: string,
  ) {
    return this.summary.getSummary(workspaceId, callId);
  }

  @Post(':callId/summary/generate')
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
  askQuestion(
    @WorkspaceId() workspaceId: string,
    @Param('callId') callId: string,
    @CurrentUser() user: CurrentUserType,
    @Body(zodBody(askCallQuestionSchema)) body: AskCallQuestionInput,
  ) {
    return this.summary.askQuestion(workspaceId, user.id, callId, body);
  }

  @Post(':callId/ai/assist')
  assistNotes(
    @WorkspaceId() workspaceId: string,
    @Body(zodBody(callNotesAssistSchema)) body: CallNotesAssistInput,
  ) {
    return this.summary.assistNotes(workspaceId, body);
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
    @Param('callId') callId: string,
  ) {
    return this.calls.listActionItems(workspaceId, callId);
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
    @Param('callId') callId: string,
  ) {
    return this.calls.listDecisions(workspaceId, callId);
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
    @Param('callId') callId: string,
  ) {
    return this.calls.getTranscript(workspaceId, callId);
  }

  @Post(':callId/transcript')
  @RequireWorkspacePermissions(WorkspacePermission.CREATE)
  appendTranscript(
    @WorkspaceId() workspaceId: string,
    @Param('callId') callId: string,
    @Body(zodBody(appendCallTranscriptSchema)) body: AppendCallTranscriptInput,
  ) {
    return this.calls.appendTranscript(workspaceId, callId, body);
  }
}
