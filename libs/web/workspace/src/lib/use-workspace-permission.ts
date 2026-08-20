import {
  WorkspacePermission,
  WorkspaceStatus,
  roleHasPermission,
  type WorkspaceRole,
} from '@org/types';
import { useCurrentWorkspace } from './use-workspaces.js';

/**
 * Capabilities that change something, and so are withheld while a workspace is
 * archived. `VIEW` is deliberately absent: archiving freezes writing, not
 * reading.
 *
 * This mirrors the API guard, which refuses mutating HTTP methods on an
 * archived workspace. The two are separate implementations of one rule, which
 * is why both name it in terms of "does this write?" rather than listing routes.
 */
const WRITE_PERMISSIONS: readonly WorkspacePermission[] = [
  WorkspacePermission.CREATE,
  WorkspacePermission.UPDATE,
  WorkspacePermission.DELETE,
  WorkspacePermission.MANAGE_MEMBERS,
  WorkspacePermission.MANAGE_SETTINGS,
  WorkspacePermission.MANAGE_BILLING,
];

/**
 * What the signed-in user may do in the workspace on screen.
 *
 * Screens ask for the capability they are about to offer — `can('delete')` —
 * rather than comparing roles inline. Two reasons: the answer comes from the
 * same grant table the API guard consults, so a button and the server agree;
 * and a role added later changes one table instead of every component that
 * happened to spell out `role === 'ADMIN'`.
 *
 * An archived workspace withholds every write here for the same reason it does
 * server-side. Folding it in at this one point is what keeps the freeze honest:
 * otherwise each screen would have to remember to check `status` on top of the
 * role, and the ones that forgot would offer buttons that 403 on click.
 *
 * This is presentation only. It decides whether a control is *shown*, never
 * whether an action is *allowed* — the API re-derives permissions from the
 * caller's membership on every request and ignores anything the browser says.
 */
export function useWorkspacePermission(): {
  role: WorkspaceRole | undefined;
  /** True when the user holds `permission` here. False while still loading. */
  can: (permission: WorkspacePermission) => boolean;
  /** True when the workspace is frozen, for explaining a disabled control. */
  isArchived: boolean;
  /** True until the role is known, for rendering a disabled control instead of a wrong one. */
  isLoading: boolean;
} {
  const { workspace, isLoading } = useCurrentWorkspace();
  const role = workspace?.role;
  const isArchived = workspace?.status === WorkspaceStatus.ARCHIVED;

  return {
    role,
    isArchived,
    // Closed while loading: briefly hiding a control the user does have is a
    // smaller mistake than flashing one they will be refused for pressing.
    can: (permission: WorkspacePermission) => {
      if (isArchived && WRITE_PERMISSIONS.includes(permission)) return false;
      return roleHasPermission(role, permission);
    },
    isLoading,
  };
}
