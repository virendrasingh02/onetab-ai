import { WorkspaceRole } from './enums.js';

export const PolicySubjectRole = {
  OWNER_ONLY: 'OWNER_ONLY',
  ADMINS: 'ADMINS',
  MEMBERS: 'MEMBERS',
} as const;
export type PolicySubjectRole =
  (typeof PolicySubjectRole)[keyof typeof PolicySubjectRole];

export interface WorkspacePolicy {
  whoCanInvite: PolicySubjectRole;
  whoCanCreateChannels: PolicySubjectRole;
  whoCanCreatePrivateChannels: PolicySubjectRole;
  whoCanInstallApps: PolicySubjectRole;
  whoCanCreateAgents: PolicySubjectRole;
  whoCanCreateCoworkers: PolicySubjectRole;
  whoCanManageIntegrations: PolicySubjectRole;
  whoCanCreateMeetings: PolicySubjectRole;
  whoCanManageFiles: PolicySubjectRole;
  whoCanCreateExternalResources: PolicySubjectRole;
}

export const DEFAULT_WORKSPACE_POLICY: Readonly<WorkspacePolicy> = {
  whoCanInvite: PolicySubjectRole.MEMBERS,
  whoCanCreateChannels: PolicySubjectRole.MEMBERS,
  whoCanCreatePrivateChannels: PolicySubjectRole.MEMBERS,
  whoCanInstallApps: PolicySubjectRole.ADMINS,
  whoCanCreateAgents: PolicySubjectRole.ADMINS,
  whoCanCreateCoworkers: PolicySubjectRole.ADMINS,
  whoCanManageIntegrations: PolicySubjectRole.ADMINS,
  whoCanCreateMeetings: PolicySubjectRole.MEMBERS,
  whoCanManageFiles: PolicySubjectRole.MEMBERS,
  whoCanCreateExternalResources: PolicySubjectRole.ADMINS,
};

/**
 * Checks whether a member with the given workspace role satisfies the policy setting.
 */
export function isPolicyRoleAllowed(
  role: WorkspaceRole | null | undefined,
  setting: PolicySubjectRole,
): boolean {
  if (!role) return false;
  if (role === WorkspaceRole.GUEST) return false;

  switch (setting) {
    case PolicySubjectRole.OWNER_ONLY:
      return role === WorkspaceRole.OWNER;
    case PolicySubjectRole.ADMINS:
      return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN;
    case PolicySubjectRole.MEMBERS:
      return (
        role === WorkspaceRole.OWNER ||
        role === WorkspaceRole.ADMIN ||
        role === WorkspaceRole.MEMBER
      );
    default:
      return false;
  }
}

/**
 * Resolves a workspace's raw stored policy against the default policy schema.
 */
export function resolveWorkspacePolicy(
  rawJson?: unknown,
): WorkspacePolicy {
  if (!rawJson || typeof rawJson !== 'object') {
    return { ...DEFAULT_WORKSPACE_POLICY };
  }

  const raw = rawJson as Partial<Record<keyof WorkspacePolicy, unknown>>;
  const resolveSetting = (key: keyof WorkspacePolicy): PolicySubjectRole => {
    const val = raw[key];
    if (
      val === PolicySubjectRole.OWNER_ONLY ||
      val === PolicySubjectRole.ADMINS ||
      val === PolicySubjectRole.MEMBERS
    ) {
      return val;
    }
    return DEFAULT_WORKSPACE_POLICY[key];
  };

  return {
    whoCanInvite: resolveSetting('whoCanInvite'),
    whoCanCreateChannels: resolveSetting('whoCanCreateChannels'),
    whoCanCreatePrivateChannels: resolveSetting('whoCanCreatePrivateChannels'),
    whoCanInstallApps: resolveSetting('whoCanInstallApps'),
    whoCanCreateAgents: resolveSetting('whoCanCreateAgents'),
    whoCanCreateCoworkers: resolveSetting('whoCanCreateCoworkers'),
    whoCanManageIntegrations: resolveSetting('whoCanManageIntegrations'),
    whoCanCreateMeetings: resolveSetting('whoCanCreateMeetings'),
    whoCanManageFiles: resolveSetting('whoCanManageFiles'),
    whoCanCreateExternalResources: resolveSetting('whoCanCreateExternalResources'),
  };
}
