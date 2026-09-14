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
  /**
   * A user joined or left a channel through our own API. Consumed by the
   * Matrix bridge to mirror the change into the channel's room immediately,
   * rather than waiting for the membership reconciler's next pass.
   */
  ChannelMembershipChanged: 'channel.membership.changed',
  /**
   * A temporary channel membership lapsed and was swept (brief §8). Consumed
   * by the notifications listener to tell the user their access ended; the
   * sweep also emits `ChannelMembershipChanged` (leave) so the Matrix bridge
   * removes them from the room.
   */
  ChannelAccessExpired: 'channel.access.expired',
  /**
   * A user joined or left a workspace, or had their workspace role changed,
   * through our own API. Consumed by the Matrix bridge to mirror the change
   * (and the derived space power level) into the workspace's space room.
   */
  WorkspaceMembershipChanged: 'workspace.membership.changed',
  FileShared: 'file.shared',
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
   * A user's status text / emoji / presence was changed by the server — the
   * scheduled-status applier or its expiry sweep (brief §9), not the user. The
   * realtime bridge fans it out to the user's workspaces so rosters refresh.
   */
  UserStatusChanged: 'user.status.changed',
  /** A huddle started / a participant joined or left / it ended (brief §6). */
  HuddleUpdated: 'huddle.updated',
  /**
   * Someone was @named in free text — a channel message (via the Matrix
   * bridge), a task comment, a document. Carries only resolved user ids and a
   * deep link, never the text.
   */
  MentionCreated: 'mention.created',
  /**
   * A channel's archived state flipped through our own API. Consumed by
   * `SystemEventsListener` (unified activity feed, brief §2) to post the
   * `channel_archived`/`channel_unarchived` timeline event.
   */
  ChannelArchiveChanged: 'channel.archive.changed',
  /**
   * An AI Agent or AI Coworker was linked/unlinked to a channel, or an
   * existing link's `isEnabled` flipped, through `ChannelAgentsController` /
   * `ChannelCoworkersController`. One event pair covers both entity kinds —
   * `entityType` disambiguates — matching how both live in one `AIAgent`
   * table (brief §5).
   */
  ChannelAiEntityLinked: 'channel.ai_entity.linked',
  ChannelAiEntityUnlinked: 'channel.ai_entity.unlinked',
  ChannelAiEntityEnabledChanged: 'channel.ai_entity.enabled_changed',
  /**
   * An app/integration was linked/unlinked to a channel, or an existing
   * link's `isEnabled` flipped (brief §4). Consumed the same way as the AI
   * entity events above.
   */
  ChannelAppLinked: 'channel.app.linked',
  ChannelAppUnlinked: 'channel.app.unlinked',
  ChannelAppEnabledChanged: 'channel.app.enabled_changed',
  /**
   * An `ExternalIntegration` finished OAuth (or was disconnected) — workspace
   * or personal scope, independent of any one channel. Posted into the app's
   * own 1:1 room when one already exists; otherwise there is nothing to post
   * into and the event is a no-op for the timeline (still useful for
   * notifications/activity).
   */
  IntegrationConnected: 'integration.connected',
  IntegrationDisconnected: 'integration.disconnected',
  /**
   * A settings/preference write landed — workspace policy, workspace or
   * member appearance, a user's chat/notification preferences, sidebar,
   * navigation, or a channel's settings. `category` disambiguates for the
   * realtime invalidation map (`@org/sync`); `scope` decides whether the
   * bridge fans it to the whole workspace or just the acting user. One event
   * covers every settings surface rather than one per category.
   */
  SettingsUpdated: 'settings.updated',
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

export interface ChannelUpdatedEvent extends BaseEvent {
  channelId: string;
  /** The channel's current name/slug — always populated for UI refresh,
   * regardless of whether this particular update changed them. */
  name?: string;
  slug?: string;
  /** True only when this update actually renamed the channel — the unified
   * System/Activity Event listener uses this (not the presence of `name`,
   * which is always set) to decide whether to post `channel_renamed`. */
  nameChanged?: boolean;
  /**
   * Present when this update changed the channel's posting policy — the Matrix
   * bridge reconciles the room's power levels off it (brief §3).
   */
  posting?: {
    mode: 'STANDARD' | 'ANNOUNCEMENT';
    allowReactions: boolean;
    allowReplies: boolean;
    allowFileUploads: boolean;
  };
}

export interface ChannelMembershipChangedEvent extends BaseEvent {
  channelId: string;
  /** The user who joined or left. */
  userId: string;
  action: 'join' | 'leave';
  /** Channel role after the change; null on leave. */
  role: 'ADMIN' | 'MEMBER' | null;
}

export interface ChannelAccessExpiredEvent extends BaseEvent {
  channelId: string;
  channelName: string;
  channelSlug: string;
  /** The user whose temporary access ended. */
  userId: string;
}

export interface UserStatusChangedEvent extends BaseEvent {
  /** The user whose status changed. */
  userId: string;
  /** The user's active workspace ids — where rosters need refreshing. */
  workspaceIds: string[];
  statusText: string | null;
  statusEmoji: string | null;
  presence: string | null;
  /** What drove the change. */
  source: 'schedule' | 'schedule-cleared' | 'expiry';
}

