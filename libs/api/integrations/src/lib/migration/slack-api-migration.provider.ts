import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { MigrationCapabilityReport, MigrationScope } from '@org/types';
import axios, { type AxiosRequestConfig } from 'axios';
import { API_BASE } from '../providers/slack.provider.js';
import type {
  BatchResult,
  MigrationProvider,
  SourceChannel,
  SourceFile,
  SourceMessage,
  SourceUser,
  SourceWorkspaceMetadata,
} from './migration-provider.interface.js';
import { SlackCapabilityChecker } from './slack-capability-checker.service.js';

@Injectable()
export class SlackApiMigrationProvider implements MigrationProvider {
  readonly providerId = 'SLACK_API';
  readonly displayName = 'Slack Web API';
  private readonly logger = new Logger(SlackApiMigrationProvider.name);

  constructor(private readonly capabilityChecker: SlackCapabilityChecker) {}

  /**
   * Helper that executes a Slack API call with automated rate-limit backoff (HTTP 429).
   */
  private async executeWithRetry<T = any>(
    url: string,
    config: AxiosRequestConfig,
    maxRetries = 3,
  ): Promise<T> {
    let retries = 0;
    while (true) {
      try {
        const res = await axios(url, config);
        if (!res.data.ok) {
          if (res.data.error === 'ratelimited') {
            const retryAfterSec = Number(res.headers['retry-after'] ?? '3');
            this.logger.warn(
              `Slack API rate-limited on ${url}. Backing off for ${retryAfterSec}s...`,
            );
            await new Promise((resolve) => setTimeout(resolve, retryAfterSec * 1000));
            retries++;
            if (retries <= maxRetries) continue;
          }
          throw new BadRequestException(`Slack API call error: ${res.data.error}`);
        }
        return res.data;
      } catch (err: any) {
        if (err.response?.status === 429 && retries < maxRetries) {
          const retryAfterSec = Number(err.response.headers['retry-after'] ?? '3');
          this.logger.warn(
            `Slack API rate-limited (HTTP 429). Backing off for ${retryAfterSec}s...`,
          );
          await new Promise((resolve) => setTimeout(resolve, retryAfterSec * 1000));
          retries++;
          continue;
        }
        throw err;
      }
    }
  }

  async checkCapabilities(
    authOrConfig: string | Record<string, unknown>,
  ): Promise<MigrationCapabilityReport> {
    const token = typeof authOrConfig === 'string' ? authOrConfig : (authOrConfig.token as string);
    const scopes = typeof authOrConfig === 'object' ? (authOrConfig.scopes as string[]) : [];
    return this.capabilityChecker.checkCapabilities(token, scopes);
  }

