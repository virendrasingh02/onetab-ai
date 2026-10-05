import { Injectable } from '@nestjs/common';
import type { MigrationCapabilityReport, MigrationScope } from '@org/types';
import type {
  BatchResult,
  MigrationProvider,
  SourceChannel,
  SourceFile,
  SourceMessage,
  SourceUser,
  SourceWorkspaceMetadata,
} from './migration-provider.interface.js';

export interface SlackExportPayload {
  workspace?: {
    id?: string;
    name?: string;
    domain?: string;
  };
  users?: any[];
  channels?: any[];
  groups?: any[];
  dms?: any[];
  mpims?: any[];
  messagesByChannel?: Record<string, any[]>;
  files?: any[];
}

@Injectable()
export class SlackExportMigrationProvider implements MigrationProvider {
  readonly providerId = 'SLACK_EXPORT';
  readonly displayName = 'Slack Export Package';

  // In-memory or staged export payload storage indexed by export session ID
  private readonly payloads = new Map<string, SlackExportPayload>();

  registerExportPayload(exportId: string, payload: SlackExportPayload) {
    this.payloads.set(exportId, payload);
  }

  getPayload(exportId: string): SlackExportPayload {
    return this.payloads.get(exportId) ?? {};
  }

  async checkCapabilities(
    authOrConfig: string | Record<string, unknown>,
  ): Promise<MigrationCapabilityReport> {
    const exportId = typeof authOrConfig === 'string' ? authOrConfig : (authOrConfig.exportId as string);
    const payload = this.getPayload(exportId);
    const checkedAt = new Date().toISOString();

    const hasUsers = Array.isArray(payload.users) && payload.users.length > 0;
    const hasChannels = Array.isArray(payload.channels) && payload.channels.length > 0;
    const hasPrivate = Array.isArray(payload.groups) && payload.groups.length > 0;
    const hasDms = Array.isArray(payload.dms) && payload.dms.length > 0;

    return {
      capabilities: {
        workspace_metadata: {
          key: 'workspace_metadata',
          name: 'Workspace Metadata',
          description: 'Export workspace metadata and organization branding.',
          status: 'available',
        },
        members: {
          key: 'members',
          name: 'Team Members',
          description: 'Export users from users.json.',
          status: hasUsers ? 'available' : 'unavailable',
        },
        user_profiles: {
          key: 'user_profiles',
          name: 'User Profiles',
          description: 'User profile details, avatars, and emails.',
          status: hasUsers ? 'available' : 'unavailable',
        },
        public_channels: {
          key: 'public_channels',
          name: 'Public Channels',
          description: 'Public channel definitions from channels.json.',
          status: hasChannels ? 'available' : 'unavailable',
        },
        private_channels: {
          key: 'private_channels',
          name: 'Private Channels',
          description: 'Private channels from groups.json.',
          status: hasPrivate ? 'available' : 'unavailable',
        },
        channel_members: {
          key: 'channel_members',
          name: 'Channel Memberships',
          description: 'Channel member lists.',
          status: hasChannels ? 'available' : 'unavailable',
        },
        messages: {
          key: 'messages',
          name: 'Channel Messages',
          description: 'Historical messages contained in export package.',
          status: 'available',
        },
        message_history: {
          key: 'message_history',
          name: 'Extended History Retention',
          description: 'Complete offline history without API limits.',
          status: 'available',
        },
        threads: {
          key: 'threads',
          name: 'Message Threads',
          description: 'Grouped thread reply messages.',
          status: 'available',
        },
        reactions: {
          key: 'reactions',
          name: 'Reactions',
          description: 'Emoji reactions on exported messages.',
          status: 'available',
        },
        mentions: {
          key: 'mentions',
          name: 'Mentions',
          description: 'User @mentions in message text.',
          status: 'available',
        },
        files: {
          key: 'files',
          name: 'Files & Media',
          description: 'Attached files or external media URLs.',
          status: 'available',
        },
        file_links: {
          key: 'file_links',
          name: 'File Links',
          description: 'External file references.',
          status: 'available',
        },
        dms: {
          key: 'dms',
          name: 'Direct Messages',
          description: 'DMs (included only in Corporate Export packages).',
          status: hasDms ? 'available' : 'permission_required',
          reason: hasDms
            ? undefined
            : 'Corporate Export with eDiscovery permissions required for DMs.',
        },
        group_dms: {
          key: 'group_dms',
          name: 'Group Direct Messages',
          description: 'Group DMs (Corporate Export only).',
          status: hasDms ? 'available' : 'permission_required',
        },
        canvases: {
          key: 'canvases',
          name: 'Canvases',
          description: 'Extracted canvas documents in export package.',
          status: 'available',
        },
        lists: {
          key: 'lists',
          name: 'Lists',
          description: 'Lists in export package.',
          status: 'unsupported',
        },
      },
      workspace: {
        id: payload.workspace?.id ?? 'export_workspace',
        name: payload.workspace?.name ?? 'Slack Export Package',
        domain: payload.workspace?.domain,
      },
      connectedAccount: {
        id: 'export_importer',
        name: 'Export Package Import',
        isAdmin: true,
      },
      scopes: ['export:read', 'archive:extract'],
      canMigrate: hasChannels || hasUsers,
      blockers: hasChannels ? [] : ['Export package does not contain channels.json.'],
      warnings: hasPrivate
        ? []
        : ['Standard exports do not contain private channels or direct messages.'],
      checkedAt,
    };
  }

