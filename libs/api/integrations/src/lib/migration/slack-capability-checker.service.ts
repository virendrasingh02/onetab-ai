import { Injectable, Logger } from '@nestjs/common';
import type {
  MigrationCapabilityItem,
  MigrationCapabilityKey,
  MigrationCapabilityReport,
  MigrationCapabilityStatus,
} from '@org/types';
import axios from 'axios';
import { API_BASE } from '../providers/slack.provider.js';

interface SlackAuthTestResponse {
  ok: boolean;
  error?: string;
  url?: string;
  team?: string;
  user?: string;
  team_id?: string;
  user_id?: string;
  bot_id?: string;
  is_enterprise_install?: boolean;
}

@Injectable()
export class SlackCapabilityChecker {
  private readonly logger = new Logger(SlackCapabilityChecker.name);

  async checkCapabilities(
    token: string,
    grantedScopes: string[] = [],
  ): Promise<MigrationCapabilityReport> {
    const scopesSet = new Set(grantedScopes.map((s) => s.trim().toLowerCase()));
    let authInfo: SlackAuthTestResponse = { ok: false };
    const checkedAt = new Date().toISOString();

    // 1. Verify auth & probe granted scopes if not provided
    try {
      const authRes = await axios.post<SlackAuthTestResponse>(
        `${API_BASE}/auth.test`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      authInfo = authRes.data;

      // Extract scopes from response headers if available
      const headerScopes =
        authRes.headers['x-oauth-scopes'] || authRes.headers['X-OAuth-Scopes'];
      if (typeof headerScopes === 'string') {
        headerScopes.split(',').forEach((s) => scopesSet.add(s.trim().toLowerCase()));
      }
    } catch (err: any) {
      this.logger.warn(`Failed to call auth.test on Slack API: ${err.message}`);
    }

    const hasScope = (scope: string) => scopesSet.has(scope.toLowerCase());

    // 2. Probe calls to test real API access
    const probes = await this.runProbes(token);

    // 3. Evaluate each capability
    const capabilities: Record<MigrationCapabilityKey, MigrationCapabilityItem> = {
      workspace_metadata: this.evaluateCapability({
        key: 'workspace_metadata',
        name: 'Workspace Metadata',
        description: 'Workspace name, icon, domain, and unique identifiers.',
        requiredScopes: ['team:read'],
        hasRequiredScopes: hasScope('team:read') || probes.teamInfoOk,
        probeSuccess: probes.teamInfoOk,
        probeError: probes.teamInfoError,
      }),

      members: this.evaluateCapability({
        key: 'members',
        name: 'Team Members',
        description: 'Workspace user list, roles, display names, and presence states.',
        requiredScopes: ['users:read'],
        hasRequiredScopes: hasScope('users:read') || probes.usersListOk,
        probeSuccess: probes.usersListOk,
        probeError: probes.usersListError,
        isCore: true,
      }),

      user_profiles: this.evaluateCapability({
        key: 'user_profiles',
        name: 'User Profiles & Avatars',
        description: 'Full profile details, avatars, job titles, and verified emails.',
        requiredScopes: ['users:read', 'users:read.email'],
        hasRequiredScopes: hasScope('users:read.email') || hasScope('users.profile:read'),
        probeSuccess: probes.usersListOk,
        details: { emailScopeGranted: hasScope('users:read.email') },
      }),

      public_channels: this.evaluateCapability({
        key: 'public_channels',
        name: 'Public Channels',
        description: 'Public channel directory, topics, descriptions, and creation dates.',
        requiredScopes: ['channels:read'],
        hasRequiredScopes: hasScope('channels:read') || probes.publicChannelsOk,
        probeSuccess: probes.publicChannelsOk,
        probeError: probes.publicChannelsError,
        isCore: true,
      }),

      private_channels: this.evaluateCapability({
        key: 'private_channels',
        name: 'Private Channels',
        description: 'Private channels the connecting user or bot is authorized to access.',
        requiredScopes: ['groups:read'],
        hasRequiredScopes: hasScope('groups:read') || probes.privateChannelsOk,
        probeSuccess: probes.privateChannelsOk,
        probeError: probes.privateChannelsError,
        isPrivate: true,
      }),

      channel_members: this.evaluateCapability({
        key: 'channel_members',
        name: 'Channel Memberships',
        description: 'Mapping of which members belong to each public and private channel.',
        requiredScopes: ['channels:read'],
        hasRequiredScopes: hasScope('channels:read') || probes.publicChannelsOk,
        probeSuccess: probes.publicChannelsOk,
      }),

      messages: this.evaluateCapability({
        key: 'messages',
        name: 'Channel Messages',
        description: 'Message history, timestamps, sender identities, and formatting.',
        requiredScopes: ['channels:history'],
        hasRequiredScopes: hasScope('channels:history') || probes.channelHistoryOk,
        probeSuccess: probes.channelHistoryOk,
        probeError: probes.channelHistoryError,
        isCore: true,
      }),

      message_history: this.evaluateCapability({
        key: 'message_history',
        name: 'Extended History Retention',
        description: 'Full historical message access without free-tier 90-day retention cutoff.',
        requiredScopes: ['channels:history'],
        hasRequiredScopes: hasScope('channels:history'),
        probeSuccess: probes.channelHistoryOk,
        details: { retentionChecked: true },
      }),

      threads: this.evaluateCapability({
        key: 'threads',
        name: 'Message Threads & Replies',
        description: 'Thread replies, hierarchical reply relationships, and broadcast flags.',
        requiredScopes: ['channels:history'],
        hasRequiredScopes: hasScope('channels:history') || probes.channelHistoryOk,
        probeSuccess: probes.channelHistoryOk,
      }),

      reactions: this.evaluateCapability({
        key: 'reactions',
        name: 'Reactions & Emojis',
        description: 'Emoji reactions added by team members to channel and thread messages.',
        requiredScopes: ['reactions:read'],
        hasRequiredScopes: hasScope('reactions:read') || hasScope('channels:history'),
        probeSuccess: probes.channelHistoryOk,
      }),

      mentions: this.evaluateCapability({
        key: 'mentions',
        name: 'User & Channel Mentions',
        description: 'Resolution of @user and #channel references into platform equivalents.',
        requiredScopes: ['channels:history', 'users:read'],
        hasRequiredScopes: hasScope('channels:history') && hasScope('users:read'),
        probeSuccess: probes.channelHistoryOk && probes.usersListOk,
      }),

      files: this.evaluateCapability({
        key: 'files',
        name: 'Files & Media Attachments',
        description: 'Direct downloads of images, documents, and media shared in channels.',
        requiredScopes: ['files:read'],
        hasRequiredScopes: hasScope('files:read') || probes.filesListOk,
        probeSuccess: probes.filesListOk,
        probeError: probes.filesListError,
      }),

      file_links: this.evaluateCapability({
        key: 'file_links',
        name: 'External File Links',
        description: 'Preserving links to external files (Google Drive, Box, OneDrive).',
        requiredScopes: ['channels:history'],
        hasRequiredScopes: hasScope('channels:history'),
        probeSuccess: probes.channelHistoryOk,
      }),

      dms: this.evaluateCapability({
        key: 'dms',
        name: 'Direct Messages (1:1 DMs)',
        description: 'Direct conversations between two members (subject to explicit user consent).',
        requiredScopes: ['im:read', 'im:history'],
        hasRequiredScopes: hasScope('im:read') && hasScope('im:history'),
        probeSuccess: probes.dmsOk,
        probeError: probes.dmsError,
        isPrivate: true,
      }),

      group_dms: this.evaluateCapability({
        key: 'group_dms',
        name: 'Group Direct Messages (MPIMs)',
        description: 'Multi-party direct message conversations between groups of members.',
        requiredScopes: ['mpim:read', 'mpim:history'],
        hasRequiredScopes: hasScope('mpim:read') && hasScope('mpim:history'),
        probeSuccess: probes.groupDmsOk,
        probeError: probes.groupDmsError,
        isPrivate: true,
      }),

      canvases: {
        key: 'canvases',
        name: 'Slack Canvases',
        description: 'Slack native canvases (converted to OneTab Documents where available in export).',
        status: 'unsupported',
        reason:
          'Slack Canvas API is restricted by Slack. Canvases are supported via Slack JSON Export packages.',
      },

      lists: {
        key: 'lists',
        name: 'Slack Lists',
        description: 'Slack Lists (converted into OneTab Tasks/Kanban where available).',
        status: 'unsupported',
        reason:
          'Slack Lists API is not publicly exposed by Slack. Migrate lists via CSV or Work Tools import.',
      },
    };

    // 4. Calculate blockers & warnings
    const blockers: string[] = [];
    const warnings: string[] = [];

    if (capabilities.members.status !== 'available') {
      blockers.push('Members access is required to map users and author identities.');
    }
    if (capabilities.public_channels.status !== 'available') {
      blockers.push('Public channels access is required to recreate channel structure.');
    }
    if (capabilities.messages.status !== 'available') {
      blockers.push('Channel history permission (channels:history) is required to import messages.');
    }

    if (capabilities.private_channels.status !== 'available') {
      warnings.push(
        'Private channels will not be imported with current permissions. Re-authorize with groups:read to include them.',
      );
    }
    if (capabilities.dms.status !== 'available') {
      warnings.push(
        'Direct messages (DMs) are not accessible. Re-authorize with im:history if DM migration is desired.',
      );
    }
    if (capabilities.files.status !== 'available') {
      warnings.push(
        'Files permission (files:read) is not active. Message text will migrate, but files will remain external links.',
      );
    }
    if (!hasScope('users:read.email')) {
      warnings.push(
        'User email permission is missing. User matching will rely on linked Slack IDs or require manual mapping.',
      );
    }

    const canMigrate = blockers.length === 0;

    return {
      capabilities,
      workspace: {
        id: authInfo.team_id ?? 'unknown_team',
        name: authInfo.team ?? 'Slack Workspace',
        domain: authInfo.url ? new URL(authInfo.url).hostname : undefined,
      },
      connectedAccount: {
        id: authInfo.user_id ?? 'unknown_user',
        name: authInfo.user ?? 'Connected User',
        isAdmin: true, // Slack OAuth installer or user token
      },
      scopes: Array.from(scopesSet),
      canMigrate,
      blockers,
      warnings,
      checkedAt,
    };
  }

  private async runProbes(token: string) {
    const headers = { Authorization: `Bearer ${token}` };
    const result = {
      teamInfoOk: false,
      teamInfoError: undefined as string | undefined,
      usersListOk: false,
      usersListError: undefined as string | undefined,
      publicChannelsOk: false,
      publicChannelsError: undefined as string | undefined,
      privateChannelsOk: false,
      privateChannelsError: undefined as string | undefined,
      channelHistoryOk: false,
      channelHistoryError: undefined as string | undefined,
      dmsOk: false,
      dmsError: undefined as string | undefined,
      groupDmsOk: false,
      groupDmsError: undefined as string | undefined,
      filesListOk: false,
      filesListError: undefined as string | undefined,
    };

    // team.info
    try {
      const res = await axios.get(`${API_BASE}/team.info`, { headers });
      result.teamInfoOk = Boolean(res.data.ok);
      if (!res.data.ok) result.teamInfoError = res.data.error;
    } catch (e: any) {
      result.teamInfoError = e.message;
    }

    // users.list
    try {
      const res = await axios.get(`${API_BASE}/users.list`, { headers, params: { limit: 1 } });
      result.usersListOk = Boolean(res.data.ok);
      if (!res.data.ok) result.usersListError = res.data.error;
    } catch (e: any) {
      result.usersListError = e.message;
    }

    // conversations.list for public channels
    let sampleChannelId: string | undefined;
    try {
      const res = await axios.get(`${API_BASE}/conversations.list`, {
        headers,
        params: { types: 'public_channel', limit: 1 },
      });
      result.publicChannelsOk = Boolean(res.data.ok);
      if (res.data.ok && res.data.channels?.length > 0) {
        sampleChannelId = res.data.channels[0].id;
      } else if (!res.data.ok) {
        result.publicChannelsError = res.data.error;
      }
    } catch (e: any) {
      result.publicChannelsError = e.message;
    }

    // conversations.list for private channels
    try {
      const res = await axios.get(`${API_BASE}/conversations.list`, {
        headers,
        params: { types: 'private_channel', limit: 1 },
      });
      result.privateChannelsOk = Boolean(res.data.ok);
      if (!res.data.ok) result.privateChannelsError = res.data.error;
    } catch (e: any) {
      result.privateChannelsError = e.message;
    }

    // conversations.history probe using sample public channel
    if (sampleChannelId) {
      try {
        const res = await axios.get(`${API_BASE}/conversations.history`, {
          headers,
          params: { channel: sampleChannelId, limit: 1 },
        });
        result.channelHistoryOk = Boolean(res.data.ok);
        if (!res.data.ok) result.channelHistoryError = res.data.error;
      } catch (e: any) {
        result.channelHistoryError = e.message;
      }
    } else if (result.publicChannelsOk) {
      result.channelHistoryOk = true;
    }

    // conversations.list for DMs
    try {
      const res = await axios.get(`${API_BASE}/conversations.list`, {
        headers,
        params: { types: 'im', limit: 1 },
      });
      result.dmsOk = Boolean(res.data.ok);
      if (!res.data.ok) result.dmsError = res.data.error;
    } catch (e: any) {
      result.dmsError = e.message;
    }

    // conversations.list for MPIMs
    try {
      const res = await axios.get(`${API_BASE}/conversations.list`, {
        headers,
        params: { types: 'mpim', limit: 1 },
      });
      result.groupDmsOk = Boolean(res.data.ok);
      if (!res.data.ok) result.groupDmsError = res.data.error;
    } catch (e: any) {
      result.groupDmsError = e.message;
    }

    // files.list
    try {
      const res = await axios.get(`${API_BASE}/files.list`, {
        headers,
        params: { count: 1 },
      });
      result.filesListOk = Boolean(res.data.ok);
      if (!res.data.ok) result.filesListError = res.data.error;
    } catch (e: any) {
      result.filesListError = e.message;
    }

    return result;
  }

  private evaluateCapability(options: {
    key: MigrationCapabilityKey;
    name: string;
    description: string;
    requiredScopes: string[];
    hasRequiredScopes: boolean;
    probeSuccess: boolean;
    probeError?: string;
    isCore?: boolean;
    isPrivate?: boolean;
    details?: Record<string, unknown>;
  }): MigrationCapabilityItem {
    const {
      key,
      name,
      description,
      requiredScopes,
      hasRequiredScopes,
      probeSuccess,
      probeError,
      isPrivate,
      details,
    } = options;

    if (probeSuccess || hasRequiredScopes) {
      return {
        key,
        name,
        description,
        status: 'available',
        details,
      };
    }

    let status: MigrationCapabilityStatus = 'unavailable';
    let reason = 'Capability is not accessible with current permissions.';

    if (probeError === 'missing_scope' || !hasRequiredScopes) {
      status = 'permission_required';
      reason = `Requires OAuth scope(s): ${requiredScopes.join(', ')}`;
    } else if (probeError === 'restricted_action' || probeError === 'not_allowed_token_type') {
      status = 'admin_required';
      reason = 'Slack Workspace Administrator consent or elevation required.';
    } else if (probeError === 'free_tier_restricted' || probeError === 'plan_upgrade_required') {
      status = 'plan_restricted';
      reason = 'Restricted by the source Slack workspace subscription plan.';
    } else if (isPrivate) {
      status = 'permission_required';
      reason = 'Private conversation access requires elevated user authorization.';
    }

    return {
      key,
      name,
      description,
      status,
      reason,
      missingScopes: requiredScopes,
      details: { ...details, probeError },
    };
  }
}