export interface HuddleUpdatedEvent extends BaseEvent {
  huddleId: string;
  matrixRoomId: string;
  channelId: string | null;
  action: 'started' | 'joined' | 'left' | 'ended';
}

export interface WorkspaceMembershipChangedEvent extends BaseEvent {
  /** The user who joined, left, or was re-roled. */
  userId: string;
  action: 'join' | 'leave' | 'role';
  /** Workspace role after the change; null on leave. */
  role: string | null;
}

export interface FileSharedEvent extends BaseEvent {
  uploadId: string;
  filename: string;
  /** Upload context type, e.g. `CHANNEL`, `PROJECT`, `DOCUMENT`. */
  contextType: string;
  contextId: string | null;
  /** Channel the file was filed in, when applicable — feeds the channel feed. */
  channelId: string | null;
  /** True when this is a replacement version rather than a first upload. */
  isNewVersion: boolean;
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

export interface ChannelArchiveChangedEvent extends BaseEvent {
  channelId: string;
  channelName: string;
  channelSlug: string;
  archived: boolean;
}

export type ChannelAiEntityType = 'agent' | 'coworker';

export interface ChannelAiEntityLinkedEvent extends BaseEvent {
  channelId: string;
  entityId: string;
  entityType: ChannelAiEntityType;
}

export type ChannelAiEntityUnlinkedEvent = ChannelAiEntityLinkedEvent;

export interface ChannelAiEntityEnabledChangedEvent extends BaseEvent {
  channelId: string;
  entityId: string;
  entityType: ChannelAiEntityType;
  isEnabled: boolean;
}

export interface ChannelAppLinkedEvent extends BaseEvent {
  channelId: string;
  integrationId: string;
}

export type ChannelAppUnlinkedEvent = ChannelAppLinkedEvent;

export interface ChannelAppEnabledChangedEvent extends BaseEvent {
  channelId: string;
  integrationId: string;
  isEnabled: boolean;
}

export interface IntegrationConnectedEvent {
  /** Null for a personal (user-scoped, not workspace-scoped) integration. */
  workspaceId: string | null;
  actorId: string | null;
  integrationId: string;
}

export type IntegrationDisconnectedEvent = IntegrationConnectedEvent;

/**
 * `scope: 'workspace'` fans out to every connected member of `workspaceId`
 * (a policy, workspace appearance default, or channel-settings change);
 * `scope: 'user'` reaches only `userId`'s own connections across whichever
 * workspaces they have open (a personal preference, theme override, sidebar
 * or navigation change). `data` is the settings category's own shape —
 * intentionally untyped here so this one event never needs a payload change
 * when a settings category's fields evolve.
 */
export interface SettingsUpdatedEvent {
  scope: 'workspace' | 'user';
  workspaceId: string | null;
  userId: string | null;
  actorId: string | null;
  category:
    | 'policies'
    | 'appearance'
    | 'chat'
    | 'notifications'
    | 'sidebar'
    | 'navigation'
    | 'channel';
  data?: Record<string, unknown>;
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
  [AppEvent.ChannelUpdated]: ChannelUpdatedEvent;
  [AppEvent.ChannelMembershipChanged]: ChannelMembershipChangedEvent;
  [AppEvent.ChannelAccessExpired]: ChannelAccessExpiredEvent;
  [AppEvent.UserStatusChanged]: UserStatusChangedEvent;
  [AppEvent.HuddleUpdated]: HuddleUpdatedEvent;
  [AppEvent.WorkspaceMembershipChanged]: WorkspaceMembershipChangedEvent;
  [AppEvent.FileShared]: FileSharedEvent;
  [AppEvent.WorkspaceInvited]: WorkspaceInvitedEvent;
  [AppEvent.MemberJoined]: MemberJoinedEvent;
  [AppEvent.MentionCreated]: MentionCreatedEvent;
  [AppEvent.MeetingScheduled]: MeetingScheduledEvent;
  [AppEvent.MeetingUpdated]: MeetingUpdatedEvent;
  [AppEvent.MeetingCancelled]: MeetingCancelledEvent;
  [AppEvent.MeetingEnded]: MeetingEndedEvent;
  [AppEvent.ChannelArchiveChanged]: ChannelArchiveChangedEvent;
  [AppEvent.ChannelAiEntityLinked]: ChannelAiEntityLinkedEvent;
  [AppEvent.ChannelAiEntityUnlinked]: ChannelAiEntityUnlinkedEvent;
  [AppEvent.ChannelAiEntityEnabledChanged]: ChannelAiEntityEnabledChangedEvent;
  [AppEvent.ChannelAppLinked]: ChannelAppLinkedEvent;
  [AppEvent.ChannelAppUnlinked]: ChannelAppUnlinkedEvent;
  [AppEvent.ChannelAppEnabledChanged]: ChannelAppEnabledChangedEvent;
  [AppEvent.IntegrationConnected]: IntegrationConnectedEvent;
  [AppEvent.IntegrationDisconnected]: IntegrationDisconnectedEvent;
  [AppEvent.SettingsUpdated]: SettingsUpdatedEvent;
}