  async fetchWorkspaceMetadata(
    authOrConfig: string | Record<string, unknown>,
  ): Promise<SourceWorkspaceMetadata> {
    const exportId = typeof authOrConfig === 'string' ? authOrConfig : (authOrConfig.exportId as string);
    const payload = this.getPayload(exportId);
    return {
      id: payload.workspace?.id ?? 'slack_export_ws',
      name: payload.workspace?.name ?? 'Imported Slack Workspace',
      domain: payload.workspace?.domain,
    };
  }

  async fetchUsers(
    authOrConfig: string | Record<string, unknown>,
    _cursor?: string,
    _limit?: number,
  ): Promise<BatchResult<SourceUser>> {
    const exportId = typeof authOrConfig === 'string' ? authOrConfig : (authOrConfig.exportId as string);
    const payload = this.getPayload(exportId);
    const rawUsers = payload.users ?? [];

    const items: SourceUser[] = rawUsers.map((m: any) => ({
      id: m.id,
      name: m.name ?? m.real_name ?? 'User',
      realName: m.real_name,
      displayName: m.profile?.display_name || m.profile?.real_name || m.name,
      email: m.profile?.email,
      avatarUrl: m.profile?.image_192 || m.profile?.image_72,
      timezone: m.tz,
      isAdmin: Boolean(m.is_admin || m.is_owner || m.is_primary_owner),
      isOwner: Boolean(m.is_owner || m.is_primary_owner),
      isBot: Boolean(m.is_bot || m.id === 'USLACKBOT'),
      isDeleted: Boolean(m.deleted),
      raw: m,
    }));

    return { items, totalEstimate: items.length };
  }

  async fetchChannels(
    authOrConfig: string | Record<string, unknown>,
    scope: MigrationScope,
    _cursor?: string,
    _limit?: number,
  ): Promise<BatchResult<SourceChannel>> {
    const exportId = typeof authOrConfig === 'string' ? authOrConfig : (authOrConfig.exportId as string);
    const payload = this.getPayload(exportId);

    const publicChannels = payload.channels ?? [];
    const privateChannels = scope.includePrivateChannels ? payload.groups ?? [] : [];
    const dms = scope.includeDms ? payload.dms ?? [] : [];

    let combined = [...publicChannels, ...privateChannels, ...dms];
    if (scope.mode === 'selected' && scope.channelIds && scope.channelIds.length > 0) {
      const allowedSet = new Set(scope.channelIds);
      combined = combined.filter((c) => allowedSet.has(c.id));
    }

    const items: SourceChannel[] = combined.map((c: any) => ({
      id: c.id,
      name: c.name ?? (c.is_im ? `dm-${c.user}` : c.id),
      topic: c.topic?.value,
      purpose: c.purpose?.value,
      isPrivate: Boolean(c.is_private || c.is_group || c.is_im),
      isArchived: Boolean(c.is_archived),
      created: c.created,
      creatorId: c.creator,
      memberCount: c.members?.length ?? 0,
      raw: c,
    }));

    return { items, totalEstimate: items.length };
  }

