/**
 * Domain enums.
 *
 * These mirror the Prisma enums but are declared independently: the API layer
 * maps persistence models onto these DTO contracts, so the browser never has
 * to depend on anything under `scope:api`.
 */

export const WorkspaceRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  GUEST: 'GUEST',
} as const;
export type WorkspaceRole = (typeof WorkspaceRole)[keyof typeof WorkspaceRole];

export const ChannelRole = {
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const;
export type ChannelRole = (typeof ChannelRole)[keyof typeof ChannelRole];

export const ChannelVisibility = {
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
} as const;
export type ChannelVisibility =
  (typeof ChannelVisibility)[keyof typeof ChannelVisibility];

export const InvitationStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
} as const;
export type InvitationStatus =
  (typeof InvitationStatus)[keyof typeof InvitationStatus];

export const PresenceStatus = {
  ONLINE: 'ONLINE',
  AWAY: 'AWAY',
  BUSY: 'BUSY',
  OFFLINE: 'OFFLINE',
} as const;
export type PresenceStatus =
  (typeof PresenceStatus)[keyof typeof PresenceStatus];

export const SystemRole = {
  USER: 'USER',
  SUPPORT: 'SUPPORT',
  SUPERADMIN: 'SUPERADMIN',
} as const;
export type SystemRole = (typeof SystemRole)[keyof typeof SystemRole];

export const TaskStatus = {
  BACKLOG: 'BACKLOG',
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  IN_REVIEW: 'IN_REVIEW',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export const ProjectStatus = {
  PLANNING: 'PLANNING',
  ACTIVE: 'ACTIVE',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const DocumentKind = {
  NOTE: 'NOTE',
  DOC: 'DOC',
  WIKI: 'WIKI',
} as const;
export type DocumentKind = (typeof DocumentKind)[keyof typeof DocumentKind];

/** The Kanban board's columns, in the order they are drawn. */
export const TASK_STATUS_ORDER: readonly TaskStatus[] = [
  TaskStatus.BACKLOG,
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
  TaskStatus.DONE,
  TaskStatus.CANCELLED,
];

/**
 * Workspace roles from least to most privileged. Comparing indices is how
 * permission checks decide "at least ADMIN" on both the client and server.
 */
export const WORKSPACE_ROLE_ORDER: readonly WorkspaceRole[] = [
  WorkspaceRole.GUEST,
  WorkspaceRole.MEMBER,
  WorkspaceRole.ADMIN,
  WorkspaceRole.OWNER,
];

/** True when `role` is at least as privileged as `minimum`. */
export function hasWorkspaceRole(
  role: WorkspaceRole,
  minimum: WorkspaceRole,
): boolean {
  return (
    WORKSPACE_ROLE_ORDER.indexOf(role) >=
    WORKSPACE_ROLE_ORDER.indexOf(minimum)
  );
}
