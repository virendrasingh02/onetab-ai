import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvent, PUBLIC_USER_SELECT } from '@org/api-common';
import { PrismaService } from '@org/database';
import type {
  CallActionItemView,
  CallDecisionView,
  CallDetailView,
  CallNoteView,
  CallSessionStatus,
  CallTranscriptItemView,
  CallView,
  EndCallResponse,
} from '@org/types';
import type {
  AppendCallTranscriptInput,
  CreateCallActionItemInput,
  CreateCallDecisionInput,
  CreateCallNoteInput,
  StartCallInput,
  UpdateCallActionItemInput,
  UpdateCallDecisionInput,
  UpdateCallInput,
  UpdateCallNoteInput,
  UpsertMyCallNoteInput,
} from '@org/validation';
import { CallAccessService } from './call-access.service.js';
import {
  ACTION_ITEM_INCLUDE,
  CALL_INCLUDE,
  type CallRow,
  toActionItemView,
  toCallView,
  toDecisionView,
  toNoteView,
  toTranscriptView,
} from './call-mappers.js';
import { CallSummaryService } from './call-summary.service.js';
import { WorkToolsService } from './work-tools.service.js';

const CALL_STATUSES: readonly CallSessionStatus[] = ['ACTIVE', 'ENDED'];
const isUniqueViolation = (err: unknown) =>
  typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly access: CallAccessService,
    private readonly summaryService: CallSummaryService,
    private readonly workTools: WorkToolsService,
  ) {}

  // --- Sessions ------------------------------------------------------------

  /**
   * Starts a call session for a conversation, or joins the one already live
   * there. Both ends of a Matrix call report "connected", so the second caller
   * lands on the first one's session instead of splitting notes across two.
   */
  async startCall(
    workspaceId: string,
    userId: string,
    input: StartCallInput,
  ): Promise<CallView> {
    const channel = await this.resolveChannel(workspaceId, input);
    if (channel?.visibility === 'PRIVATE') {
      const member = await this.prisma.channelMember.count({
        where: { channelId: channel.id, userId },
      });
      if (member === 0) throw new NotFoundException('Conversation not found.');
    }
    if (input.meetingId) {
      const meeting = await this.prisma.meeting.count({
        where: { id: input.meetingId, workspaceId },
      });
      if (meeting === 0) throw new NotFoundException('Meeting not found.');
    }

    const joinActive = async (): Promise<CallView | null> => {
      const active = await this.prisma.call.findFirst({
        where: { workspaceId, conversationId: input.conversationId, status: 'ACTIVE' },
        select: { id: true, matrixCallId: true, startedById: true },
      });
      if (!active) return null;
      if (
        input.matrixCallId &&
        active.matrixCallId &&
        active.matrixCallId !== input.matrixCallId
      ) {
        // A new Matrix call while the previous session is still open: that
        // one was orphaned (a tab closed mid-call). Close it rather than let
        // this call's notes land in it.
        await this.closeSession(workspaceId, active.startedById, active.id);
        return null;
      }
      await this.prisma.callParticipant.upsert({
        where: { callId_userId: { callId: active.id, userId } },
        create: { callId: active.id, userId },
        update: { leftAt: null },
      });
      const refreshed = await this.prisma.call.findUniqueOrThrow({
        where: { id: active.id },
        include: CALL_INCLUDE,
      });
      return toCallView(refreshed);
    };

    const existing = await joinActive();
    if (existing) return existing;

    let created: CallRow;
    try {
      created = await this.prisma.call.create({
        data: {
          workspaceId,
          conversationId: input.conversationId,
          channelId: channel?.id ?? null,
          meetingId: input.meetingId ?? null,
          title: input.title,
          kind: input.kind,
          matrixCallId: input.matrixCallId ?? null,
          status: 'ACTIVE',
          startedById: userId,
          participants: { create: { userId } },
        },
        include: CALL_INCLUDE,
      });
    } catch (err) {
      // Lost the race to the other side of the call (one live call per
      // conversation is a unique index) — join theirs.
      if (isUniqueViolation(err)) {
        const joined = await joinActive();
        if (joined) return joined;
      }
      throw err;
    }

    this.events.emit(AppEvent.CallStarted, {
      workspaceId,
      actorId: userId,
      callId: created.id,
      conversationId: created.conversationId,
      channelId: created.channelId,
      meetingId: created.meetingId,
      title: created.title,
      kind: created.kind,
    });

    return toCallView(created);
  }

  /**
   * Ends the session once. Every participant's client reports the hang-up, so
   * a repeat is a no-op that returns the ended call with `endedNow: false` —
   * the summary is generated (and the chat card posted) exactly once.
   */
  async endCall(
    workspaceId: string,
    userId: string,
    callId: string,
  ): Promise<EndCallResponse> {
    await this.access.assertIsParticipant(workspaceId, userId, callId);
    const endedNow = await this.closeSession(workspaceId, userId, callId);
    const call = await this.prisma.call.findUniqueOrThrow({
      where: { id: callId },
      include: CALL_INCLUDE,
    });
    return { ...toCallView(call), endedNow };
  }

  /**
   * Flips ACTIVE → ENDED at most once, closes participation and starts the
   * summary. Returns false when the session was already closed.
   */
  private async closeSession(
    workspaceId: string,
    actorId: string,
    callId: string,
  ): Promise<boolean> {
    const endedAt = new Date();
    const closed = await this.prisma.call.updateMany({
      where: { id: callId, status: 'ACTIVE' },
      data: { status: 'ENDED', endedAt },
    });
    if (closed.count === 0) return false;

    await this.prisma.callParticipant.updateMany({
      where: { callId, leftAt: null },
      data: { leftAt: endedAt },
    });
    const call = await this.prisma.call.findUniqueOrThrow({
      where: { id: callId },
      select: { conversationId: true, startedAt: true },
    });

    this.events.emit(AppEvent.CallEnded, {
      workspaceId,
      actorId,
      callId,
      conversationId: call.conversationId,
      durationSeconds: Math.max(
        0,
        Math.round((endedAt.getTime() - call.startedAt.getTime()) / 1000),
      ),
    });

    // Off the request path: the hang-up must not wait on the model.
    void this.summaryService
      .generateSummary(workspaceId, actorId, callId)
      .catch((err) =>
        this.logger.error(`Background summary generation failed for call ${callId}`, err),
      );
    return true;
  }

  async listCalls(
    workspaceId: string,
    userId: string,
    filters: { conversationId?: string; meetingId?: string; status?: string } = {},
  ): Promise<CallView[]> {
    const status = filters.status as CallSessionStatus | undefined;
    if (status && !CALL_STATUSES.includes(status)) {
      throw new BadRequestException('Unknown call status.');
    }

    const rows = await this.prisma.call.findMany({
      where: {
        AND: [
          this.access.visibleWhere(workspaceId, userId),
          filters.conversationId ? { conversationId: filters.conversationId } : {},
          filters.meetingId ? { meetingId: filters.meetingId } : {},
          status ? { status } : {},
        ],
      },
      include: {
        ...CALL_INCLUDE,
        _count: {
          select: { notes: true, actionItems: true, decisions: true, transcripts: true },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });

    return rows.map(toCallView);
  }

  /** A meeting's calls — meeting-linked calls are visible to the workspace. */
  async listMeetingCalls(workspaceId: string, meetingId: string): Promise<CallView[]> {
    const rows = await this.prisma.call.findMany({
      where: { workspaceId, meetingId },
      include: CALL_INCLUDE,
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
    return rows.map(toCallView);
  }

  async getCall(
    workspaceId: string,
    userId: string,
    callId: string,
  ): Promise<CallDetailView> {
    await this.access.assertCanView(workspaceId, userId, callId);

    const call = await this.prisma.call.findUniqueOrThrow({
      where: { id: callId },
      include: {
        ...CALL_INCLUDE,
        notes: {
          include: { author: { select: PUBLIC_USER_SELECT } },
          orderBy: { createdAt: 'asc' },
        },
        actionItems: { include: ACTION_ITEM_INCLUDE, orderBy: { createdAt: 'asc' } },
        decisions: {
          include: { madeBy: { select: PUBLIC_USER_SELECT } },
          orderBy: { createdAt: 'asc' },
        },
        transcripts: { orderBy: { timestamp: 'asc' } },
      },
    });

    const base = toCallView(call);
    return {
      ...base,
      summary: base.summary ?? null,
      notes: call.notes.map(toNoteView),
      actionItems: call.actionItems.map(toActionItemView),
      decisions: call.decisions.map(toDecisionView),
      transcripts: call.transcripts.map(toTranscriptView),
      _count: {
        notes: call.notes.length,
        actionItems: call.actionItems.length,
        decisions: call.decisions.length,
        transcripts: call.transcripts.length,
      },
    };
  }

  async updateCall(
    workspaceId: string,
    userId: string,
    callId: string,
    input: UpdateCallInput,
  ): Promise<CallView> {
    await this.access.assertIsParticipant(workspaceId, userId, callId);

    const updated = await this.prisma.call.update({
      where: { id: callId },
      data: {
        ...(input.title ? { title: input.title } : {}),
        ...(input.recordingUrl !== undefined ? { recordingUrl: input.recordingUrl } : {}),
      },
      include: CALL_INCLUDE,
    });
    this.emitCallChange(workspaceId, userId, callId);
    return toCallView(updated);
  }

  // --- Notes ---------------------------------------------------------------

  async getNotes(
    workspaceId: string,
    userId: string,
    callId: string,
  ): Promise<CallNoteView[]> {
    await this.access.assertCanView(workspaceId, userId, callId);
    const notes = await this.prisma.callNote.findMany({
      where: { callId, workspaceId },
      include: { author: { select: PUBLIC_USER_SELECT } },
      orderBy: { createdAt: 'asc' },
    });
    return notes.map(toNoteView);
  }

  async addNote(
    workspaceId: string,
    callId: string,
    userId: string,
    input: CreateCallNoteInput,
  ): Promise<CallNoteView> {
    await this.access.assertCanView(workspaceId, userId, callId);
    const note = await this.prisma.callNote.create({
      data: { callId, workspaceId, authorId: userId, content: input.content },
      include: { author: { select: PUBLIC_USER_SELECT } },
    });
    this.emitNoteChange(workspaceId, userId, callId, note.id, 'created');
    return toNoteView(note);
  }

  /**
   * The caller's own running note for this call — created on the first save,
   * updated in place on every save after. This is what the live notes editor
   * autosaves into, so a call ends with one note per person, not one per
   * keystroke pause.
   */
  async upsertMyNote(
    workspaceId: string,
    callId: string,
    userId: string,
    input: UpsertMyCallNoteInput,
  ): Promise<CallNoteView> {
    await this.access.assertCanView(workspaceId, userId, callId);

    const existing = await this.prisma.callNote.findFirst({
      where: { callId, authorId: userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    const note = existing
      ? await this.prisma.callNote.update({
          where: { id: existing.id },
          data: { content: input.content },
          include: { author: { select: PUBLIC_USER_SELECT } },
        })
      : await this.prisma.callNote.create({
          data: { callId, workspaceId, authorId: userId, content: input.content },
          include: { author: { select: PUBLIC_USER_SELECT } },
        });

    this.emitNoteChange(workspaceId, userId, callId, note.id, existing ? 'updated' : 'created');
    return toNoteView(note);
  }

  async updateNote(
    workspaceId: string,
    callId: string,
    noteId: string,
    userId: string,
    input: UpdateCallNoteInput,
  ): Promise<CallNoteView> {
    await this.assertOwnNote(workspaceId, callId, noteId, userId);
    const updated = await this.prisma.callNote.update({
      where: { id: noteId },
      data: { content: input.content },
      include: { author: { select: PUBLIC_USER_SELECT } },
    });
    this.emitNoteChange(workspaceId, userId, callId, noteId, 'updated');
    return toNoteView(updated);
  }

  async deleteNote(
    workspaceId: string,
    callId: string,
    noteId: string,
    userId: string,
  ): Promise<void> {
    await this.assertOwnNote(workspaceId, callId, noteId, userId);
    await this.prisma.callNote.delete({ where: { id: noteId } });
    this.emitNoteChange(workspaceId, userId, callId, noteId, 'deleted');
  }

  /** A note is its author's words — nobody else edits or deletes it. */
  private async assertOwnNote(
    workspaceId: string,
    callId: string,
    noteId: string,
    userId: string,
  ): Promise<void> {
    await this.access.assertCanView(workspaceId, userId, callId);
    const note = await this.prisma.callNote.findFirst({
      where: { id: noteId, callId, workspaceId },
      select: { authorId: true },
    });
    if (!note) throw new NotFoundException('Note not found.');
    if (note.authorId !== userId) {
      throw new ForbiddenException('You can only change your own notes.');
    }
  }

  // --- Action items --------------------------------------------------------

  async listActionItems(
    workspaceId: string,
    userId: string,
    callId: string,
  ): Promise<CallActionItemView[]> {
    await this.access.assertCanView(workspaceId, userId, callId);
    const items = await this.prisma.callActionItem.findMany({
      where: { callId, workspaceId },
      include: ACTION_ITEM_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return items.map(toActionItemView);
  }

  async addActionItem(
    workspaceId: string,
    callId: string,
    userId: string,
    input: CreateCallActionItemInput,
  ): Promise<CallActionItemView> {
    await this.access.assertCanView(workspaceId, userId, callId);
    if (input.assigneeId) {
      await this.access.assertWorkspaceMember(workspaceId, input.assigneeId);
    }

    const created = await this.prisma.callActionItem.create({
      data: {
        callId,
        workspaceId,
        title: input.title,
        description: input.description ?? null,
        assigneeId: input.assigneeId ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        priority: input.priority ?? 'MEDIUM',
        sourceTimestamp: input.sourceTimestamp ?? null,
        status: 'TODO',
      },
      include: ACTION_ITEM_INCLUDE,
    });

    this.events.emit(AppEvent.CallActionItemUpdated, {
      workspaceId,
      actorId: userId,
      callId,
      actionItemId: created.id,
      action: 'created',
      title: created.title,
      assigneeId: created.assigneeId,
    });
    return toActionItemView(created);
  }

  async updateActionItem(
    workspaceId: string,
    callId: string,
    id: string,
    userId: string,
    input: UpdateCallActionItemInput,
  ): Promise<CallActionItemView> {
    await this.access.assertCanView(workspaceId, userId, callId);
    const item = await this.prisma.callActionItem.findFirst({
      where: { id, callId, workspaceId },
      select: { id: true, taskId: true },
    });
    if (!item) throw new NotFoundException('Action item not found.');
    if (input.assigneeId) {
      await this.access.assertWorkspaceMember(workspaceId, input.assigneeId);
    }

    const updated = await this.prisma.callActionItem.update({
      where: { id },
      data: {
        ...(input.title ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
        ...(input.dueDate !== undefined
          ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
          : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.priority ? { priority: input.priority } : {}),
        ...(input.sourceTimestamp !== undefined
          ? { sourceTimestamp: input.sourceTimestamp }
          : {}),
      },
      include: ACTION_ITEM_INCLUDE,
    });

    // Keep a converted task in step with its checkbox — through the tasks
    // service, so the board, activity log and notifications all see it. Only
    // a task this item completed is reopened; one that moved on (in review,
    // say) is left where it is.
    if (item.taskId && input.status && updated.task) {
      const taskStatus = updated.task.status;
      if (input.status === 'DONE' && taskStatus !== 'DONE') {
        await this.workTools.updateTask(workspaceId, item.taskId, { status: 'DONE' }, userId);
      } else if (input.status === 'TODO' && taskStatus === 'DONE') {
        await this.workTools.updateTask(workspaceId, item.taskId, { status: 'TODO' }, userId);
      }
    }

    this.events.emit(AppEvent.CallActionItemUpdated, {
      workspaceId,
      actorId: userId,
      callId,
      actionItemId: updated.id,
      action: input.status === 'DONE' ? 'completed' : 'updated',
      title: updated.title,
      // Only present when this request actually (re)assigned someone, so the
      // notification listener doesn't re-notify on unrelated field edits.
      assigneeId: input.assigneeId !== undefined ? updated.assigneeId : undefined,
    });

    return toActionItemView(updated);
  }

  async deleteActionItem(
    workspaceId: string,
    callId: string,
    id: string,
    userId: string,
  ): Promise<void> {
    await this.access.assertCanView(workspaceId, userId, callId);
    const removed = await this.prisma.callActionItem.deleteMany({
      where: { id, callId, workspaceId },
    });
    if (removed.count === 0) throw new NotFoundException('Action item not found.');

    this.events.emit(AppEvent.CallActionItemUpdated, {
      workspaceId,
      actorId: userId,
      callId,
      actionItemId: id,
      action: 'deleted',
    });
  }

  /**
   * Turns an action item into a real workspace task (optionally in a project),
   * via the tasks service so it gets a ticket number, board position, activity
   * entry and assignment notification like any other task.
   */
  async convertActionItemToTask(
    workspaceId: string,
    callId: string,
    id: string,
    userId: string,
    projectId?: string | null,
  ): Promise<CallActionItemView> {
    await this.access.assertCanView(workspaceId, userId, callId);
    const item = await this.prisma.callActionItem.findFirst({
      where: { id, callId, workspaceId },
      include: { call: { select: { title: true, meetingId: true } } },
    });
    if (!item) throw new NotFoundException('Action item not found.');

    if (item.taskId) {
      const stillThere = await this.prisma.task.count({ where: { id: item.taskId } });
      if (stillThere > 0) return this.getActionItemView(id);
    }

    const task = await this.workTools.createTask(
      workspaceId,
      {
        title: item.title,
        description: item.description ?? `Action item from the call "${item.call.title}".`,
        assigneeId: item.assigneeId,
        dueDate: item.dueDate?.toISOString() ?? null,
        priority: item.priority,
        status: item.status === 'DONE' ? 'DONE' : 'TODO',
        projectId: projectId || null,
        meetingId: item.call.meetingId,
      },
      userId,
    );

    // Claim the link; if a concurrent convert got there first, drop our copy
    // rather than leave a duplicate task on the board.
    const linked = await this.prisma.callActionItem.updateMany({
      where: { id, OR: [{ taskId: null }, { taskId: item.taskId }] },
      data: { taskId: task.id },
    });
    if (linked.count === 0) {
      await this.prisma.task.delete({ where: { id: task.id } }).catch(() => undefined);
    }

    this.emitCallChange(workspaceId, userId, callId, 'action_item', 'updated');
    return this.getActionItemView(id);
  }

  private async getActionItemView(id: string): Promise<CallActionItemView> {
    const item = await this.prisma.callActionItem.findUniqueOrThrow({
      where: { id },
      include: ACTION_ITEM_INCLUDE,
    });
    return toActionItemView(item);
  }

  // --- Decisions -----------------------------------------------------------

  async listDecisions(
    workspaceId: string,
    userId: string,
    callId: string,
  ): Promise<CallDecisionView[]> {
    await this.access.assertCanView(workspaceId, userId, callId);
    const rows = await this.prisma.callDecision.findMany({
      where: { callId, workspaceId },
      include: { madeBy: { select: PUBLIC_USER_SELECT } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDecisionView);
  }

  async addDecision(
    workspaceId: string,
    callId: string,
    userId: string,
    input: CreateCallDecisionInput,
  ): Promise<CallDecisionView> {
    await this.access.assertCanView(workspaceId, userId, callId);
    const created = await this.prisma.callDecision.create({
      data: {
        callId,
        workspaceId,
        content: input.content,
        sourceTimestamp: input.sourceTimestamp ?? null,
        madeById: userId,
      },
      include: { madeBy: { select: PUBLIC_USER_SELECT } },
    });
    this.emitDecisionChange(workspaceId, userId, callId, created.id, 'created');
    return toDecisionView(created);
  }

  async updateDecision(
    workspaceId: string,
    callId: string,
    id: string,
    userId: string,
    input: UpdateCallDecisionInput,
  ): Promise<CallDecisionView> {
    await this.access.assertCanView(workspaceId, userId, callId);
    const existing = await this.prisma.callDecision.count({
      where: { id, callId, workspaceId },
    });
    if (existing === 0) throw new NotFoundException('Decision not found.');

    const updated = await this.prisma.callDecision.update({
      where: { id },
      data: {
        ...(input.content ? { content: input.content } : {}),
        ...(input.sourceTimestamp !== undefined
          ? { sourceTimestamp: input.sourceTimestamp }
          : {}),
      },
      include: { madeBy: { select: PUBLIC_USER_SELECT } },
    });
    this.emitDecisionChange(workspaceId, userId, callId, id, 'updated');
    return toDecisionView(updated);
  }

  async deleteDecision(
    workspaceId: string,
    callId: string,
    id: string,
    userId: string,
  ): Promise<void> {
    await this.access.assertCanView(workspaceId, userId, callId);
    const removed = await this.prisma.callDecision.deleteMany({
      where: { id, callId, workspaceId },
    });
    if (removed.count === 0) throw new NotFoundException('Decision not found.');
    this.emitDecisionChange(workspaceId, userId, callId, id, 'deleted');
  }

  // --- Transcript ----------------------------------------------------------

  async getTranscript(
    workspaceId: string,
    userId: string,
    callId: string,
  ): Promise<CallTranscriptItemView[]> {
    await this.access.assertCanView(workspaceId, userId, callId);
    const rows = await this.prisma.callTranscriptItem.findMany({
      where: { callId },
      orderBy: { timestamp: 'asc' },
    });
    return rows.map(toTranscriptView);
  }

  /** Transcript comes from the people on the call (their clients' STT), no one else. */
  async appendTranscript(
    workspaceId: string,
    userId: string,
    callId: string,
    input: AppendCallTranscriptInput,
  ): Promise<CallTranscriptItemView[]> {
    await this.access.assertIsParticipant(workspaceId, userId, callId);
    const created = await this.prisma.$transaction(
      input.items.map((item) =>
        this.prisma.callTranscriptItem.create({
          data: {
            callId,
            speakerId: item.speakerId ?? null,
            speakerName: item.speakerName,
            text: item.text,
            timestamp: item.timestamp,
          },
        }),
      ),
    );
    this.emitCallChange(workspaceId, userId, callId, 'transcript', 'appended');
    return created.map(toTranscriptView);
  }

  // --- helpers -------------------------------------------------------------

  /**
   * The channel a call belongs to — the given id when it is in this workspace,
   * else the channel whose Matrix room the call is in. A 1:1 DM has none.
   */
  private async resolveChannel(
    workspaceId: string,
    input: StartCallInput,
  ): Promise<{ id: string; visibility: string } | null> {
    if (input.channelId) {
      const channel = await this.prisma.channel.findFirst({
        where: { id: input.channelId, workspaceId },
        select: { id: true, visibility: true },
      });
      if (!channel) throw new NotFoundException('Channel not found.');
      return channel;
    }
    return this.prisma.channel.findFirst({
      where: { workspaceId, matrixRoomId: input.conversationId },
      select: { id: true, visibility: true },
    });
  }

  private emitNoteChange(
    workspaceId: string,
    actorId: string,
    callId: string,
    noteId: string,
    action: 'created' | 'updated' | 'deleted',
  ): void {
    this.events.emit(AppEvent.CallNoteUpdated, { workspaceId, actorId, callId, noteId, action });
  }

  private emitDecisionChange(
    workspaceId: string,
    actorId: string,
    callId: string,
    decisionId: string,
    action: 'created' | 'updated' | 'deleted',
  ): void {
    this.events.emit(AppEvent.CallDecisionUpdated, {
      workspaceId,
      actorId,
      callId,
      decisionId,
      action,
    });
  }

  /** A change with no dedicated domain event — still refreshes open views. */
  private emitCallChange(
    workspaceId: string,
    actorId: string,
    callId: string,
    entity: 'call' | 'action_item' | 'transcript' = 'call',
    action = 'updated',
  ): void {
    this.events.emit(AppEvent.CallUpdated, { workspaceId, actorId, callId, entity, action });
  }
}
