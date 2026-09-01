import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AppEvent,
  type ChannelCreatedEvent,
  type DocumentCreatedEvent,
  type MemberJoinedEvent,
  type MentionCreatedEvent,
  type ProjectCreatedEvent,
  type TaskAssignedEvent,
  type TaskCompletedEvent,
  type TaskCreatedEvent,
  type WorkspaceInvitedEvent,
} from '@org/api-common';
import { ActivityKind, NotificationKind, PrismaService } from '@org/database';
import { ActivityWriterService } from './activity-writer.service.js';
import { NotificationCenterService } from './notification-center.service.js';

/**
 * The single place domain events turn into notification and activity rows.
 *
 * Producers emit; this listens. Adding a trigger is a method here, never an
 * edit to the service that did the work. Handlers are `async` but their errors
 * are contained — a failed feed write must not fail the HTTP request that
 * emitted the event.
 */
@Injectable()
export class DomainEventsListener {
  private readonly logger = new Logger(DomainEventsListener.name);

  constructor(
    private readonly notifications: NotificationCenterService,
    private readonly activity: ActivityWriterService,
    private readonly prisma: PrismaService,
  ) {}

  private label(identifier: string | null, title: string): string {
    return identifier ? `${identifier} ${title}` : title;
  }

  /**
   * Notifies every assignee in `recipientIds` about one task — the multi-assignee
   * fan-out. `NotificationCenterService.create` already drops a self-notify and
   * de-dupes an unread row per (recipient, kind, task), so re-assigning the same
   * people is a no-op.
   */
  private async notifyTaskAssignees(
    e: {
      workspaceId: string;
      actorId: string | null;
      taskId: string;
      identifier: string | null;
      title: string;
    },
    recipientIds: readonly string[],
    kind: NotificationKind,
    title: (label: string) => string,
  ): Promise<void> {
    const label = this.label(e.identifier, e.title);
    for (const recipientId of new Set(recipientIds)) {
      if (recipientId === e.actorId) continue;
      await this.safeNotify(() =>
        this.notifications.create({
          workspaceId: e.workspaceId,
          recipientId,
          actorId: e.actorId,
          kind,
          title: title(label),
          deepLink: `tasks/${e.taskId}`,
          resourceType: 'task',
          resourceId: e.taskId,
        }),
      );
    }
  }

  @OnEvent(AppEvent.TaskCreated)
  async onTaskCreated(e: TaskCreatedEvent): Promise<void> {
    await this.activity.write({
      workspaceId: e.workspaceId,
      kind: ActivityKind.TASK_CREATED,
      actorId: e.actorId,
      resourceType: 'task',
      resourceId: e.taskId,
      summary: `created task ${this.label(e.identifier, e.title)}`,
      mentionedUserIds: e.assigneeIds,
    });

    await this.notifyTaskAssignees(
      e,
      e.assigneeIds,
      NotificationKind.TASK_ASSIGNED,
      (label) => `You were assigned ${label}`,
    );
  }

  @OnEvent(AppEvent.TaskAssigned)
  async onTaskAssigned(e: TaskAssignedEvent): Promise<void> {
    await this.activity.write({
      workspaceId: e.workspaceId,
      kind: ActivityKind.TASK_ASSIGNED,
      actorId: e.actorId,
      resourceType: 'task',
      resourceId: e.taskId,
      summary: `assigned ${this.label(e.identifier, e.title)}`,
      mentionedUserIds: e.assigneeIds,
    });

    // Only the people newly added by this change get a fresh notification.
    await this.notifyTaskAssignees(
      e,
      e.addedAssigneeIds,
      NotificationKind.TASK_ASSIGNED,
      (label) => `You were assigned ${label}`,
    );
  }

  @OnEvent(AppEvent.TaskCompleted)
  async onTaskCompleted(e: TaskCompletedEvent): Promise<void> {
    await this.activity.write({
      workspaceId: e.workspaceId,
      kind: ActivityKind.TASK_COMPLETED,
      actorId: e.actorId,
      resourceType: 'task',
      resourceId: e.taskId,
      summary: `completed ${this.label(e.identifier, e.title)}`,
    });

    await this.notifyTaskAssignees(
      e,
      e.assigneeIds,
      NotificationKind.TASK_COMPLETED,
      (label) => `${label} was marked done`,
    );
  }

