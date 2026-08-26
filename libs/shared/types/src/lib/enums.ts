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

/**
 * Lifecycle of a workspace.
 *
 * `ARCHIVED` is the reversible half of the Danger Zone: the workspace and all
 * its data stay intact and readable, but nothing new can be written to it.
 * Deletion remains separate and irreversible.
 */
export const WorkspaceStatus = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;
export type WorkspaceStatus =
  (typeof WorkspaceStatus)[keyof typeof WorkspaceStatus];

/**
 * Lifecycle of one person's membership.
 *
 * Suspending revokes access without discarding the row, so the member's
 * history and role survive being let back in.
 */
export const MembershipStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;
export type MembershipStatus =
  (typeof MembershipStatus)[keyof typeof MembershipStatus];

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

export const IdentifierPrefixMode = {
  AUTO: 'AUTO',
  CUSTOM: 'CUSTOM',
  LOCKED: 'LOCKED',
} as const;
export type IdentifierPrefixMode =
  (typeof IdentifierPrefixMode)[keyof typeof IdentifierPrefixMode];

export const ProjectHealth = {
  HEALTHY: 'HEALTHY',
  AT_RISK: 'AT_RISK',
  OFF_TRACK: 'OFF_TRACK',
  COMPLETED: 'COMPLETED',
} as const;
export type ProjectHealth =
  (typeof ProjectHealth)[keyof typeof ProjectHealth];

export const WorkItemType = {
  TASK: 'TASK',
  BUG: 'BUG',
  FEATURE: 'FEATURE',
  IMPROVEMENT: 'IMPROVEMENT',
  REQUEST: 'REQUEST',
  SUPPORT: 'SUPPORT',
  INCIDENT: 'INCIDENT',
  STORY: 'STORY',
  CUSTOM: 'CUSTOM',
} as const;
export type WorkItemType = (typeof WorkItemType)[keyof typeof WorkItemType];

export const RelationType = {
  BLOCKS: 'BLOCKS',
  BLOCKED_BY: 'BLOCKED_BY',
  RELATED_TO: 'RELATED_TO',
  DUPLICATE_OF: 'DUPLICATE_OF',
  DUPLICATED_BY: 'DUPLICATED_BY',
  PARENT_OF: 'PARENT_OF',
  SUB_ITEM_OF: 'SUB_ITEM_OF',
} as const;
export type RelationType = (typeof RelationType)[keyof typeof RelationType];

export const CycleStatus = {
  DRAFT: 'DRAFT',
  UPCOMING: 'UPCOMING',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type CycleStatus = (typeof CycleStatus)[keyof typeof CycleStatus];

export const CustomFieldType = {
  TEXT: 'TEXT',
  NUMBER: 'NUMBER',
  CURRENCY: 'CURRENCY',
  DATE: 'DATE',
  DATETIME: 'DATETIME',
  BOOLEAN: 'BOOLEAN',
  SELECT: 'SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
  USER: 'USER',
  TEAM: 'TEAM',
  URL: 'URL',
  EMAIL: 'EMAIL',
  FORMULA: 'FORMULA',
} as const;
export type CustomFieldType =
  (typeof CustomFieldType)[keyof typeof CustomFieldType];

export const ViewType = {
  LIST: 'LIST',
  BOARD: 'BOARD',
  CALENDAR: 'CALENDAR',
  TIMELINE: 'TIMELINE',
  GANTT: 'GANTT',
  SPREADSHEET: 'SPREADSHEET',
} as const;
export type ViewType = (typeof ViewType)[keyof typeof ViewType];

export const IntakeStatus = {
  PENDING: 'PENDING',
  TRIAGED: 'TRIAGED',
  CONVERTED: 'CONVERTED',
  DECLINED: 'DECLINED',
} as const;
export type IntakeStatus = (typeof IntakeStatus)[keyof typeof IntakeStatus];

export const IntakeSource = {
  USER: 'USER',
  CUSTOMER: 'CUSTOMER',
  SUPPORT: 'SUPPORT',
  INTEGRATION: 'INTEGRATION',
  FORM: 'FORM',
  EMAIL: 'EMAIL',
  SLACK: 'SLACK',
  AI_AGENT: 'AI_AGENT',
} as const;
export type IntakeSource = (typeof IntakeSource)[keyof typeof IntakeSource];

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
