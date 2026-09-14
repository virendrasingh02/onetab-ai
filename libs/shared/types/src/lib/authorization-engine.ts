import {
  ChannelRole,
  ChannelVisibility,
  MembershipStatus,
  WorkspaceRole,
  hasWorkspaceRole,
} from './enums.js';
import {
  DEFAULT_WORKSPACE_POLICY,
  isPolicyRoleAllowed,
  type WorkspacePolicy,
} from './workspace-policies.js';

export type PermissionAction =
  // Workspace
  | 'workspace.view'
  | 'workspace.update'
  | 'workspace.delete'
  | 'workspace.archive'
  | 'workspace.transfer_ownership'
  | 'workspace.manage_members'
  | 'workspace.manage_settings'
  | 'workspace.manage_billing'
  | 'workspace.invite'
  | 'workspace.manage_policies'
  // Member
  | 'member.view'
  | 'member.change_role'
  | 'member.suspend'
  | 'member.reactivate'
  | 'member.remove'
  // Channel
  | 'channel.create'
  | 'channel.create_private'
  | 'channel.view'
  | 'channel.join'
  | 'channel.post'
  | 'channel.manage'
  | 'channel.delete'
  | 'channel.archive'
  // DM
  | 'dm.create'
  | 'dm.access'
  | 'dm.post'
  // App / Integration
  | 'app.view'
  | 'app.install'
  | 'app.configure'
  | 'app.remove'
  // AI Agent
  | 'agent.view'
  | 'agent.create'
  | 'agent.manage'
  | 'agent.delete'
  | 'agent.execute'
  // AI Coworker
  | 'coworker.view'
  | 'coworker.create'
  | 'coworker.manage'
  | 'coworker.assign'
  // Meeting
  | 'meeting.view'
  | 'meeting.create'
  | 'meeting.manage'
  // File
  | 'file.view'
  | 'file.upload'
  | 'file.manage'
  // Composer
  | 'composer.post'
  | 'composer.attach';

export interface SubjectContext {
  id: string;
  workspaceMembership?: {
    role: WorkspaceRole;
    status: MembershipStatus;
  } | null;
}

export type ResourceContext =
  | {
      type: 'workspace';
      id: string;
      ownerId?: string;
      policies?: WorkspacePolicy;
    }
  | {
      type: 'member';
      workspaceId: string;
      targetUserId: string;
      targetRole?: WorkspaceRole;
      targetStatus?: MembershipStatus;
      desiredRole?: WorkspaceRole;
    }
  | {
      type: 'channel';
      id: string;
      workspaceId: string;
      visibility: ChannelVisibility;
      memberIds?: readonly string[];
      channelRole?: ChannelRole | null;
      createdById?: string;
      isArchived?: boolean;
    }
  | {
      type: 'dm';
      id?: string;
      workspaceId: string;
      participantIds?: readonly string[];
    }
  | {
      type: 'app';
      id?: string;
      workspaceId?: string;
      installedById?: string;
    }
  | {
      type: 'agent';
      id?: string;
      workspaceId: string;
      createdById?: string;
      allowedRoles?: readonly WorkspaceRole[];
      allowedMemberIds?: readonly string[];
    }
  | {
      type: 'coworker';
      id?: string;
      workspaceId: string;
      createdById?: string;
    }
  | {
      type: 'meeting';
      id?: string;
      workspaceId: string;
      organizerId?: string;
      participantIds?: readonly string[];
    }
  | {
      type: 'file';
      id?: string;
      workspaceId: string;
      uploadedById?: string;
    }
  | {
      type: 'composer';
      workspaceId: string;
      surface: 'channel' | 'dm' | 'app' | 'agent' | 'coworker' | 'meeting';
      resourceId?: string;
      isAuthorizedPoster?: boolean;
    };

export interface AuthorizationOptions {
  policies?: WorkspacePolicy;
}