  @OnEvent(AppEvent.ProjectCreated)
  async onProjectCreated(e: ProjectCreatedEvent): Promise<void> {
    await this.activity.write({
      workspaceId: e.workspaceId,
      kind: ActivityKind.PROJECT_CREATED,
      actorId: e.actorId,
      resourceType: 'project',
      resourceId: e.projectId,
      summary: `created project ${e.name}`,
      mentionedUserIds: e.leadId ? [e.leadId] : [],
    });

    if (e.leadId && e.leadId !== e.actorId) {
      await this.safeNotify(() =>
        this.notifications.create({
          workspaceId: e.workspaceId,
          recipientId: e.leadId as string,
          actorId: e.actorId,
          kind: NotificationKind.PROJECT_CREATED,
          title: `You were made lead of ${e.name}`,
          deepLink: `projects/${e.projectId}`,
          resourceType: 'project',
          resourceId: e.projectId,
        }),
      );
    }
  }

  @OnEvent(AppEvent.MentionCreated)
  async onMentionCreated(e: MentionCreatedEvent): Promise<void> {
    for (const recipientId of e.mentionedUserIds) {
      if (recipientId === e.actorId) continue;
      await this.safeNotify(() =>
        this.notifications.create({
          workspaceId: e.workspaceId,
          recipientId,
          actorId: e.actorId,
          kind: NotificationKind.MENTION,
          title: `You were mentioned in ${e.contextLabel}`,
          deepLink: e.deepLink,
          resourceType: e.contextType,
          resourceId: e.contextId,
        }),
      );
    }
  }

  @OnEvent(AppEvent.WorkspaceInvited)
  async onWorkspaceInvited(e: WorkspaceInvitedEvent): Promise<void> {
    if (e.emails.length === 0) return;

    // Only existing platform users can hold a notification row — an invite to a
    // brand-new email is delivered by the link itself. This still covers the
    // common "already has an account, just not in this workspace" case.
    const [users, workspace] = await Promise.all([
      this.prisma.user.findMany({
        where: { email: { in: e.emails, mode: 'insensitive' } },
        select: { id: true },
      }),
      this.prisma.workspace.findUnique({
        where: { id: e.workspaceId },
        select: { name: true },
      }),
    ]);
    if (!workspace) return;

    for (const user of users) {
      if (user.id === e.actorId) continue;
      await this.safeNotify(() =>
        this.notifications.create({
          workspaceId: e.workspaceId,
          recipientId: user.id,
          actorId: e.actorId,
          kind: NotificationKind.WORKSPACE_INVITE,
          title: `You were invited to join ${workspace.name}`,
          body: 'Open the invitation email or link to accept.',
          resourceType: 'workspace',
          resourceId: e.workspaceId,
        }),
      );
    }
  }

  @OnEvent(AppEvent.MemberJoined)
  async onMemberJoined(e: MemberJoinedEvent): Promise<void> {
    const joiner = await this.prisma.user.findUnique({
      where: { id: e.userId },
      select: { name: true, displayName: true },
    });
    const name = joiner?.displayName ?? joiner?.name ?? 'Someone';

    await this.activity.write({
      workspaceId: e.workspaceId,
      kind: ActivityKind.MEMBER_JOINED,
      actorId: e.userId,
      channelId: e.channelId,
      resourceType: 'member',
      resourceId: e.userId,
      summary: `${name} joined the workspace`,
    });

    if (e.invitedById && e.invitedById !== e.userId) {
      await this.safeNotify(() =>
        this.notifications.create({
          workspaceId: e.workspaceId,
          recipientId: e.invitedById as string,
          actorId: e.userId,
          kind: NotificationKind.SYSTEM,
          title: `${name} accepted your invitation`,
          deepLink: 'directory',
          resourceType: 'member',
          resourceId: e.userId,
        }),
      );
    }
  }

  @OnEvent(AppEvent.DocumentCreated)
  async onDocumentCreated(e: DocumentCreatedEvent): Promise<void> {
    await this.activity.write({
      workspaceId: e.workspaceId,
      kind: ActivityKind.DOCUMENT_CREATED,
      actorId: e.actorId,
      resourceType: 'document',
      resourceId: e.documentId,
      summary: `created document ${e.title}`,
    });
  }

  @OnEvent(AppEvent.ChannelCreated)
  async onChannelCreated(e: ChannelCreatedEvent): Promise<void> {
    await this.activity.write({
      workspaceId: e.workspaceId,
      kind: ActivityKind.CHANNEL_CREATED,
      actorId: e.actorId,
      channelId: e.channelId,
      resourceType: 'channel',
      resourceId: e.channelId,
      summary: `created #${e.slug}`,
    });
  }

  private async safeNotify(fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.warn(
        `Notification write failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
