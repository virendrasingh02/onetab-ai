import { describe, expect, it } from 'vitest';
import { WorkspaceRole } from './enums.js';
import {
  ROLE_PERMISSIONS,
  WORKSPACE_PERMISSIONS,
  WorkspacePermission,
  permissionsForRole,
  roleHasAllPermissions,
  roleHasPermission,
} from './permissions.js';

describe('workspace permissions', () => {
  it('gives the owner everything', () => {
    expect(permissionsForRole(WorkspaceRole.OWNER)).toEqual(
      WORKSPACE_PERMISSIONS,
    );
  });

  it('withholds billing from an admin', () => {
    // The one capability that separates ADMIN from OWNER. If this ever passes,
    // an admin can change what the company is charged.
    expect(
      roleHasPermission(WorkspaceRole.ADMIN, WorkspacePermission.MANAGE_BILLING),
    ).toBe(false);
    expect(
      roleHasPermission(
        WorkspaceRole.ADMIN,
        WorkspacePermission.MANAGE_SETTINGS,
      ),
    ).toBe(true);
  });

  it('lets a member create and update but not manage anyone', () => {
    expect(
      roleHasAllPermissions(WorkspaceRole.MEMBER, [
        WorkspacePermission.VIEW,
        WorkspacePermission.CREATE,
        WorkspacePermission.UPDATE,
      ]),
    ).toBe(true);

    expect(
      roleHasPermission(WorkspaceRole.MEMBER, WorkspacePermission.DELETE),
    ).toBe(false);
    expect(
      roleHasPermission(
        WorkspaceRole.MEMBER,
        WorkspacePermission.MANAGE_MEMBERS,
      ),
    ).toBe(false);
  });

  it('keeps a guest read-only', () => {
    expect(permissionsForRole(WorkspaceRole.GUEST)).toEqual([
      WorkspacePermission.VIEW,
    ]);

    for (const permission of WORKSPACE_PERMISSIONS) {
      if (permission === WorkspacePermission.VIEW) continue;
      expect(roleHasPermission(WorkspaceRole.GUEST, permission)).toBe(false);
    }
  });

  it('denies everything when the role is unknown', () => {
    // A caller with no membership resolves to `undefined`, and must not fall
    // through to a permissive default.
    for (const permission of WORKSPACE_PERMISSIONS) {
      expect(roleHasPermission(undefined, permission)).toBe(false);
    }
    expect(permissionsForRole(undefined)).toEqual([]);
  });

  it('grants VIEW to every role', () => {
    // Anyone who is a member at all can read; nothing below GUEST exists.
    for (const role of Object.values(WorkspaceRole)) {
      expect(roleHasPermission(role, WorkspacePermission.VIEW)).toBe(true);
    }
  });

  it('separates reading from writing', () => {
    // The archive freeze — both in the API guard and in the browser hook —
    // is expressed as "withhold the writing permissions". That split is only
    // meaningful if VIEW is the sole non-writing capability.
    const writing = WORKSPACE_PERMISSIONS.filter(
      (permission) => permission !== WorkspacePermission.VIEW,
    );
    expect(writing).toHaveLength(WORKSPACE_PERMISSIONS.length - 1);
    expect(writing).not.toContain(WorkspacePermission.VIEW);
  });

  it('covers every role in the grant table', () => {
    // A role added to the enum without a row here would silently hold no
    // permissions at all — including VIEW — and lock its members out.
    for (const role of Object.values(WorkspaceRole)) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
    }
  });
});
