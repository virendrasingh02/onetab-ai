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
  TaskAssigned: 'task.assigned',
  TaskCompleted: 'task.completed',
  ProjectCreated: 'project.created',
  DocumentCreated: 'document.created',
  ChannelCreated: 'channel.created',
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
  assigneeId: string | null;
}

export interface TaskAssignedEvent extends BaseEvent {
  taskId: string;
  title: string;
  identifier: string | null;
  assigneeId: string | null;
  previousAssigneeId: string | null;
}

export interface TaskCompletedEvent extends BaseEvent {
  taskId: string;
  title: string;
  identifier: string | null;
  assigneeId: string | null;
}

export interface ProjectCreatedEvent extends BaseEvent {
  projectId: string;
  name: string;
}

export interface DocumentCreatedEvent extends BaseEvent {
  documentId: string;
  title: string;
}

export interface ChannelCreatedEvent extends BaseEvent {
  channelId: string;
  name: string;
  slug: string;
  visibility: string;
}

export interface AppEventPayloads {
  [AppEvent.TaskCreated]: TaskCreatedEvent;
  [AppEvent.TaskAssigned]: TaskAssignedEvent;
  [AppEvent.TaskCompleted]: TaskCompletedEvent;
  [AppEvent.ProjectCreated]: ProjectCreatedEvent;
  [AppEvent.DocumentCreated]: DocumentCreatedEvent;
  [AppEvent.ChannelCreated]: ChannelCreatedEvent;
}