/**
 * Centralized authorization engine evaluating whether a subject can perform
 * an action on a resource within the workspace security boundary.
 */
export function can(
  subject: SubjectContext | null | undefined,
  action: PermissionAction,
  resource: ResourceContext,
  options?: AuthorizationOptions,
): boolean {
  if (!subject || !subject.id) return false;

  const membership = subject.workspaceMembership;
  if (!membership) return false;

  // Suspended and removed members cannot perform ANY actions
  if (
    membership.status === MembershipStatus.SUSPENDED ||
    membership.status === MembershipStatus.REMOVED
  ) {
    return false;
  }

  const role = membership.role;
  const isOwner = role === WorkspaceRole.OWNER;
  const isAdmin = isOwner || role === WorkspaceRole.ADMIN;
  const isMember = isAdmin || role === WorkspaceRole.MEMBER;
  const policies =
    options?.policies ??
    (resource.type === 'workspace' && resource.policies
      ? resource.policies
      : DEFAULT_WORKSPACE_POLICY);

  switch (action) {
    // --- WORKSPACE ACTIONS ---
    case 'workspace.view':
      return true;

    case 'workspace.update':
    case 'workspace.manage_settings':
    case 'workspace.manage_policies':
      return isAdmin;

    case 'workspace.delete':
    case 'workspace.archive':
    case 'workspace.manage_billing':
    case 'workspace.transfer_ownership':
      return isOwner;

    case 'workspace.manage_members':
      return isAdmin;

    case 'workspace.invite':
      return isPolicyRoleAllowed(role, policies.whoCanInvite);

    // --- MEMBER ACTIONS ---
    case 'member.view':
      return true;

    case 'member.change_role': {
      if (resource.type !== 'member') return false;
      if (!isAdmin) return false;
      if (subject.id === resource.targetUserId) return false; // cannot change own role

      // Target cannot be owner
      if (resource.targetRole === WorkspaceRole.OWNER) return false;

      // Desired role cannot be owner (must use ownership transfer)
      if (resource.desiredRole === WorkspaceRole.OWNER) return false;

      // Non-owner admin cannot modify peers or promote above their own role
      if (!isOwner) {
        if (resource.targetRole && hasWorkspaceRole(resource.targetRole, role)) {
          return false;
        }
        if (resource.desiredRole && hasWorkspaceRole(resource.desiredRole, role)) {
          return false;
        }
      }
      return true;
    }

    case 'member.suspend':
    case 'member.reactivate': {
      if (resource.type !== 'member') return false;
      if (!isAdmin) return false;
      if (subject.id === resource.targetUserId) return false;
      if (resource.targetRole === WorkspaceRole.OWNER) return false;
      if (!isOwner && resource.targetRole && hasWorkspaceRole(resource.targetRole, role)) {
        return false;
      }
      return true;
    }

    case 'member.remove': {
      if (resource.type !== 'member') return false;
      if (subject.id === resource.targetUserId) {
        // Leaving workspace voluntarily: allowed unless owner
        return !isOwner;
      }
      if (!isAdmin) return false;
      if (resource.targetRole === WorkspaceRole.OWNER) return false;
      if (!isOwner && resource.targetRole && hasWorkspaceRole(resource.targetRole, role)) {
        return false;
      }
      return true;
    }

    // --- CHANNEL ACTIONS ---
    case 'channel.create':
      return isPolicyRoleAllowed(role, policies.whoCanCreateChannels);

    case 'channel.create_private':
      return isPolicyRoleAllowed(role, policies.whoCanCreatePrivateChannels);

    case 'channel.view': {
      if (resource.type !== 'channel') return false;
      if (resource.visibility === ChannelVisibility.PUBLIC) {
        return true;
      }
      // Private channel: must be explicit member
      return (
        resource.memberIds?.includes(subject.id) ??
        (resource.channelRole !== null && resource.channelRole !== undefined)
      );
    }

    case 'channel.join': {
      if (resource.type !== 'channel') return false;
      if (resource.visibility === ChannelVisibility.PUBLIC) {
        return true;
      }
      // Cannot self-join private channel
      return false;
    }

    case 'channel.post': {
      if (resource.type !== 'channel') return false;
      if (resource.isArchived) return false;
      // Must be a channel member to post
      const isChannelMember =
        resource.memberIds?.includes(subject.id) ??
        (resource.channelRole !== null && resource.channelRole !== undefined);
      return Boolean(isChannelMember);
    }

    case 'channel.manage': {
      if (resource.type !== 'channel') return false;
      if (isAdmin) return true;
      if (resource.createdById === subject.id) return true;
      return resource.channelRole === ChannelRole.ADMIN;
    }

    case 'channel.delete':
    case 'channel.archive': {
      if (resource.type !== 'channel') return false;
      if (isAdmin) return true;
      return resource.createdById === subject.id;
    }

    // --- DM ACTIONS ---
    case 'dm.create':
      // Members and admins can initiate DMs
      return isMember;

    case 'dm.access':
    case 'dm.post': {
      if (resource.type !== 'dm') return false;
      if (!resource.participantIds) return true;
      return resource.participantIds.includes(subject.id);
    }

    // --- APP / INTEGRATION ACTIONS ---
    case 'app.view':
      return true;

    case 'app.install':
      return isPolicyRoleAllowed(role, policies.whoCanInstallApps);

    case 'app.configure':
    case 'app.remove':
      return isAdmin;

    // --- AI AGENT ACTIONS ---
    case 'agent.view': {
      if (resource.type !== 'agent') return false;
      if (resource.allowedRoles && resource.allowedRoles.length > 0) {
        if (!resource.allowedRoles.includes(role)) return false;
      }
      if (resource.allowedMemberIds && resource.allowedMemberIds.length > 0) {
        if (!resource.allowedMemberIds.includes(subject.id)) return false;
      }
      return true;
    }

    case 'agent.create':
      return isPolicyRoleAllowed(role, policies.whoCanCreateAgents);

    case 'agent.manage':
    case 'agent.delete': {
      if (resource.type !== 'agent') return false;
      if (isAdmin) return true;
      return resource.createdById === subject.id;
    }

    case 'agent.execute':
      return isMember;

    // --- AI COWORKER ACTIONS ---
    case 'coworker.view':
      return true;

    case 'coworker.create':
      return isPolicyRoleAllowed(role, policies.whoCanCreateCoworkers);

    case 'coworker.manage':
    case 'coworker.assign':
      return isAdmin;

    // --- MEETING ACTIONS ---
    case 'meeting.view': {
      if (resource.type !== 'meeting') return false;
      if (isAdmin) return true;
      if (!resource.participantIds) return true;
      return resource.participantIds.includes(subject.id);
    }

    case 'meeting.create':
      return isPolicyRoleAllowed(role, policies.whoCanCreateMeetings);

    case 'meeting.manage': {
      if (resource.type !== 'meeting') return false;
      if (isAdmin) return true;
      return resource.organizerId === subject.id;
    }

    // --- FILE ACTIONS ---
    case 'file.view':
      return true;

    case 'file.upload':
      return isPolicyRoleAllowed(role, policies.whoCanManageFiles);

    case 'file.manage': {
      if (resource.type !== 'file') return false;
      if (isAdmin) return true;
      return resource.uploadedById === subject.id;
    }

    // --- COMPOSER ACTIONS ---
    case 'composer.post': {
      if (resource.type !== 'composer') return false;
      if (resource.isAuthorizedPoster !== undefined) {
        return resource.isAuthorizedPoster;
      }
      return isMember;
    }

    case 'composer.attach': {
      return isPolicyRoleAllowed(role, policies.whoCanManageFiles);
    }

    default:
      return false;
  }
}
