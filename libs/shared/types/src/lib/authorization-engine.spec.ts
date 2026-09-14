import { describe, expect, it } from 'vitest';
import {
  can,
  type ResourceContext,
  type SubjectContext,
} from './authorization-engine.js';
import {
  ChannelVisibility,
  MembershipStatus,
  WorkspaceRole,
} from './enums.js';
import {
  DEFAULT_WORKSPACE_POLICY,
  PolicySubjectRole,
} from './workspace-policies.js';

describe('centralized authorization engine can()', () => {
  const ownerSubject: SubjectContext = {
    id: 'user-owner',
    workspaceMembership: {
      role: WorkspaceRole.OWNER,
      status: MembershipStatus.ACTIVE,
    },
  };

  const adminSubject: SubjectContext = {
    id: 'user-admin',
    workspaceMembership: {
      role: WorkspaceRole.ADMIN,
      status: MembershipStatus.ACTIVE,
    },
  };

  const memberSubject: SubjectContext = {
    id: 'user-member',
    workspaceMembership: {
      role: WorkspaceRole.MEMBER,
      status: MembershipStatus.ACTIVE,
    },
  };

  const guestSubject: SubjectContext = {
    id: 'user-guest',
    workspaceMembership: {
      role: WorkspaceRole.GUEST,
      status: MembershipStatus.ACTIVE,
    },
  };

  const suspendedSubject: SubjectContext = {
    id: 'user-suspended',
    workspaceMembership: {
      role: WorkspaceRole.MEMBER,
      status: MembershipStatus.SUSPENDED,
    },
  };

  const removedSubject: SubjectContext = {
    id: 'user-removed',
    workspaceMembership: {
      role: WorkspaceRole.MEMBER,
      status: MembershipStatus.REMOVED,
    },
  };

  const workspaceResource: ResourceContext = {
    type: 'workspace',
    id: 'ws-1',
    ownerId: 'user-owner',
    policies: DEFAULT_WORKSPACE_POLICY,
  };

  describe('workspace level authorization', () => {
    it('allows owner to transfer ownership and delete workspace', () => {
      expect(can(ownerSubject, 'workspace.transfer_ownership', workspaceResource)).toBe(true);
      expect(can(ownerSubject, 'workspace.delete', workspaceResource)).toBe(true);
      expect(can(ownerSubject, 'workspace.archive', workspaceResource)).toBe(true);
      expect(can(ownerSubject, 'workspace.manage_billing', workspaceResource)).toBe(true);
    });

    it('denies admin from transferring ownership or deleting workspace', () => {
      expect(can(adminSubject, 'workspace.transfer_ownership', workspaceResource)).toBe(false);
      expect(can(adminSubject, 'workspace.delete', workspaceResource)).toBe(false);
      expect(can(adminSubject, 'workspace.archive', workspaceResource)).toBe(false);
      expect(can(adminSubject, 'workspace.manage_billing', workspaceResource)).toBe(false);
      expect(can(adminSubject, 'workspace.manage_settings', workspaceResource)).toBe(true);
      expect(can(adminSubject, 'workspace.manage_members', workspaceResource)).toBe(true);
    });

    it('denies member from settings and members management', () => {
      expect(can(memberSubject, 'workspace.manage_settings', workspaceResource)).toBe(false);
      expect(can(memberSubject, 'workspace.manage_members', workspaceResource)).toBe(false);
      expect(can(memberSubject, 'workspace.view', workspaceResource)).toBe(true);
    });

    it('blocks suspended and removed members completely', () => {
      expect(can(suspendedSubject, 'workspace.view', workspaceResource)).toBe(false);
      expect(can(removedSubject, 'workspace.view', workspaceResource)).toBe(false);
    });
  });

  describe('role change authorization', () => {
    it('prevents any admin from promoting to OWNER', () => {
      const targetMember: ResourceContext = {
        type: 'member',
        workspaceId: 'ws-1',
        targetUserId: 'user-member',
        targetRole: WorkspaceRole.MEMBER,
        desiredRole: WorkspaceRole.OWNER,
      };
      expect(can(adminSubject, 'member.change_role', targetMember)).toBe(false);
      expect(can(ownerSubject, 'member.change_role', targetMember)).toBe(false); // owner promotion must be via transfer_ownership
    });

    it('allows owner to promote member to admin', () => {
      const targetMember: ResourceContext = {
        type: 'member',
        workspaceId: 'ws-1',
        targetUserId: 'user-member',
        targetRole: WorkspaceRole.MEMBER,
        desiredRole: WorkspaceRole.ADMIN,
      };
      expect(can(ownerSubject, 'member.change_role', targetMember)).toBe(true);
    });

    it('prevents admin from modifying peer admin or promoting above themselves', () => {
      const targetPeer: ResourceContext = {
        type: 'member',
        workspaceId: 'ws-1',
        targetUserId: 'user-admin-2',
        targetRole: WorkspaceRole.ADMIN,
        desiredRole: WorkspaceRole.MEMBER,
      };
      expect(can(adminSubject, 'member.change_role', targetPeer)).toBe(false);
      expect(can(ownerSubject, 'member.change_role', targetPeer)).toBe(true);
    });

    it('prevents modifying or removing the owner', () => {
      const targetOwner: ResourceContext = {
        type: 'member',
        workspaceId: 'ws-1',
        targetUserId: 'user-owner',
        targetRole: WorkspaceRole.OWNER,
        desiredRole: WorkspaceRole.MEMBER,
      };
      expect(can(adminSubject, 'member.change_role', targetOwner)).toBe(false);
      expect(can(adminSubject, 'member.suspend', targetOwner)).toBe(false);
      expect(can(adminSubject, 'member.remove', targetOwner)).toBe(false);
    });

    it('allows a member to leave voluntarily, but not the owner without transfer', () => {
      const selfLeavingMember: ResourceContext = {
        type: 'member',
        workspaceId: 'ws-1',
        targetUserId: memberSubject.id,
      };
      expect(can(memberSubject, 'member.remove', selfLeavingMember)).toBe(true);

      const selfLeavingOwner: ResourceContext = {
        type: 'member',
        workspaceId: 'ws-1',
        targetUserId: ownerSubject.id,
      };
      expect(can(ownerSubject, 'member.remove', selfLeavingOwner)).toBe(false);
    });
  });

  describe('channel level authorization and policies', () => {
    it('respects private channel membership boundary', () => {
      const privateChannel: ResourceContext = {
        type: 'channel',
        id: 'chan-1',
        workspaceId: 'ws-1',
        visibility: ChannelVisibility.PRIVATE,
        memberIds: ['user-owner', 'user-member'],
      };

      // In memberIds
      expect(can(memberSubject, 'channel.view', privateChannel)).toBe(true);
      expect(can(ownerSubject, 'channel.view', privateChannel)).toBe(true);

      // Not in memberIds (admin without explicit channel membership does not automatically see private channel content)
      expect(can(adminSubject, 'channel.view', privateChannel)).toBe(false);
    });

    it('allows any active member to view public channels', () => {
      const publicChannel: ResourceContext = {
        type: 'channel',
        id: 'chan-pub',
        workspaceId: 'ws-1',
        visibility: ChannelVisibility.PUBLIC,
      };
      expect(can(memberSubject, 'channel.view', publicChannel)).toBe(true);
      expect(can(guestSubject, 'channel.view', publicChannel)).toBe(true);
    });

    it('evaluates workspace channel creation policies', () => {
      const adminOnlyPolicy = {
        ...DEFAULT_WORKSPACE_POLICY,
        whoCanCreateChannels: PolicySubjectRole.ADMINS,
      };

      expect(
        can(memberSubject, 'channel.create', workspaceResource, {
          policies: adminOnlyPolicy,
        }),
      ).toBe(false);

      expect(
        can(adminSubject, 'channel.create', workspaceResource, {
          policies: adminOnlyPolicy,
        }),
      ).toBe(true);
    });
  });

  describe('apps, agents, coworkers and meetings authorization', () => {
    it('evaluates app installation policy', () => {
      const appResource: ResourceContext = {
        type: 'app',
        workspaceId: 'ws-1',
      };
      // Default: ADMINS can install apps
      expect(can(memberSubject, 'app.install', appResource)).toBe(false);
      expect(can(adminSubject, 'app.install', appResource)).toBe(true);
    });

    it('evaluates agent creation and management', () => {
      const agentResource: ResourceContext = {
        type: 'agent',
        id: 'agent-1',
        workspaceId: 'ws-1',
        createdById: 'user-member',
      };

      // Member who created the agent can manage their own agent
      expect(can(memberSubject, 'agent.manage', agentResource)).toBe(true);

      // Other member cannot manage
      const otherMember: SubjectContext = {
        id: 'user-other',
        workspaceMembership: {
          role: WorkspaceRole.MEMBER,
          status: MembershipStatus.ACTIVE,
        },
      };
      expect(can(otherMember, 'agent.manage', agentResource)).toBe(false);

      // Admin can manage any agent
      expect(can(adminSubject, 'agent.manage', agentResource)).toBe(true);
    });
  });
});
