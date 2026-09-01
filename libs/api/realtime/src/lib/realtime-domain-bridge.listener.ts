import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppEvent } from '@org/api-common';
import type { UserPresence } from '@org/types';
import { RealtimeGatewayService } from './realtime-gateway.service.js';

@Injectable()
export class RealtimeDomainBridgeListener {
  constructor(private readonly gateway: RealtimeGatewayService) {}

  @OnEvent(AppEvent.PresenceUpdated)
  async onPresenceUpdated(e: {
    workspaceId?: string | null;
    actorId: string;
    presence: UserPresence;
    targetWorkspaces?: string[];
  }): Promise<void> {
    await this.gateway.broadcastPresence(e.presence, e.targetWorkspaces);
  }

  @OnEvent(AppEvent.TaskCreated)
  async onTaskCreated(e: {
    workspaceId: string;
    actorId: string | null;
    taskId: string;
    title: string;
    identifier: string | null;
    projectId: string | null;
    assigneeId: string | null;
    assigneeIds: string[];
  }): Promise<void> {
    await this.gateway.broadcastToWorkspace(e.workspaceId, {
      type: 'task.created',
      actorId: e.actorId,
      payload: e,
    });
  }

  @OnEvent(AppEvent.TaskUpdated)
  async onTaskUpdated(e: {
    workspaceId: string;
    actorId: string | null;
    taskId: string;
    changes?: Record<string, unknown>;
  }): Promise<void> {
    await this.gateway.broadcastToWorkspace(e.workspaceId, {
      type: 'task.updated',
      actorId: e.actorId,
      payload: e,
    });
  }

  @OnEvent(AppEvent.TaskDeleted)
  async onTaskDeleted(e: {
    workspaceId: string;
    actorId: string | null;
    taskId: string;
    projectId?: string | null;
  }): Promise<void> {
    await this.gateway.broadcastToWorkspace(e.workspaceId, {
      type: 'task.deleted',
      actorId: e.actorId,
      payload: e,
    });
  }

  @OnEvent(AppEvent.TaskAssigned)
  async onTaskAssigned(e: {
    workspaceId: string;
    actorId: string | null;
    taskId: string;
    title: string;
    assigneeIds: string[];
    addedAssigneeIds: string[];
  }): Promise<void> {
    await this.gateway.broadcastToWorkspace(e.workspaceId, {
      type: 'task.assigned',
      actorId: e.actorId,
      payload: e,
    });
  }

  @OnEvent(AppEvent.TaskCompleted)
  async onTaskCompleted(e: {
    workspaceId: string;
    actorId: string | null;
    taskId: string;
    title: string;
  }): Promise<void> {
    await this.gateway.broadcastToWorkspace(e.workspaceId, {
      type: 'task.updated',
      actorId: e.actorId,
      payload: { ...e, status: 'DONE' },
    });
  }

  @OnEvent(AppEvent.TaskMoved)
  async onTaskMoved(e: {
    workspaceId: string;
    actorId: string | null;
    taskId: string;
    toStatus: string;
    newOrder?: number;
  }): Promise<void> {
    await this.gateway.broadcastToWorkspace(e.workspaceId, {
      type: 'kanban.updated',
      actorId: e.actorId,
      payload: e,
    });
  }

  @OnEvent(AppEvent.TaskCommentCreated)
  async onTaskCommentCreated(e: {
    workspaceId: string;
    actorId: string | null;
    taskId: string;
    commentId: string;
    body: string;
  }): Promise<void> {
    await this.gateway.broadcastToWorkspace(e.workspaceId, {
      type: 'comment.created',
      actorId: e.actorId,
      payload: e,
    });
  }

  @OnEvent(AppEvent.ProjectCreated)
  async onProjectCreated(e: {
    workspaceId: string;
    actorId: string | null;
    projectId: string;
    name: string;
  }): Promise<void> {
    await this.gateway.broadcastToWorkspace(e.workspaceId, {
      type: 'project.updated',
      actorId: e.actorId,
      payload: e,
    });
  }

  @OnEvent(AppEvent.ProjectUpdated)
  async onProjectUpdated(e: {
    workspaceId: string;
    actorId: string | null;
    projectId: string;
    changes?: Record<string, unknown>;
  }): Promise<void> {
    await this.gateway.broadcastToWorkspace(e.workspaceId, {
      type: 'project.updated',
      actorId: e.actorId,
      payload: e,
    });
  }

  @OnEvent(AppEvent.ChannelCreated)
  async onChannelCreated(e: {
    workspaceId: string;
    actorId: string | null;
    channelId: string;
    name: string;
    slug: string;
    visibility: string;
  }): Promise<void> {
    await this.gateway.broadcastToWorkspace(e.workspaceId, {
      type: 'channel.created',
      actorId: e.actorId,
      payload: e,
    });
  }

  @OnEvent(AppEvent.ChannelUpdated)
  async onChannelUpdated(e: {
    workspaceId: string;
    actorId: string | null;
    channelId: string;
    changes?: Record<string, unknown>;
  }): Promise<void> {
    await this.gateway.broadcastToWorkspace(e.workspaceId, {
      type: 'channel.updated',
      actorId: e.actorId,
      payload: e,
    });
  }

  @OnEvent(AppEvent.ChannelDeleted)
  async onChannelDeleted(e: {
    workspaceId: string;
    actorId: string | null;
    channelId: string;
  }): Promise<void> {
    await this.gateway.broadcastToWorkspace(e.workspaceId, {
      type: 'channel.deleted',
      actorId: e.actorId,
      payload: e,
    });
  }

  @OnEvent(AppEvent.WorkspaceInvited)
  async onWorkspaceInvited(e: {
    workspaceId: string;
    actorId: string | null;
    emails: string[];
    role: string;
  }): Promise<void> {
    await this.gateway.broadcastToWorkspace(e.workspaceId, {
      type: 'invitation.created',
      actorId: e.actorId,
      payload: e,
    });
  }

  @OnEvent(AppEvent.MemberJoined)
  async onMemberJoined(e: {
    workspaceId: string;
    actorId: string | null;
    userId: string;
  }): Promise<void> {
    await this.gateway.broadcastToWorkspace(e.workspaceId, {
      type: 'workspace.member.updated',
      actorId: e.actorId,
      payload: e,
    });
  }

  @OnEvent(AppEvent.WorkspaceMemberUpdated)
  async onWorkspaceMemberUpdated(e: {
    workspaceId: string;
    actorId: string | null;
    userId: string;
    role?: string;
    status?: string;
  }): Promise<void> {
    await this.gateway.broadcastToWorkspace(e.workspaceId, {
      type: 'workspace.member.updated',
      actorId: e.actorId,
      payload: e,
    });
  }

  @OnEvent(AppEvent.NotificationCreated)
  async onNotificationCreated(e: {
    recipientId: string;
    workspaceId: string;
    notification: unknown;
    unreadCount?: number;
  }): Promise<void> {
    this.gateway.broadcastToUser(e.recipientId, {
      type: 'notification.created',
      workspaceId: e.workspaceId,
      payload: e,
    });
  }

  @OnEvent(AppEvent.MentionCreated)
  async onMentionCreated(e: {
    workspaceId: string;
    actorId: string | null;
    mentionedUserIds: string[];
    contextType: string;
    contextId: string;
    contextLabel: string;
    deepLink: string;
  }): Promise<void> {
    for (const recipientId of e.mentionedUserIds) {
      this.gateway.broadcastToUser(recipientId, {
        type: 'mention.created',
        workspaceId: e.workspaceId,
        payload: e,
      });
    }
  }
}
