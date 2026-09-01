import type { IsoDateString, PublicUser } from '@org/types';

export const RealtimeEventType = {
  // Presence & User
  PresenceUpdated: 'presence.updated',
  UserUpdated: 'user.updated',

  // Notifications
  NotificationCreated: 'notification.created',
  NotificationRead: 'notification.read',

  // Messaging & Channels
  MessageCreated: 'message.created',
  MessageUpdated: 'message.updated',
  MessageDeleted: 'message.deleted',
  ThreadCreated: 'thread.created',
  ThreadUpdated: 'thread.updated',
  CommentCreated: 'comment.created',
  CommentUpdated: 'comment.updated',
  MentionCreated: 'mention.created',
  ChannelCreated: 'channel.created',
  ChannelUpdated: 'channel.updated',
  ChannelDeleted: 'channel.deleted',

  // Workspaces & Members
  WorkspaceUpdated: 'workspace.updated',
  WorkspaceMemberUpdated: 'workspace.member.updated',
  InvitationCreated: 'invitation.created',
  InvitationUpdated: 'invitation.updated',

  // Projects, Tasks & Kanban
  ProjectUpdated: 'project.updated',
  TaskCreated: 'task.created',
  TaskUpdated: 'task.updated',
  TaskDeleted: 'task.deleted',
  TaskAssigned: 'task.assigned',
  KanbanUpdated: 'kanban.updated',

  // Settings & Preferences
  SettingsUpdated: 'settings.updated',
  Heartbeat: 'heartbeat',
} as const;

export type RealtimeEventType =
  (typeof RealtimeEventType)[keyof typeof RealtimeEventType];

export type RealtimeConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

export interface RealtimeEvent<T = unknown> {
  id: string;
  type: RealtimeEventType | string;
  timestamp: IsoDateString;
  workspaceId?: string | null;
  actorId?: string | null;
  payload: T;
}

// --- Payload interfaces -----------------------------------------------------

export interface PresenceUpdatedPayload {
  userId: string;
  workspaceId?: string | null;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeenAt?: IsoDateString | null;
  lastActiveAt?: IsoDateString | null;
  statusText?: string | null;
  statusEmoji?: string | null;
  user?: Partial<PublicUser> | null;
}

export interface UserUpdatedPayload {
  userId: string;
  user: Partial<PublicUser>;
}

export interface NotificationCreatedPayload {
  notification: {
    id: string;
    workspaceId: string;
    recipientId: string;
    actorId?: string | null;
    kind: string;
    title: string;
    body?: string | null;
    deepLink?: string | null;
    resourceType?: string | null;
    resourceId?: string | null;
    read: boolean;
    createdAt: IsoDateString;
    actor?: Partial<PublicUser> | null;
  };
  unreadCount?: number;
}

export interface NotificationReadPayload {
  workspaceId: string;
  notificationId?: string;
  allRead?: boolean;
  unreadCount: number;
}

export interface MessageCreatedPayload {
  messageId: string;
  channelId?: string;
  senderId: string;
  content: string;
  matrixEventId?: string | null;
  createdAt: IsoDateString;
}

export interface MessageUpdatedPayload {
  messageId: string;
  channelId?: string;
  content?: string;
  deleted?: boolean;
  updatedAt: IsoDateString;
}

export interface CommentCreatedPayload {
  commentId: string;
  taskId: string;
  workspaceId: string;
  authorId: string;
  body: string;
  createdAt: IsoDateString;
  author?: Partial<PublicUser> | null;
}

export interface CommentUpdatedPayload {
  commentId: string;
  taskId: string;
  workspaceId: string;
  body?: string;
  deleted?: boolean;
}

export interface MentionCreatedPayload {
  workspaceId: string;
  contextType: 'channel' | 'task' | 'document';
  contextId: string;
  contextLabel: string;
  deepLink: string;
  mentionedUserIds: string[];
}

export interface ChannelCreatedPayload {
  channelId: string;
  workspaceId: string;
  name: string;
  slug: string;
  visibility: string;
}

export interface ChannelUpdatedPayload {
  channelId: string;
  workspaceId: string;
  name?: string;
  slug?: string;
  topic?: string;
  archived?: boolean;
}

export interface ChannelDeletedPayload {
  channelId: string;
  workspaceId: string;
}

export interface WorkspaceUpdatedPayload {
  workspaceId: string;
  name?: string;
  slug?: string;
  avatarUrl?: string | null;
  icon?: string | null;
  iconColor?: string | null;
}

export interface WorkspaceMemberUpdatedPayload {
  workspaceId: string;
  userId: string;
  role?: string;
  status?: string;
  member?: unknown;
}

export interface InvitationCreatedPayload {
  invitationId: string;
  workspaceId: string;
  email: string;
  role: string;
}

export interface InvitationUpdatedPayload {
  invitationId: string;
  workspaceId: string;
  status: string;
}

export interface ProjectUpdatedPayload {
  projectId: string;
  workspaceId: string;
  name?: string;
  status?: string;
  leadId?: string | null;
  health?: string;
}

export interface TaskCreatedPayload {
  taskId: string;
  workspaceId: string;
  projectId?: string | null;
  identifier?: string | null;
  title: string;
  status: string;
  priority: string;
  assigneeIds: string[];
  dueDate?: IsoDateString | null;
  task?: unknown;
}

export interface TaskUpdatedPayload {
  taskId: string;
  workspaceId: string;
  projectId?: string | null;
  identifier?: string | null;
  title?: string;
  status?: string;
  priority?: string;
  assigneeIds?: string[];
  dueDate?: IsoDateString | null;
  kanbanOrder?: number;
  changes?: Record<string, unknown>;
}

export interface TaskDeletedPayload {
  taskId: string;
  workspaceId: string;
  projectId?: string | null;
}

export interface TaskAssignedPayload {
  taskId: string;
  workspaceId: string;
  assigneeIds: string[];
  addedAssigneeIds: string[];
  previousAssigneeId?: string | null;
}

export interface KanbanUpdatedPayload {
  workspaceId: string;
  projectId?: string | null;
  taskId: string;
  fromStatus?: string;
  toStatus: string;
  newOrder?: number;
}

export interface SettingsUpdatedPayload {
  workspaceId?: string;
  userId?: string;
  category: string;
  data: Record<string, unknown>;
}

export interface HeartbeatPayload {
  timestamp: IsoDateString;
  serverTime: number;
}