  async fetchWorkspaceMetadata(
    authOrConfig: string | Record<string, unknown>,
  ): Promise<SourceWorkspaceMetadata> {
    const token = typeof authOrConfig === 'string' ? authOrConfig : (authOrConfig.token as string);
    const data = await this.executeWithRetry(`${API_BASE}/team.info`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    const team = data.team;
    return {
      id: team?.id ?? 'unknown_team',
      name: team?.name ?? 'Slack Workspace',
      domain: team?.domain,
      iconUrl: team?.icon?.image_132 || team?.icon?.image_88 || team?.icon?.image_68,
      enterpriseId: team?.enterprise_id,
    };
  }

  async fetchUsers(
    authOrConfig: string | Record<string, unknown>,
    cursor?: string,
    limit = 200,
  ): Promise<BatchResult<SourceUser>> {
    const token = typeof authOrConfig === 'string' ? authOrConfig : (authOrConfig.token as string);
    const data = await this.executeWithRetry(`${API_BASE}/users.list`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      params: {
        limit,
        cursor: cursor || undefined,
      },
    });

    const items: SourceUser[] = (data.members ?? []).map((m: any) => ({
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

    return {
      items,
      nextCursor: data.response_metadata?.next_cursor || undefined,
      totalEstimate: items.length,
    };
  }

  async fetchChannels(
    authOrConfig: string | Record<string, unknown>,
    scope: MigrationScope,
    cursor?: string,
    limit = 100,
  ): Promise<BatchResult<SourceChannel>> {
    const token = typeof authOrConfig === 'string' ? authOrConfig : (authOrConfig.token as string);
    const types: string[] = [];
    if (scope.includePublicChannels) types.push('public_channel');
    if (scope.includePrivateChannels) types.push('private_channel');
    if (scope.includeDms) types.push('im');
    if (scope.includeGroupDms) types.push('mpim');

    if (types.length === 0) types.push('public_channel');

    const data = await this.executeWithRetry(`${API_BASE}/conversations.list`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      params: {
        types: types.join(','),
        limit,
        cursor: cursor || undefined,
        exclude_archived: false,
      },
    });

    let channels: any[] = data.channels ?? [];
    if (scope.mode === 'selected' && scope.channelIds && scope.channelIds.length > 0) {
      const allowedSet = new Set(scope.channelIds);
      channels = channels.filter((c) => allowedSet.has(c.id));
    }

    const items: SourceChannel[] = channels.map((c: any) => ({
      id: c.id,
      name: c.name ?? (c.is_im ? `dm-${c.user}` : c.id),
      topic: c.topic?.value,
      purpose: c.purpose?.value,
      isPrivate: Boolean(c.is_private || c.is_im || c.is_mpim),
      isArchived: Boolean(c.is_archived),
      created: c.created,
      creatorId: c.creator,
      memberCount: c.num_members,
      raw: c,
    }));

    return {
      items,
      nextCursor: data.response_metadata?.next_cursor || undefined,
      totalEstimate: items.length,
    };
  }

  async fetchChannelMembers(
    authOrConfig: string | Record<string, unknown>,
    channelId: string,
  ): Promise<string[]> {
    const token = typeof authOrConfig === 'string' ? authOrConfig : (authOrConfig.token as string);
    const members: string[] = [];
    let cursor: string | undefined;

    do {
      const data = await this.executeWithRetry(`${API_BASE}/conversations.members`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        params: {
          channel: channelId,
          limit: 500,
          cursor: cursor || undefined,
        },
      });

      if (Array.isArray(data.members)) {
        members.push(...data.members);
      }
      cursor = data.response_metadata?.next_cursor || undefined;
    } while (cursor);

    return members;
  }

  async fetchMessages(
    authOrConfig: string | Record<string, unknown>,
    channelId: string,
    options: {
      cursor?: string;
      limit?: number;
      oldest?: string;
      latest?: string;
    },
  ): Promise<BatchResult<SourceMessage>> {
    const token = typeof authOrConfig === 'string' ? authOrConfig : (authOrConfig.token as string);
    const limit = options.limit ?? 100;

    const data = await this.executeWithRetry(`${API_BASE}/conversations.history`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      params: {
        channel: channelId,
        limit,
        cursor: options.cursor || undefined,
        oldest: options.oldest || undefined,
        latest: options.latest || undefined,
        inclusive: true,
      },
    });

    const items: SourceMessage[] = (data.messages ?? []).map((m: any) => ({
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
      edited: m.edited ? { user: m.edited.user, ts: m.edited.ts } : undefined,
      subtype: m.subtype,
      raw: m,
    }));

    return {
      items,
      nextCursor: data.response_metadata?.next_cursor || undefined,
      totalEstimate: items.length,
    };
  }

  async fetchThreadReplies(
    authOrConfig: string | Record<string, unknown>,
    channelId: string,
    threadTs: string,
  ): Promise<SourceMessage[]> {
    const token = typeof authOrConfig === 'string' ? authOrConfig : (authOrConfig.token as string);
    const replies: SourceMessage[] = [];
    let cursor: string | undefined;

    do {
      const data = await this.executeWithRetry(`${API_BASE}/conversations.replies`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        params: {
          channel: channelId,
          ts: threadTs,
          limit: 200,
          cursor: cursor || undefined,
        },
      });

      const list: SourceMessage[] = (data.messages ?? []).map((m: any) => ({
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

      // Filter out root message if already fetched
      replies.push(...list.filter((r) => r.timestamp !== threadTs));
      cursor = data.response_metadata?.next_cursor || undefined;
    } while (cursor);

    return replies;
  }

  async fetchFiles(
    authOrConfig: string | Record<string, unknown>,
    channelId?: string,
    cursor?: string,
    limit = 100,
  ): Promise<BatchResult<SourceFile>> {
    const token = typeof authOrConfig === 'string' ? authOrConfig : (authOrConfig.token as string);
    const page = cursor ? Number(cursor) : 1;

    const data = await this.executeWithRetry(`${API_BASE}/files.list`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      params: {
        channel: channelId || undefined,
        count: limit,
        page,
      },
    });

    const items: SourceFile[] = (data.files ?? []).map((f: any) => ({
      id: f.id,
      name: f.name ?? 'file',
      title: f.title,
      mimeType: f.mimetype ?? 'application/octet-stream',
      size: f.size ?? 0,
      urlPrivate: f.url_private_download || f.url_private,
      permalink: f.permalink,
      isExternal: Boolean(f.is_external),
      userId: f.user,
      timestamp: f.timestamp,
      channels: f.channels ?? [],
    }));

    const totalPages = data.paging?.pages ?? 1;
    const nextCursor = page < totalPages ? String(page + 1) : undefined;

    return {
      items,
      nextCursor,
      totalEstimate: data.paging?.total,
    };
  }
}
