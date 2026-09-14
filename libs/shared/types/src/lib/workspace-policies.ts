import { WorkspaceRole } from './enums.js';
import type { TieredFeaturePolicy } from './feature-settings.js';

export const PolicySubjectRole = {
  OWNER_ONLY: 'OWNER_ONLY',
  ADMINS: 'ADMINS',
  MEMBERS: 'MEMBERS',
} as const;
export type PolicySubjectRole =
  (typeof PolicySubjectRole)[keyof typeof PolicySubjectRole];

/**
 * @deprecated kept as an alias so existing imports keep working — the type is
 * now the general-purpose `TieredFeaturePolicy` (`@org/types`), shared by
 * every ENABLED/OPTIONAL/DISABLED policy, not just link previews.
 */
export const LinkPreviewPolicy = {
  ENABLED: 'ENABLED',
  OPTIONAL: 'OPTIONAL',
  DISABLED: 'DISABLED',
} as const;
export type LinkPreviewPolicy = TieredFeaturePolicy;

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
  linkPreviewsPolicy?: TieredFeaturePolicy;
  /** Can the workspace force DM/channel read receipts on or off for everyone? Unset/OPTIONAL leaves it to each member's own preference. */
  readReceiptsPolicy?: TieredFeaturePolicy;
  /** Who may react to messages with emoji. */
  whoCanReact: PolicySubjectRole;
  /** Minutes a member may edit their own message after sending. `null`/unset = unlimited (today's behavior). Admins/owners can always delete via `MODERATE_MESSAGES`. */
  messageEditWindowMinutes?: number | null;
  /** Per-file upload size ceiling in MB. `null`/unset = the platform default (25MB). Never raises the hardcoded security blocklist. */
  maxUploadSizeMb?: number | null;
  /** Archive a channel after this many days with no new messages. `null`/unset = never (today's behavior). */
  autoArchiveInactiveDays?: number | null;
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
  linkPreviewsPolicy: LinkPreviewPolicy.OPTIONAL,
  readReceiptsPolicy: LinkPreviewPolicy.OPTIONAL,
  whoCanReact: PolicySubjectRole.MEMBERS,
  messageEditWindowMinutes: null,
  maxUploadSizeMb: null,
  autoArchiveInactiveDays: null,
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

  type SubjectRoleKey = Exclude<
    keyof WorkspacePolicy,
    | 'linkPreviewsPolicy'
    | 'readReceiptsPolicy'
    | 'messageEditWindowMinutes'
    | 'maxUploadSizeMb'
    | 'autoArchiveInactiveDays'
  >;
  const raw = rawJson as Partial<Record<keyof WorkspacePolicy, unknown>>;
  const resolveSetting = (key: SubjectRoleKey): PolicySubjectRole => {
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

  const resolveTieredPolicy = (
    key: 'linkPreviewsPolicy' | 'readReceiptsPolicy',
  ): TieredFeaturePolicy => {
    const val = raw[key];
    if (
      val === LinkPreviewPolicy.ENABLED ||
      val === LinkPreviewPolicy.OPTIONAL ||
      val === LinkPreviewPolicy.DISABLED
    ) {
      return val;
    }
    return DEFAULT_WORKSPACE_POLICY[key] ?? LinkPreviewPolicy.OPTIONAL;
  };

  /** A positive integer within `[min, max]`, or `null` (meaning "unbounded" / feature default). */
  const resolveNullableInt = (
    key: 'messageEditWindowMinutes' | 'maxUploadSizeMb' | 'autoArchiveInactiveDays',
    min: number,
    max: number,
  ): number | null => {
    const val = raw[key];
    if (val === null) return null;
    if (typeof val === 'number' && Number.isFinite(val)) {
      return Math.min(max, Math.max(min, Math.round(val)));
    }
    return DEFAULT_WORKSPACE_POLICY[key] ?? null;
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
    whoCanReact: resolveSetting('whoCanReact'),
    linkPreviewsPolicy: resolveTieredPolicy('linkPreviewsPolicy'),
    readReceiptsPolicy: resolveTieredPolicy('readReceiptsPolicy'),
    messageEditWindowMinutes: resolveNullableInt('messageEditWindowMinutes', 1, 10080),
    maxUploadSizeMb: resolveNullableInt('maxUploadSizeMb', 5, 25),
    autoArchiveInactiveDays: resolveNullableInt('autoArchiveInactiveDays', 7, 365),
  };
}