  async fetchChannelMembers(
    authOrConfig: string | Record<string, unknown>,
    channelId: string,
  ): Promise<string[]> {
    const exportId = typeof authOrConfig === 'string' ? authOrConfig : (authOrConfig.exportId as string);
    const payload = this.getPayload(exportId);
    const channel = [...(payload.channels ?? []), ...(payload.groups ?? [])].find(
      (c) => c.id === channelId,
    );
    return channel?.members ?? [];
  }

  async fetchMessages(
    authOrConfig: string | Record<string, unknown>,
    channelId: string,
    _options: {
      cursor?: string;
      limit?: number;
      oldest?: string;
      latest?: string;
    },
  ): Promise<BatchResult<SourceMessage>> {
    const exportId = typeof authOrConfig === 'string' ? authOrConfig : (authOrConfig.exportId as string);
    const payload = this.getPayload(exportId);
    const rawMessages = payload.messagesByChannel?.[channelId] ?? [];

    const items: SourceMessage[] = rawMessages.map((m: any) => ({
      id: `${channelId}_${m.ts}`,
      channelId,
      userId: m.user ?? m.bot_id ?? 'unknown_sender',
      text: m.text ?? '',
      timestamp: m.ts,
      threadTs: m.thread_ts && m.thread_ts !== m.ts ? m.thread_ts : undefined,
      replyCount: m.reply_count,
      reactions: (m.reactions ?? []).map((r: any) => ({
        name: r.name,
        count: r.count,
        users: r.users ?? [],
      })),
      files: (m.files ?? []).map((f: any) => ({
        id: f.id,
        name: f.name ?? 'file',
        title: f.title,
        mimeType: f.mimetype ?? 'application/octet-stream',
        size: f.size ?? 0,
        urlPrivate: f.url_private_download || f.url_private,
        permalink: f.permalink,
        isExternal: Boolean(f.is_external),
      })),
      raw: m,
    }));

    return { items, totalEstimate: items.length };
  }

  async fetchThreadReplies(
    authOrConfig: string | Record<string, unknown>,
    channelId: string,
    threadTs: string,
  ): Promise<SourceMessage[]> {
    const exportId = typeof authOrConfig === 'string' ? authOrConfig : (authOrConfig.exportId as string);
    const payload = this.getPayload(exportId);
    const rawMessages = payload.messagesByChannel?.[channelId] ?? [];

    return rawMessages
      .filter((m) => m.thread_ts === threadTs && m.ts !== threadTs)
      .map((m: any) => ({
        id: `${channelId}_${m.ts}`,
        channelId,
        userId: m.user ?? m.bot_id ?? 'unknown_sender',
        text: m.text ?? '',
        timestamp: m.ts,
        threadTs,
        reactions: (m.reactions ?? []).map((r: any) => ({
          name: r.name,
          count: r.count,
          users: r.users ?? [],
        })),
        files: (m.files ?? []).map((f: any) => ({
          id: f.id,
          name: f.name ?? 'file',
          title: f.title,
          mimeType: f.mimetype ?? 'application/octet-stream',
          size: f.size ?? 0,
          urlPrivate: f.url_private_download || f.url_private,
          permalink: f.permalink,
          isExternal: Boolean(f.is_external),
        })),
        raw: m,
      }));
  }

  async fetchFiles(
    authOrConfig: string | Record<string, unknown>,
    _channelId?: string,
    _cursor?: string,
    _limit?: number,
  ): Promise<BatchResult<SourceFile>> {
    const exportId = typeof authOrConfig === 'string' ? authOrConfig : (authOrConfig.exportId as string);
    const payload = this.getPayload(exportId);
    const rawFiles = payload.files ?? [];

    const items: SourceFile[] = rawFiles.map((f: any) => ({
      id: f.id,
      name: f.name ?? 'file',
      title: f.title,
      mimeType: f.mimetype ?? 'application/octet-stream',
      size: f.size ?? 0,
      urlPrivate: f.url_private,
      permalink: f.permalink,
      isExternal: Boolean(f.is_external),
      userId: f.user,
      channels: f.channels ?? [],
    }));

    return { items, totalEstimate: items.length };
  }
}
