import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvent, PUBLIC_USER_SELECT } from '@org/api-common';
import {
  MeetingParticipantRole,
  MeetingRsvp,
  MeetingStatus,
  Prisma,
  PrismaService,
} from '@org/database';
import type {
  CreateMeetingActionItemInput,
  CreateMeetingDecisionInput,
  CreateMeetingInput,
  CreateMeetingNoteInput,
  UpdateMeetingInput,
} from '@org/validation';
import { WorkToolsService } from './work-tools.service.js';

/** ISO string from a DTO → `Date` for Prisma. */
function toDate(value: string): Date {
  return new Date(value);
}

const PROJECT_REF_SELECT = {
  id: true,
  name: true,
  slug: true,
  color: true,
  icon: true,
  iconColor: true,
} satisfies Prisma.ProjectSelect;

const MEETING_LIST_INCLUDE = {
  organizer: { select: PUBLIC_USER_SELECT },
  project: { select: PROJECT_REF_SELECT },
  participants: {
    include: { user: { select: PUBLIC_USER_SELECT } },
    orderBy: { addedAt: 'asc' },
  },
  _count: {
    select: {
      participants: true,
      notes: true,
      decisions: true,
      actionItems: true,
    },
  },
} satisfies Prisma.MeetingInclude;

const MEETING_DETAIL_INCLUDE = {
  organizer: { select: PUBLIC_USER_SELECT },
  project: { select: PROJECT_REF_SELECT },
  calendarEvent: { select: { id: true } },
  participants: {
    include: { user: { select: PUBLIC_USER_SELECT } },
    orderBy: { addedAt: 'asc' },
  },
  notes: {
    include: { author: { select: PUBLIC_USER_SELECT } },
    orderBy: { createdAt: 'asc' },
  },
  decisions: {
    include: { author: { select: PUBLIC_USER_SELECT } },
    orderBy: { createdAt: 'asc' },
  },
  actionItems: {
    where: { deletedAt: null },
    include: { assignee: { select: PUBLIC_USER_SELECT } },
    orderBy: { createdAt: 'asc' },
  },
  _count: {
    select: {
      participants: true,
      notes: true,
      decisions: true,
      actionItems: true,
    },
  },
} satisfies Prisma.MeetingInclude;

export interface MeetingListFilters {
  status?: MeetingStatus;
  projectId?: string;
  /** Lower bound on `startAt` (ISO). */
  from?: string;
  /** Upper bound on `startAt` (ISO). */
  to?: string;
  /** `upcoming` = not cancelled and ending in the future; `past` = already ended. */
  scope?: 'upcoming' | 'past' | 'all';
}

/**
 * First-class meetings: scheduling, participants, running notes, decisions and
 * action items (real `Task` rows linked back through `Task.meetingId`).
 *
 * Every query is scoped by `workspaceId` from the route — the workspace is
 * never a caller-supplied filter — and soft-deleted rows are filtered out of
 * every read. Mirrors the tenancy rules in {@link WorkToolsService}.
 */
