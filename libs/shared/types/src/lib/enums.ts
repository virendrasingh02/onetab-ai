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
