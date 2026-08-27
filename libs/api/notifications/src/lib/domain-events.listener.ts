import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AppEvent,
  type ChannelCreatedEvent,
  type DocumentCreatedEvent,
  type ProjectCreatedEvent,
  type TaskAssignedEvent,
  type TaskCompletedEvent,
  type TaskCreatedEvent,
} from '@org/api-common';
import { ActivityKind, NotificationKind } from '@org/database';
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
  ) {}

  private label(identifier: string | null, title: string): string {
    return identifier ? `${identifier} ${title}` : title;
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
      mentionedUserIds: e.assigneeId ? [e.assigneeId] : [],
    });

    const assigneeId = e.assigneeId;
    if (assigneeId) {
      await this.safeNotify(() =>
        this.notifications.create({
          workspaceId: e.workspaceId,
          recipientId: assigneeId,
          actorId: e.actorId,
          kind: NotificationKind.TASK_ASSIGNED,
          title: `You were assigned ${this.label(e.identifier, e.title)}`,
          deepLink: `tasks/${e.taskId}`,
          resourceType: 'task',
          resourceId: e.taskId,
        }),
      );
    }
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
      mentionedUserIds: e.assigneeId ? [e.assigneeId] : [],
    });

    const assigneeId = e.assigneeId;
    if (assigneeId) {
      await this.safeNotify(() =>
        this.notifications.create({
          workspaceId: e.workspaceId,
          recipientId: assigneeId,
          actorId: e.actorId,
          kind: NotificationKind.TASK_ASSIGNED,
          title: `You were assigned ${this.label(e.identifier, e.title)}`,
          deepLink: `tasks/${e.taskId}`,
          resourceType: 'task',
          resourceId: e.taskId,
        }),
      );
    }
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

    const assigneeId = e.assigneeId;
    if (assigneeId && assigneeId !== e.actorId) {
      await this.safeNotify(() =>
        this.notifications.create({
          workspaceId: e.workspaceId,
          recipientId: assigneeId,
          actorId: e.actorId,
          kind: NotificationKind.TASK_COMPLETED,
          title: `${this.label(e.identifier, e.title)} was marked done`,
          deepLink: `tasks/${e.taskId}`,
          resourceType: 'task',
          resourceId: e.taskId,
        }),
      );
    }
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
    });
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
