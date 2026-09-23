import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvent, PUBLIC_USER_SELECT, toPublicUser } from '@org/api-common';
import { PrismaService } from '@org/database';
import {
  type CallActionItemView,
  type CallDecisionView,
  type CallDetailView,
  type CallNoteView,
  type CallSessionKind,
  type CallSessionStatus,
  type CallTranscriptItemView,
  type CallView,
  type TaskPriority,
} from '@org/types';
import {
  type AppendCallTranscriptInput,
  type CreateCallActionItemInput,
  type CreateCallDecisionInput,
  type CreateCallNoteInput,
  type StartCallInput,
  type UpdateCallActionItemInput,
  type UpdateCallDecisionInput,
  type UpdateCallInput,
  type UpdateCallNoteInput,
} from '@org/validation';
import { CallSummaryService } from './call-summary.service.js';

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly summaryService: CallSummaryService,
  ) {}

  private toCallView(call: any): CallView {
    return {
      id: call.id,
      workspaceId: call.workspaceId,
      conversationId: call.conversationId,
      channelId: call.channelId,
      meetingId: call.meetingId,
      title: call.title,
      kind: call.kind as CallSessionKind,
      status: call.status as CallSessionStatus,
      startedById: call.startedById,
      startedAt: call.startedAt.toISOString(),
      endedAt: call.endedAt?.toISOString() ?? null,
      recordingUrl: call.recordingUrl,
      createdAt: call.createdAt.toISOString(),
      updatedAt: call.updatedAt.toISOString(),
      startedBy: toPublicUser(call.startedBy),
      participants: (call.participants || []).map((p: any) => ({
        id: p.id,
        callId: p.callId,
        userId: p.userId,
        joinedAt: p.joinedAt.toISOString(),
        leftAt: p.leftAt?.toISOString() ?? null,
        user: toPublicUser(p.user),
      })),
      summary: call.summary
        ? {
            id: call.summary.id,
            callId: call.summary.callId,
            workspaceId: call.summary.workspaceId,
            status: call.summary.status,
            overview: call.summary.overview,
            keyPoints: Array.isArray(call.summary.keyPoints)
              ? call.summary.keyPoints
              : [],
            openQuestions: Array.isArray(call.summary.openQuestions)
              ? call.summary.openQuestions
              : [],
            followUps: Array.isArray(call.summary.followUps)
              ? call.summary.followUps
              : [],
            importantLinks: Array.isArray(call.summary.importantLinks)
              ? call.summary.importantLinks
              : [],
            rawContent: call.summary.rawContent,
            version: call.summary.version,
            failureReason: call.summary.failureReason,
            generatedById: call.summary.generatedById,
            generatedAt: call.summary.generatedAt.toISOString(),
            updatedAt: call.summary.updatedAt.toISOString(),
          }
        : null,
      _count: call._count
        ? {
            notes: call._count.notes,
            actionItems: call._count.actionItems,
            decisions: call._count.decisions,
            transcripts: call._count.transcripts,
          }
        : undefined,
    };
  }

  /**
   * Start a new call or reconnect to active call in a conversation.
   */
  async startCall(
    workspaceId: string,
    userId: string,
    input: StartCallInput,
  ): Promise<CallView> {
    // Check if active call already exists in this conversation
    const active = await this.prisma.call.findFirst({
      where: {
        workspaceId,
        conversationId: input.conversationId,
        status: 'ACTIVE',
      },
      include: {
        startedBy: { select: PUBLIC_USER_SELECT },
        participants: {
          include: { user: { select: PUBLIC_USER_SELECT } },
        },
        summary: true,
      },
    });

    if (active) {
      // Ensure user is added as participant
      await this.prisma.callParticipant.upsert({
        where: {
          callId_userId: { callId: active.id, userId },
        },
        create: {
          callId: active.id,
          userId,
        },
        update: {
          leftAt: null,
        },
      });

      const refreshed = await this.prisma.call.findUniqueOrThrow({
        where: { id: active.id },
        include: {
          startedBy: { select: PUBLIC_USER_SELECT },
          participants: {
            include: { user: { select: PUBLIC_USER_SELECT } },
          },
          summary: true,
        },
      });

      return this.toCallView(refreshed);
    }

    const created = await this.prisma.call.create({
      data: {
        workspaceId,
        conversationId: input.conversationId,
        channelId: input.channelId ?? null,
        meetingId: input.meetingId ?? null,
        title: input.title,
        kind: input.kind,
        status: 'ACTIVE',
        startedById: userId,
        participants: {
          create: {
            userId,
          },
        },
      },
      include: {
        startedBy: { select: PUBLIC_USER_SELECT },
        participants: {
          include: { user: { select: PUBLIC_USER_SELECT } },
        },
        summary: true,
      },
    });

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

    return this.toCallView(created);
  }

  /**
   * End a call session. Triggers AI summary generation asynchronously.
   */
  async endCall(
    workspaceId: string,
    userId: string,
    callId: string,
  ): Promise<CallView> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call || call.workspaceId !== workspaceId) {
      throw new NotFoundException('Call not found.');
    }

    const endedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.round((endedAt.getTime() - call.startedAt.getTime()) / 1000),
    );

    const updated = await this.prisma.call.update({
      where: { id: callId },
      data: {
        status: 'ENDED',
        endedAt,
        participants: {
          updateMany: {
            where: { leftAt: null },
            data: { leftAt: endedAt },
          },
        },
      },
      include: {
        startedBy: { select: PUBLIC_USER_SELECT },
        participants: {
          include: { user: { select: PUBLIC_USER_SELECT } },
        },
        summary: true,
      },
    });

    this.events.emit(AppEvent.CallEnded, {
      workspaceId,
      actorId: userId,
      callId: updated.id,
      conversationId: updated.conversationId,
      durationSeconds,
    });

    // Asynchronously trigger AI summary generation so UI is not blocked
    void this.summaryService
      .generateSummary(workspaceId, userId, callId)
      .catch((err) => {
        this.logger.error(`Background summary generation failed for call ${callId}`, err);
      });

    return this.toCallView(updated);
  }

  /**
   * List calls for a workspace.
   */
  async listCalls(
    workspaceId: string,
    filters?: {
      conversationId?: string;
      meetingId?: string;
      status?: CallSessionStatus;
    },
  ): Promise<CallView[]> {
    const rows = await this.prisma.call.findMany({
      where: {
        workspaceId,
        ...(filters?.conversationId ? { conversationId: filters.conversationId } : {}),
        ...(filters?.meetingId ? { meetingId: filters.meetingId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
      },
      include: {
        startedBy: { select: PUBLIC_USER_SELECT },
        participants: {
          include: { user: { select: PUBLIC_USER_SELECT } },
        },
        summary: true,
        _count: {
          select: {
            notes: true,
            actionItems: true,
            decisions: true,
            transcripts: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });

    return rows.map((r) => this.toCallView(r));
  }

  /**
   * Retrieve full call details including notes, summary, decisions, action items, transcript.
   */
  async getCall(workspaceId: string, callId: string): Promise<CallDetailView> {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: {
        startedBy: { select: PUBLIC_USER_SELECT },
        participants: {
          include: { user: { select: PUBLIC_USER_SELECT } },
        },
        summary: {
          include: {
            feedbacks: {
              include: { user: { select: PUBLIC_USER_SELECT } },
            },
          },
        },
        notes: {
          include: { author: { select: PUBLIC_USER_SELECT } },
          orderBy: { createdAt: 'asc' },
        },
        actionItems: {
          include: {
            assignee: { select: PUBLIC_USER_SELECT },
            task: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        decisions: {
          include: { madeBy: { select: PUBLIC_USER_SELECT } },
          orderBy: { createdAt: 'asc' },
        },
        transcripts: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!call || call.workspaceId !== workspaceId) {
      throw new NotFoundException('Call not found.');
    }

    const base = this.toCallView(call);

    return {
      ...base,
      notes: call.notes.map((n) => ({
        id: n.id,
        callId: n.callId,
        workspaceId: n.workspaceId,
        authorId: n.authorId,
        content: n.content,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
        author: toPublicUser(n.author),
      })),
      summary: base.summary ?? null,
      actionItems: call.actionItems.map((a) => ({
        id: a.id,
        callId: a.callId,
        summaryId: a.summaryId,
        workspaceId: a.workspaceId,
        title: a.title,
        description: a.description,
        assigneeId: a.assigneeId,
        dueDate: a.dueDate?.toISOString() ?? null,
        status: a.status,
        priority: a.priority as TaskPriority,
        sourceTimestamp: a.sourceTimestamp,
        taskId: a.taskId,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        assignee: a.assignee ? toPublicUser(a.assignee) : null,
        task: a.task as any,
      })),
      decisions: call.decisions.map((d) => ({
        id: d.id,
        callId: d.callId,
        summaryId: d.summaryId,
        workspaceId: d.workspaceId,
        content: d.content,
        sourceTimestamp: d.sourceTimestamp,
        madeById: d.madeById,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        madeBy: d.madeBy ? toPublicUser(d.madeBy) : null,
      })),
      transcripts: call.transcripts.map((t) => ({
        id: t.id,
        callId: t.callId,
        speakerId: t.speakerId,
        speakerName: t.speakerName,
        text: t.text,
        timestamp: t.timestamp,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Update call title or settings.
   */
  async updateCall(
    workspaceId: string,
    callId: string,
    input: UpdateCallInput,
  ): Promise<CallView> {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call || call.workspaceId !== workspaceId) {
      throw new NotFoundException('Call not found.');
    }

    const updated = await this.prisma.call.update({
      where: { id: callId },
      data: {
        ...(input.title ? { title: input.title } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.recordingUrl !== undefined ? { recordingUrl: input.recordingUrl } : {}),
      },
      include: {
        startedBy: { select: PUBLIC_USER_SELECT },
        participants: {
          include: { user: { select: PUBLIC_USER_SELECT } },
        },
        summary: true,
      },
    });

    return this.toCallView(updated);
  }

  // --- Notes Management ---

  async getNotes(workspaceId: string, callId: string): Promise<CallNoteView[]> {
    const notes = await this.prisma.callNote.findMany({
      where: { callId, workspaceId },
      include: { author: { select: PUBLIC_USER_SELECT } },
      orderBy: { createdAt: 'asc' },
    });

    return notes.map((n) => ({
      id: n.id,
      callId: n.callId,
      workspaceId: n.workspaceId,
      authorId: n.authorId,
      content: n.content,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
      author: toPublicUser(n.author),
    }));
  }

  async addNote(
    workspaceId: string,
    callId: string,
    userId: string,
    input: CreateCallNoteInput,
  ): Promise<CallNoteView> {
    const note = await this.prisma.callNote.create({
      data: {
        callId,
        workspaceId,
        authorId: userId,
        content: input.content,
      },
      include: { author: { select: PUBLIC_USER_SELECT } },
    });

    this.events.emit(AppEvent.CallNoteUpdated, {
      workspaceId,
      actorId: userId,
      callId,
      noteId: note.id,
      action: 'created',
    });

    return {
      id: note.id,
      callId: note.callId,
      workspaceId: note.workspaceId,
      authorId: note.authorId,
      content: note.content,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
      author: toPublicUser(note.author),
    };
  }

  async updateNote(
    workspaceId: string,
    callId: string,
    noteId: string,
    userId: string,
    input: UpdateCallNoteInput,
  ): Promise<CallNoteView> {
    const note = await this.prisma.callNote.findUnique({
      where: { id: noteId },
    });

    if (!note || note.workspaceId !== workspaceId || note.callId !== callId) {
      throw new NotFoundException('Note not found.');
    }

    const updated = await this.prisma.callNote.update({
      where: { id: noteId },
      data: {
        content: input.content,
        updatedAt: new Date(),
      },
      include: { author: { select: PUBLIC_USER_SELECT } },
    });

    this.events.emit(AppEvent.CallNoteUpdated, {
      workspaceId,
      actorId: userId,
      callId,
      noteId: updated.id,
      action: 'updated',
    });

    return {
      id: updated.id,
      callId: updated.callId,
      workspaceId: updated.workspaceId,
      authorId: updated.authorId,
      content: updated.content,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      author: toPublicUser(updated.author),
    };
  }

  async deleteNote(
    workspaceId: string,
    callId: string,
    noteId: string,
    userId: string,
  ): Promise<void> {
    const note = await this.prisma.callNote.findUnique({
      where: { id: noteId },
    });

    if (!note || note.workspaceId !== workspaceId || note.callId !== callId) {
      throw new NotFoundException('Note not found.');
    }

    await this.prisma.callNote.delete({ where: { id: noteId } });

    this.events.emit(AppEvent.CallNoteUpdated, {
      workspaceId,
      actorId: userId,
      callId,
      noteId,
      action: 'deleted',
    });
  }

  // --- Action Items Management ---

  async listActionItems(
    workspaceId: string,
    callId: string,
  ): Promise<CallActionItemView[]> {
    const items = await this.prisma.callActionItem.findMany({
      where: { callId, workspaceId },
      include: {
        assignee: { select: PUBLIC_USER_SELECT },
        task: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return items.map((a) => ({
      id: a.id,
      callId: a.callId,
      summaryId: a.summaryId,
      workspaceId: a.workspaceId,
      title: a.title,
      description: a.description,
      assigneeId: a.assigneeId,
      dueDate: a.dueDate?.toISOString() ?? null,
      status: a.status,
      priority: a.priority as TaskPriority,
      sourceTimestamp: a.sourceTimestamp,
      taskId: a.taskId,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      assignee: a.assignee ? toPublicUser(a.assignee) : null,
      task: a.task as any,
    }));
  }

  async addActionItem(
    workspaceId: string,
    callId: string,
    userId: string,
    input: CreateCallActionItemInput,
  ): Promise<CallActionItemView> {
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
      include: {
        assignee: { select: PUBLIC_USER_SELECT },
      },
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

    return {
      id: created.id,
      callId: created.callId,
      summaryId: created.summaryId,
      workspaceId: created.workspaceId,
      title: created.title,
      description: created.description,
      assigneeId: created.assigneeId,
      dueDate: created.dueDate?.toISOString() ?? null,
      status: created.status,
      priority: created.priority as TaskPriority,
      sourceTimestamp: created.sourceTimestamp,
      taskId: created.taskId,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      assignee: created.assignee ? toPublicUser(created.assignee) : null,
    };
  }

  async updateActionItem(
    workspaceId: string,
    callId: string,
    id: string,
    userId: string,
    input: UpdateCallActionItemInput,
  ): Promise<CallActionItemView> {
    const item = await this.prisma.callActionItem.findUnique({ where: { id } });
    if (!item || item.workspaceId !== workspaceId || item.callId !== callId) {
      throw new NotFoundException('Action item not found.');
    }

    const updated = await this.prisma.callActionItem.update({
      where: { id },
      data: {
        ...(input.title ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate ? new Date(input.dueDate) : null } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.priority ? { priority: input.priority } : {}),
        ...(input.sourceTimestamp !== undefined ? { sourceTimestamp: input.sourceTimestamp } : {}),
        updatedAt: new Date(),
      },
      include: {
        assignee: { select: PUBLIC_USER_SELECT },
        task: true,
      },
    });

    // If linked to a real Task, update the Task status as well
    if (updated.taskId && input.status) {
      await this.prisma.task.update({
        where: { id: updated.taskId },
        data: {
          status: input.status === 'DONE' ? 'DONE' : 'TODO',
          completedAt: input.status === 'DONE' ? new Date() : null,
        },
      });
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

    return {
      id: updated.id,
      callId: updated.callId,
      summaryId: updated.summaryId,
      workspaceId: updated.workspaceId,
      title: updated.title,
      description: updated.description,
      assigneeId: updated.assigneeId,
      dueDate: updated.dueDate?.toISOString() ?? null,
      status: updated.status,
      priority: updated.priority as TaskPriority,
      sourceTimestamp: updated.sourceTimestamp,
      taskId: updated.taskId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      assignee: updated.assignee ? toPublicUser(updated.assignee) : null,
      task: updated.task as any,
    };
  }

  async deleteActionItem(
    workspaceId: string,
    callId: string,
    id: string,
    userId: string,
  ): Promise<void> {
    const item = await this.prisma.callActionItem.findUnique({ where: { id } });
    if (!item || item.workspaceId !== workspaceId || item.callId !== callId) {
      throw new NotFoundException('Action item not found.');
    }

    await this.prisma.callActionItem.delete({ where: { id } });

    this.events.emit(AppEvent.CallActionItemUpdated, {
      workspaceId,
      actorId: userId,
      callId,
      actionItemId: id,
      action: 'deleted',
    });
  }

  /**
   * Convert an action item to a first-class workspace Task.
   */
  async convertActionItemToTask(
    workspaceId: string,
    callId: string,
    id: string,
    userId: string,
    projectId?: string | null,
  ): Promise<CallActionItemView> {
    const item = await this.prisma.callActionItem.findUnique({
      where: { id },
      include: { call: true },
    });

    if (!item || item.workspaceId !== workspaceId || item.callId !== callId) {
      throw new NotFoundException('Action item not found.');
    }

    if (item.taskId) {
      // Already converted
      const existingTask = await this.prisma.task.findUnique({
        where: { id: item.taskId },
      });
      if (existingTask) {
        return this.getActionItemView(id);
      }
    }

    // Determine target project if any
    const targetProjectId = projectId ?? item.call.channelId ? null : null;

    // Create a real task in the workspace
    const task = await this.prisma.task.create({
      data: {
        workspaceId,
        projectId: targetProjectId,
        meetingId: item.call.meetingId ?? null,
        title: item.title,
        description: item.description ?? `Action item from call: ${item.call.title}`,
        assigneeId: item.assigneeId,
        assigneeIds: item.assigneeId ? [item.assigneeId] : [],
        reporterId: userId,
        dueDate: item.dueDate,
        priority: item.priority,
        status: item.status === 'DONE' ? 'DONE' : 'TODO',
      },
    });

    // Link back to action item
    await this.prisma.callActionItem.update({
      where: { id },
      data: { taskId: task.id },
    });

    return this.getActionItemView(id);
  }

  private async getActionItemView(id: string): Promise<CallActionItemView> {
    const updated = await this.prisma.callActionItem.findUniqueOrThrow({
      where: { id },
      include: {
        assignee: { select: PUBLIC_USER_SELECT },
        task: true,
      },
    });

    return {
      id: updated.id,
      callId: updated.callId,
      summaryId: updated.summaryId,
      workspaceId: updated.workspaceId,
      title: updated.title,
      description: updated.description,
      assigneeId: updated.assigneeId,
      dueDate: updated.dueDate?.toISOString() ?? null,
      status: updated.status,
      priority: updated.priority as TaskPriority,
      sourceTimestamp: updated.sourceTimestamp,
      taskId: updated.taskId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      assignee: updated.assignee ? toPublicUser(updated.assignee) : null,
      task: updated.task as any,
    };
  }

  // --- Decisions Management ---

  async listDecisions(
    workspaceId: string,
    callId: string,
  ): Promise<CallDecisionView[]> {
    const rows = await this.prisma.callDecision.findMany({
      where: { callId, workspaceId },
      include: { madeBy: { select: PUBLIC_USER_SELECT } },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((d) => ({
      id: d.id,
      callId: d.callId,
      summaryId: d.summaryId,
      workspaceId: d.workspaceId,
      content: d.content,
      sourceTimestamp: d.sourceTimestamp,
      madeById: d.madeById,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      madeBy: d.madeBy ? toPublicUser(d.madeBy) : null,
    }));
  }

  async addDecision(
    workspaceId: string,
    callId: string,
    userId: string,
    input: CreateCallDecisionInput,
  ): Promise<CallDecisionView> {
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

    this.events.emit(AppEvent.CallDecisionUpdated, {
      workspaceId,
      actorId: userId,
      callId,
      decisionId: created.id,
      action: 'created',
    });

    return {
      id: created.id,
      callId: created.callId,
      summaryId: created.summaryId,
      workspaceId: created.workspaceId,
      content: created.content,
      sourceTimestamp: created.sourceTimestamp,
      madeById: created.madeById,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      madeBy: created.madeBy ? toPublicUser(created.madeBy) : null,
    };
  }

  async updateDecision(
    workspaceId: string,
    callId: string,
    id: string,
    userId: string,
    input: UpdateCallDecisionInput,
  ): Promise<CallDecisionView> {
    const dec = await this.prisma.callDecision.findUnique({ where: { id } });
    if (!dec || dec.workspaceId !== workspaceId || dec.callId !== callId) {
      throw new NotFoundException('Decision not found.');
    }

    const updated = await this.prisma.callDecision.update({
      where: { id },
      data: {
        ...(input.content ? { content: input.content } : {}),
        ...(input.sourceTimestamp !== undefined ? { sourceTimestamp: input.sourceTimestamp } : {}),
        updatedAt: new Date(),
      },
      include: { madeBy: { select: PUBLIC_USER_SELECT } },
    });

    this.events.emit(AppEvent.CallDecisionUpdated, {
      workspaceId,
      actorId: userId,
      callId,
      decisionId: updated.id,
      action: 'updated',
    });

    return {
      id: updated.id,
      callId: updated.callId,
      summaryId: updated.summaryId,
      workspaceId: updated.workspaceId,
      content: updated.content,
      sourceTimestamp: updated.sourceTimestamp,
      madeById: updated.madeById,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      madeBy: updated.madeBy ? toPublicUser(updated.madeBy) : null,
    };
  }

  async deleteDecision(
    workspaceId: string,
    callId: string,
    id: string,
    userId: string,
  ): Promise<void> {
    const dec = await this.prisma.callDecision.findUnique({ where: { id } });
    if (!dec || dec.workspaceId !== workspaceId || dec.callId !== callId) {
      throw new NotFoundException('Decision not found.');
    }

    await this.prisma.callDecision.delete({ where: { id } });

    this.events.emit(AppEvent.CallDecisionUpdated, {
      workspaceId,
      actorId: userId,
      callId,
      decisionId: id,
      action: 'deleted',
    });
  }

  // --- Transcript Management ---

  async getTranscript(
    workspaceId: string,
    callId: string,
  ): Promise<CallTranscriptItemView[]> {
    const rows = await this.prisma.callTranscriptItem.findMany({
      where: { callId },
      orderBy: { timestamp: 'asc' },
    });

    return rows.map((t) => ({
      id: t.id,
      callId: t.callId,
      speakerId: t.speakerId,
      speakerName: t.speakerName,
      text: t.text,
      timestamp: t.timestamp,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  async appendTranscript(
    workspaceId: string,
    callId: string,
    input: AppendCallTranscriptInput,
  ): Promise<CallTranscriptItemView[]> {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call || call.workspaceId !== workspaceId) {
      throw new NotFoundException('Call not found.');
    }

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

    return created.map((t) => ({
      id: t.id,
      callId: t.callId,
      speakerId: t.speakerId,
      speakerName: t.speakerName,
      text: t.text,
      timestamp: t.timestamp,
      createdAt: t.createdAt.toISOString(),
    }));
  }
}