@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly workTools: WorkToolsService,
  ) {}

  async list(workspaceId: string, filters: MeetingListFilters = {}) {
    const now = new Date();
    const where: Prisma.MeetingWhereInput = {
      workspaceId,
      deletedAt: null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
    };

    if (filters.from || filters.to) {
      where.startAt = {
        ...(filters.from ? { gte: toDate(filters.from) } : {}),
        ...(filters.to ? { lte: toDate(filters.to) } : {}),
      };
    }

    if (filters.scope === 'upcoming') {
      where.status = { notIn: [MeetingStatus.CANCELLED, MeetingStatus.ENDED] };
      where.endAt = { gte: now };
    } else if (filters.scope === 'past') {
      where.OR = [{ endAt: { lt: now } }, { status: MeetingStatus.ENDED }];
    }

    const meetings = await this.prisma.meeting.findMany({
      where,
      include: MEETING_LIST_INCLUDE,
      orderBy: { startAt: filters.scope === 'past' ? 'desc' : 'asc' },
      take: 500,
    });
    return meetings;
  }

  async get(workspaceId: string, meetingId: string) {
    await this.assertMeeting(workspaceId, meetingId);
    return this.prisma.meeting.findUniqueOrThrow({
      where: { id: meetingId },
      include: MEETING_DETAIL_INCLUDE,
    });
  }

  async create(
    workspaceId: string,
    organizerId: string,
    input: CreateMeetingInput,
  ) {
    if (input.projectId) {
      await this.assertProject(workspaceId, input.projectId);
    }

    const participantIds = await this.resolveParticipantIds(
      workspaceId,
      input.participantIds ?? [],
      organizerId,
    );

    const meeting = await this.prisma.$transaction(async (tx) => {
      let calendarEventId: string | null = null;
      if (input.addToCalendar) {
        const event = await tx.calendarEvent.create({
          data: {
            workspaceId,
            organizerId,
            title: input.title,
            description: input.description ?? null,
            location: input.location ?? null,
            startAt: toDate(input.startAt),
            endAt: toDate(input.endAt),
          },
          select: { id: true },
        });
        calendarEventId = event.id;
      }

      const created = await tx.meeting.create({
        data: {
          workspaceId,
          organizerId,
          projectId: input.projectId ?? null,
          calendarEventId,
          title: input.title,
          description: input.description ?? null,
          agenda: input.agenda ?? null,
          location: input.location ?? null,
          startAt: toDate(input.startAt),
          endAt: toDate(input.endAt),
          participants: {
            create: [
              {
                userId: organizerId,
                role: MeetingParticipantRole.ORGANIZER,
                rsvp: MeetingRsvp.ACCEPTED,
              },
              ...participantIds.map((userId) => ({
                userId,
                role: MeetingParticipantRole.ATTENDEE,
              })),
            ],
          },
        },
        select: { id: true },
      });
      return created;
    });

    this.events.emit(AppEvent.MeetingScheduled, {
      workspaceId,
      actorId: organizerId,
      meetingId: meeting.id,
      title: input.title,
      startAt: new Date(input.startAt).toISOString(),
      projectId: input.projectId ?? null,
      participantIds,
    });

    return this.get(workspaceId, meeting.id);
  }

  async update(
    workspaceId: string,
    meetingId: string,
    actorId: string,
    input: UpdateMeetingInput,
  ) {
    const current = await this.assertMeeting(workspaceId, meetingId);
    if (input.projectId) {
      await this.assertProject(workspaceId, input.projectId);
    }

    const scheduleChanged =
      (input.startAt !== undefined &&
        toDate(input.startAt).getTime() !== current.startAt.getTime()) ||
      (input.endAt !== undefined &&
        toDate(input.endAt).getTime() !== current.endAt.getTime());

    await this.prisma.$transaction(async (tx) => {
      await tx.meeting.update({
        where: { id: meetingId },
        data: {
          title: input.title,
          description: input.description,
          agenda: input.agenda,
          location: input.location,
          startAt: input.startAt ? toDate(input.startAt) : undefined,
          endAt: input.endAt ? toDate(input.endAt) : undefined,
          projectId: input.projectId,
        },
      });

      if (current.calendarEventId) {
        await tx.calendarEvent.update({
          where: { id: current.calendarEventId },
          data: {
            title: input.title,
            description: input.description,
            location: input.location,
            startAt: input.startAt ? toDate(input.startAt) : undefined,
            endAt: input.endAt ? toDate(input.endAt) : undefined,
          },
        });
      }
    });

    const participantIds =
      await this.participantIdsExcludingOrganizer(meetingId);
    this.events.emit(AppEvent.MeetingUpdated, {
      workspaceId,
      actorId,
      meetingId,
      title: input.title ?? current.title,
      startAt: (input.startAt
        ? toDate(input.startAt)
        : current.startAt
      ).toISOString(),
      projectId: input.projectId ?? current.projectId,
      participantIds,
      addedParticipantIds: [],
      scheduleChanged,
    });

    return this.get(workspaceId, meetingId);
  }

  async cancel(workspaceId: string, meetingId: string, actorId: string) {
    const current = await this.assertMeeting(workspaceId, meetingId);
    if (current.status !== MeetingStatus.CANCELLED) {
      await this.prisma.meeting.update({
        where: { id: meetingId },
        data: { status: MeetingStatus.CANCELLED },
      });

      const participantIds =
        await this.participantIdsExcludingOrganizer(meetingId);
      this.events.emit(AppEvent.MeetingCancelled, {
        workspaceId,
        actorId,
        meetingId,
        title: current.title,
        startAt: current.startAt.toISOString(),
        projectId: current.projectId,
        participantIds,
      });
    }
    return this.get(workspaceId, meetingId);
  }

  async end(workspaceId: string, meetingId: string, actorId: string) {
    const current = await this.assertMeeting(workspaceId, meetingId);
    if (
      current.status !== MeetingStatus.ENDED &&
      current.status !== MeetingStatus.CANCELLED
    ) {
      await this.prisma.meeting.update({
        where: { id: meetingId },
        data: { status: MeetingStatus.ENDED, endedAt: new Date() },
      });

      const [participantIds, actionItemCount] = await Promise.all([
        this.participantIdsExcludingOrganizer(meetingId),
        this.prisma.task.count({ where: { meetingId, deletedAt: null } }),
      ]);
      this.events.emit(AppEvent.MeetingEnded, {
        workspaceId,
        actorId,
        meetingId,
        title: current.title,
        startAt: current.startAt.toISOString(),
        projectId: current.projectId,
        participantIds,
        actionItemCount,
      });
    }
    return this.get(workspaceId, meetingId);
  }

  async remove(workspaceId: string, meetingId: string): Promise<void> {
    await this.assertMeeting(workspaceId, meetingId);
    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { deletedAt: new Date() },
    });
  }

  async restore(workspaceId: string, meetingId: string) {
    const { count } = await this.prisma.meeting.updateMany({
      where: { id: meetingId, workspaceId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (count === 0) throw new NotFoundException('Meeting not found');
    return this.get(workspaceId, meetingId);
  }

  async listDeleted(workspaceId: string) {
    return this.prisma.meeting.findMany({
      where: { workspaceId, deletedAt: { not: null } },
      include: MEETING_LIST_INCLUDE,
      orderBy: { deletedAt: 'desc' },
    });
  }

  // --- participants -------------------------------------------------------

  async addParticipants(
    workspaceId: string,
    meetingId: string,
    actorId: string,
    userIds: string[],
  ) {
    const meeting = await this.assertMeeting(workspaceId, meetingId);

    const requested = await this.resolveParticipantIds(
      workspaceId,
      userIds,
      meeting.organizerId,
    );
    const existing = new Set(
      (
        await this.prisma.meetingParticipant.findMany({
          where: { meetingId },
          select: { userId: true },
        })
      ).map((p) => p.userId),
    );
    const added = requested.filter((id) => !existing.has(id));

    if (added.length > 0) {
      await this.prisma.meetingParticipant.createMany({
        data: added.map((userId) => ({
          meetingId,
          userId,
          role: MeetingParticipantRole.ATTENDEE,
        })),
        skipDuplicates: true,
      });

      this.events.emit(AppEvent.MeetingUpdated, {
        workspaceId,
        actorId,
        meetingId,
        title: meeting.title,
        startAt: meeting.startAt.toISOString(),
        projectId: meeting.projectId,
        participantIds: await this.participantIdsExcludingOrganizer(meetingId),
        addedParticipantIds: added,
        scheduleChanged: false,
      });
    }

    return this.get(workspaceId, meetingId);
  }

  async removeParticipant(
    workspaceId: string,
    meetingId: string,
    userId: string,
  ) {
    const meeting = await this.assertMeeting(workspaceId, meetingId);
    if (userId === meeting.organizerId) {
      throw new BadRequestException('The organizer cannot be removed');
    }
    await this.prisma.meetingParticipant.deleteMany({
      where: { meetingId, userId },
    });
    return this.get(workspaceId, meetingId);
  }

  async respond(
    workspaceId: string,
    meetingId: string,
    userId: string,
    rsvp: MeetingRsvp,
  ) {
    await this.assertMeeting(workspaceId, meetingId);
    const { count } = await this.prisma.meetingParticipant.updateMany({
      where: { meetingId, userId },
      data: { rsvp },
    });
    if (count === 0) {
      throw new NotFoundException('You are not on this meeting');
    }
    return this.get(workspaceId, meetingId);
  }

  // --- notes & decisions ------------------------------------------------

  async addNote(
    workspaceId: string,
    meetingId: string,
    authorId: string,
    input: CreateMeetingNoteInput,
  ) {
    await this.assertMeeting(workspaceId, meetingId);
    return this.prisma.meetingNote.create({
      data: { meetingId, authorId, body: input.body },
      include: { author: { select: PUBLIC_USER_SELECT } },
    });
  }

  async deleteNote(
    workspaceId: string,
    meetingId: string,
    noteId: string,
  ): Promise<void> {
    await this.assertMeeting(workspaceId, meetingId);
    const { count } = await this.prisma.meetingNote.deleteMany({
      where: { id: noteId, meetingId },
    });
    if (count === 0) throw new NotFoundException('Note not found');
  }

  async addDecision(
    workspaceId: string,
    meetingId: string,
    authorId: string,
    input: CreateMeetingDecisionInput,
  ) {
    await this.assertMeeting(workspaceId, meetingId);
    return this.prisma.meetingDecision.create({
      data: { meetingId, authorId, text: input.text },
      include: { author: { select: PUBLIC_USER_SELECT } },
    });
  }

  async deleteDecision(
    workspaceId: string,
    meetingId: string,
    decisionId: string,
  ): Promise<void> {
    await this.assertMeeting(workspaceId, meetingId);
    const { count } = await this.prisma.meetingDecision.deleteMany({
      where: { id: decisionId, meetingId },
    });
    if (count === 0) throw new NotFoundException('Decision not found');
  }

  // --- action items (real tasks) --------------------------------------

  async listActionItems(workspaceId: string, meetingId: string) {
    await this.assertMeeting(workspaceId, meetingId);
    return this.prisma.task.findMany({
      where: { meetingId, workspaceId, deletedAt: null },
      include: {
        assignee: { select: PUBLIC_USER_SELECT },
        project: { select: PROJECT_REF_SELECT },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addActionItem(
    workspaceId: string,
    meetingId: string,
    actorId: string,
    input: CreateMeetingActionItemInput,
  ) {
    const meeting = await this.assertMeeting(workspaceId, meetingId);
    // Routed through WorkToolsService so the task gets the same FK validation,
    // ticket identifier, activity row and `task.created` fan-out as any other.
    return this.workTools.createTask(
      workspaceId,
      {
        title: input.title,
        description: input.description ?? undefined,
        assigneeId: input.assigneeId ?? undefined,
        assigneeIds: input.assigneeId ? [input.assigneeId] : undefined,
        dueDate: input.dueDate ?? undefined,
        priority: input.priority,
        projectId: meeting.projectId ?? undefined,
        meetingId,
      },
      actorId,
    );
  }

  // --- helpers -----------------------------------------------------------

  private async assertMeeting(workspaceId: string, meetingId: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, workspaceId, deletedAt: null },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }

  private async assertProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }

  private async assertWorkspaceUser(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!member) {
      throw new NotFoundException('User is not a member of this workspace');
    }
  }

  /** De-dupes, drops the organizer, and confirms each id is a workspace member. */
  private async resolveParticipantIds(
    workspaceId: string,
    userIds: readonly string[],
    organizerId: string,
  ): Promise<string[]> {
    const ids = [...new Set(userIds)].filter((id) => id && id !== organizerId);
    for (const id of ids) {
      await this.assertWorkspaceUser(workspaceId, id);
    }
    return ids;
  }

  private async participantIdsExcludingOrganizer(
    meetingId: string,
  ): Promise<string[]> {
    const rows = await this.prisma.meetingParticipant.findMany({
      where: { meetingId, role: { not: MeetingParticipantRole.ORGANIZER } },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }
}
