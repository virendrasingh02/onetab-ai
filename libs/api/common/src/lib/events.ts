/**
 * The platform's in-process domain event catalog.
 *
 * Producers (services that write) call `eventEmitter.emit(AppEvent.X, payload)`
 * after a successful commit; consumers (`@OnEvent(AppEvent.X)` in listener
 * classes) fan that out to notifications, the activity feed, search indexing and
 * analytics without the producer knowing they exist.
 *
 * This is deliberately in-process (`@nestjs/event-emitter`), not a queue: a
 * dropped event on crash is acceptable for feed/notification rows today. Work
 * that must survive a restart (imports, exports, agent runs) gets a durable
 * job row instead — see `IntegrationSyncJob` for the existing pattern.
 */
export const AppEvent = {
  TaskCreated: 'task.created',
  TaskUpdated: 'task.updated',
  TaskDeleted: 'task.deleted',
  TaskMoved: 'task.moved',
  TaskAssigned: 'task.assigned',
  TaskCompleted: 'task.completed',
  TaskCommentCreated: 'task.comment.created',
  ProjectCreated: 'project.created',
  ProjectUpdated: 'project.updated',
  DocumentCreated: 'document.created',
  DocumentUpdated: 'document.updated',
  DocumentDeleted: 'document.deleted',
  ChannelCreated: 'channel.created',
  ChannelUpdated: 'channel.updated',
  ChannelDeleted: 'channel.deleted',
  MeetingScheduled: 'meeting.scheduled',
  MeetingUpdated: 'meeting.updated',
  MeetingCancelled: 'meeting.cancelled',
  MeetingEnded: 'meeting.ended',
  WorkspaceInvited: 'workspace.invited',
  MemberJoined: 'member.joined',
  WorkspaceMemberUpdated: 'workspace.member.updated',
  NotificationCreated: 'notification.created',
  PresenceUpdated: 'presence.updated',
  /**
   * Someone was @named in free text — a channel message (via the Matrix
   * bridge), a task comment, a document. Carries only resolved user ids and a
   * deep link, never the text.
   */
  MentionCreated: 'mention.created',
} as const;

export type AppEventName = (typeof AppEvent)[keyof typeof AppEvent];

interface BaseEvent {
  workspaceId: string;
  /** Who caused it. Null for system-initiated actions. */
  actorId: string | null;
}

export interface TaskCreatedEvent extends BaseEvent {
  taskId: string;
  title: string;
  identifier: string | null;
  projectId: string | null;
  /** Primary assignee — `assigneeIds[0]`, kept for consumers that want one. */
  assigneeId: string | null;
  /** Every assignee, primary first. */
  assigneeIds: string[];
}

export interface TaskAssignedEvent extends BaseEvent {
  taskId: string;
  title: string;
  identifier: string | null;
  assigneeId: string | null;
  previousAssigneeId: string | null;
  /** The full assignee set after the change. */
  assigneeIds: string[];
  /** Only the assignees added by this change — who to notify. */
  addedAssigneeIds: string[];
}

export interface TaskCompletedEvent extends BaseEvent {
  taskId: string;
  title: string;
  identifier: string | null;
  assigneeId: string | null;
  assigneeIds: string[];
}

export interface ProjectCreatedEvent extends BaseEvent {
  projectId: string;
  name: string;
  /** The lead the project was created with, if any — notified they now own it. */
  leadId: string | null;
}

export interface WorkspaceInvitedEvent extends BaseEvent {
  /** Emails invited in this batch. */
  emails: string[];
  role: string;
}

export interface MemberJoinedEvent extends BaseEvent {
  /** The user who just joined (same identity as `actorId`, named explicitly). */
  userId: string;
  /** Channel they were also added to via a channel-scoped invite, if any. */
  channelId: string | null;
  /** Who invited them — notified that their invitation was accepted. */
  invitedById: string | null;
}

export type MentionContextType = 'channel' | 'task' | 'document';

export interface MentionCreatedEvent extends BaseEvent {
  /** Resolved, deduped platform user ids the text named. */
  mentionedUserIds: string[];
  contextType: MentionContextType;
  /** The row the mention lives on — used as the notification dedupe key. */
  contextId: string;
  /** Human label for the notification, e.g. `#general` or `PROJ-12 Fix login`. */
  contextLabel: string;
  /** Workspace-relative route the notification opens, e.g. `tasks/abc123`. */
  deepLink: string;
}

export interface DocumentCreatedEvent extends BaseEvent {
  documentId: string;
  title: string;
}

export interface DocumentUpdatedEvent extends BaseEvent {
  documentId: string;
  title: string;
  /** True when the body changed — the only case that needs a RAG re-index. */
  contentChanged: boolean;
}

export interface DocumentDeletedEvent extends BaseEvent {
  documentId: string;
}

export interface ChannelCreatedEvent extends BaseEvent {
  channelId: string;
  name: string;
  slug: string;
  visibility: string;
}

interface MeetingEventBase extends BaseEvent {
  meetingId: string;
  title: string;
  startAt: string;
  /** Project the meeting is attached to, if any. */
  projectId: string | null;
  /** Every invited participant, excluding the organizer. */
  participantIds: string[];
}

export type MeetingScheduledEvent = MeetingEventBase;

export interface MeetingUpdatedEvent extends MeetingEventBase {
  /** Participants added by this change — who gets a fresh invite notification. */
  addedParticipantIds: string[];
  /** True when the time window moved — the case worth telling everyone about. */
  scheduleChanged: boolean;
}

export type MeetingCancelledEvent = MeetingEventBase;

export interface MeetingEndedEvent extends MeetingEventBase {
  /** Action items (tasks) created from the meeting by the time it ended. */
  actionItemCount: number;
}

export interface AppEventPayloads {
  [AppEvent.TaskCreated]: TaskCreatedEvent;
  [AppEvent.TaskAssigned]: TaskAssignedEvent;
  [AppEvent.TaskCompleted]: TaskCompletedEvent;
  [AppEvent.ProjectCreated]: ProjectCreatedEvent;
  [AppEvent.DocumentCreated]: DocumentCreatedEvent;
  [AppEvent.DocumentUpdated]: DocumentUpdatedEvent;
  [AppEvent.DocumentDeleted]: DocumentDeletedEvent;
  [AppEvent.ChannelCreated]: ChannelCreatedEvent;
  [AppEvent.WorkspaceInvited]: WorkspaceInvitedEvent;
  [AppEvent.MemberJoined]: MemberJoinedEvent;
  [AppEvent.MentionCreated]: MentionCreatedEvent;
  [AppEvent.MeetingScheduled]: MeetingScheduledEvent;
  [AppEvent.MeetingUpdated]: MeetingUpdatedEvent;
  [AppEvent.MeetingCancelled]: MeetingCancelledEvent;
  [AppEvent.MeetingEnded]: MeetingEndedEvent;
}
