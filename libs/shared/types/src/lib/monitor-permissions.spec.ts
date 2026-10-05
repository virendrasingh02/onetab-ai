import { describe, expect, it } from 'vitest';
import { canManageTrackerMonitor, permissionsForRole, WorkspacePermission } from './permissions.js';
import { WorkspaceRole } from './enums.js';

const member = permissionsForRole(WorkspaceRole.MEMBER);
const admin = permissionsForRole(WorkspaceRole.ADMIN);
const guest = permissionsForRole(WorkspaceRole.GUEST);

describe('canManageTrackerMonitor', () => {
  const monitor = { createdBy: 'owner' };

  it('allows the owner, the coworker creator and admins', () => {
    expect(canManageTrackerMonitor(monitor, null, { userId: 'owner', permissions: member })).toBe(true);
    expect(canManageTrackerMonitor(monitor, 'creator', { userId: 'creator', permissions: member })).toBe(true);
    expect(canManageTrackerMonitor(monitor, null, { userId: 'someone', permissions: admin })).toBe(true);
  });

  it('refuses other members, guests and the signed-out', () => {
    expect(canManageTrackerMonitor(monitor, 'creator', { userId: 'other', permissions: member })).toBe(false);
    expect(canManageTrackerMonitor(monitor, null, { userId: 'owner', permissions: guest })).toBe(false);
    expect(canManageTrackerMonitor({ createdBy: null }, null, { userId: null, permissions: member })).toBe(false);
    expect(canManageTrackerMonitor(monitor, null, { userId: 'owner', permissions: [WorkspacePermission.VIEW] })).toBe(false);
  });
});
