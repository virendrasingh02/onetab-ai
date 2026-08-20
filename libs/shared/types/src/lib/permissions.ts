/**
 * Workspace permissions.
 *
 * The role hierarchy in `enums.ts` answers "is this role at least ADMIN?",
 * which is the wrong question to scatter through feature code: it hard-codes
 * today's ranking into every call site, so introducing a role that is not a
 * simple rung on that ladder means revisiting all of them.
 *
 * Permissions are the stable vocabulary instead. Features ask for the
 * capability they need — `manage_members` — and the grant table below is the
 * single place that decides which roles have it. A custom role becomes one new
 * row rather than an edit to every check.
 */

import { WorkspaceRole } from './enums.js';

export const WorkspacePermission = {
  VIEW: 'view',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  MANAGE_MEMBERS: 'manage_members',
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_BILLING: 'manage_billing',
} as const;
export type WorkspacePermission =
  (typeof WorkspacePermission)[keyof typeof WorkspacePermission];

export const WORKSPACE_PERMISSIONS: readonly WorkspacePermission[] =
  Object.values(WorkspacePermission);

/**
 * Which permissions each role holds.
 *
 * Grants are listed in full rather than derived from the hierarchy: a table
 * that spells out every cell can express a role that is not a superset of the
 * one below it, which is what custom roles will need. `GUEST` is this
 * schema's read-only role — the spec's "viewer".
 */
export const ROLE_PERMISSIONS: Readonly<
  Record<WorkspaceRole, readonly WorkspacePermission[]>
> = {
  [WorkspaceRole.OWNER]: WORKSPACE_PERMISSIONS,
  [WorkspaceRole.ADMIN]: [
    WorkspacePermission.VIEW,
    WorkspacePermission.CREATE,
    WorkspacePermission.UPDATE,
    WorkspacePermission.DELETE,
    WorkspacePermission.MANAGE_MEMBERS,
    WorkspacePermission.MANAGE_SETTINGS,
  ],
  [WorkspaceRole.MEMBER]: [
    WorkspacePermission.VIEW,
    WorkspacePermission.CREATE,
    WorkspacePermission.UPDATE,
  ],
  [WorkspaceRole.GUEST]: [WorkspacePermission.VIEW],
};

/**
 * True when `role` holds `permission`.
 *
 * Shared by the API guard and the browser, so a button's enabled state and the
 * server's answer are read from the same table and cannot drift apart. The
 * browser copy is presentation only — the server never trusts it.
 */
export function roleHasPermission(
  role: WorkspaceRole | undefined,
  permission: WorkspacePermission,
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** True when `role` holds every one of `permissions`. */
export function roleHasAllPermissions(
  role: WorkspaceRole | undefined,
  permissions: readonly WorkspacePermission[],
): boolean {
  return permissions.every((permission) =>
    roleHasPermission(role, permission),
  );
}

/** Every permission a role holds. For surfacing capabilities to the client. */
export function permissionsForRole(
  role: WorkspaceRole | undefined,
): readonly WorkspacePermission[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role] ?? [];
}
