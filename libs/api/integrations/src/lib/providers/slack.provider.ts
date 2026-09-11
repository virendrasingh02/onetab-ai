import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AppActionDefinition,
  AppActionResult,
  IntegrationAccount,
  IntegrationCapabilities,
} from '@org/types';
import axios from 'axios';
import type {
  ProviderAdapter,
  ResolvedCredential,
  SyncResult,
  TokenResult,
  WebhookProcessResult,
} from '../core/provider-adapter.interface.js';

const USER_SCOPES = [
  'channels:read',
  'channels:history',
  'groups:read',
  'groups:history',
  'im:read',
  'im:history',
  'mpim:read',
  'mpim:history',
  'chat:write',
  'search:read',
  'users:read',
  'reactions:write',
];

const API_BASE = 'https://slack.com/api';

async function slackCall<T = any>(
  method: string,
  token: string,
  params: Record<string, unknown> = {},
  httpMethod: 'GET' | 'POST' = 'POST',
): Promise<T> {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' };
  const res =
    httpMethod === 'GET'
      ? await axios.get(`${API_BASE}/${method}`, { headers, params })
      : await axios.post(`${API_BASE}/${method}`, params, { headers });

  if (!res.data.ok) {
    if (res.data.error === 'invalid_auth' || res.data.error === 'token_revoked') {
      throw new UnauthorizedException(`Slack authorization is no longer valid (${res.data.error}).`);
    }
    throw new BadRequestException(`Slack API error (${method}): ${res.data.error}`);
  }
  return res.data;
}

@Injectable()
export class SlackProvider implements ProviderAdapter {
  readonly providerId = 'SLACK';
  private readonly logger = new Logger(SlackProvider.name);

  constructor(private readonly config: ConfigService) {}

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      displayName: 'Slack',
      description:
        'Search and read channels, DMs, and threads, and post messages in your connected Slack workspace.',
      category: 'Customer Support & Communication',
      authType: 'OAUTH2',
      supportsSync: true,
      supportsWebhooks: true,
      supportsMessaging: true,
      supportsCustomEndpoints: false,
      scopes: [
        { scope: 'channels:history', description: 'Read messages in public channels you are in', required: true },
        { scope: 'search:read', description: 'Search messages across your workspace', required: true },
        { scope: 'chat:write', description: 'Post messages on your behalf', required: false },
      ],
    };
  }

  private clientCreds() {
    const clientId = this.config.get<string>('SLACK_CLIENT_ID');
    const clientSecret = this.config.get<string>('SLACK_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'Slack OAuth is not configured on this server (SLACK_CLIENT_ID / SLACK_CLIENT_SECRET missing). ' +
          'An administrator must create a Slack app at api.slack.com/apps first.',
      );
    }
    return { clientId, clientSecret };
  }

  private redirectUri(override?: string) {
    return (
      override ||
      this.config.get<string>('SLACK_REDIRECT_URI') ||
      'http://localhost:3000/api/v1/integrations/slack/callback'
    );
  }

  async getAuthorizationUrl(state: string, options?: { redirectUri?: string }): Promise<string> {
    const { clientId } = this.clientCreds();
    const params = new URLSearchParams({
      client_id: clientId,
      user_scope: USER_SCOPES.join(','),
      redirect_uri: this.redirectUri(options?.redirectUri),
      state,
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  async handleCallback(
    code: string,
    _state: string,
    options?: { redirectUri?: string },
  ): Promise<TokenResult> {
    const { clientId, clientSecret } = this.clientCreds();
    try {
      const res = await axios.post(
        `${API_BASE}/oauth.v2.access`,
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: this.redirectUri(options?.redirectUri),
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      if (!res.data.ok) {
        throw new UnauthorizedException(`Slack rejected the authorization code (${res.data.error}).`);
      }

      const authedUser = res.data.authed_user;
      if (!authedUser?.access_token) {
        throw new UnauthorizedException('Slack did not grant a user token — re-authorize with the requested scopes.');
      }

      const identity = await slackCall('users.identity', authedUser.access_token, {}, 'GET').catch(() => null);

      return {
        accessToken: authedUser.access_token,
        refreshToken: authedUser.refresh_token,
        expiresIn: authedUser.expires_in,
        tokenExpiresAt: authedUser.expires_in ? new Date(Date.now() + authedUser.expires_in * 1000) : undefined,
        scopes: authedUser.scope ? authedUser.scope.split(',') : USER_SCOPES,
        accountId: authedUser.id,
        accountEmail: identity?.user?.email,
        accountName: identity?.user?.name,
        metadata: {
          teamId: res.data.team?.id,
          teamName: res.data.team?.name,
          picture: identity?.user?.image_72,
        },
      };
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.error(`Slack OAuth token exchange failed: ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`);
      throw new UnauthorizedException('Failed to exchange Slack authorization code.');
    }
  }

  async refreshToken(refreshToken: string): Promise<TokenResult> {
    const { clientId, clientSecret } = this.clientCreds();
    const res = await axios.post(
      `${API_BASE}/oauth.v2.access`,
      new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: refreshToken }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    if (!res.data.ok) throw new UnauthorizedException(`Slack token refresh failed (${res.data.error}).`);
    return {
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
      expiresIn: res.data.expires_in,
      tokenExpiresAt: res.data.expires_in ? new Date(Date.now() + res.data.expires_in * 1000) : undefined,
    };
  }

  async getAccount(credential: ResolvedCredential): Promise<IntegrationAccount> {
    const identity = await slackCall('users.identity', credential.accessToken, {}, 'GET');
    return {
      id: credential.id,
      provider: this.providerId,
      accountId: identity.user.id,
      email: identity.user.email,
      name: identity.user.name,
      avatarUrl: identity.user.image_72,
      scopes: credential.scopes,
      status: 'CONNECTED',
      connectedAt: new Date().toISOString(),
      metadata: { teamName: identity.team?.name },
    };
  }

  async disconnect(credential: ResolvedCredential): Promise<void> {
    try {
      await slackCall('auth.revoke', credential.accessToken, {}, 'GET');
    } catch (err: any) {
      this.logger.warn(`Slack token revocation notice: ${err.message}`);
    }
  }

  async testConnection(
    _config: Record<string, unknown>,
    credential?: ResolvedCredential,
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    if (!credential) return { success: false, message: 'No credential provided for Slack connection test.' };
    try {
      const account = await this.getAccount(credential);
      return { success: true, message: `Successfully connected to Slack as ${account.name}`, details: account };
    } catch (err: any) {
      return { success: false, message: `Slack connection test failed: ${err.message}` };
    }
  }

  async sync(credential: ResolvedCredential): Promise<SyncResult> {
    const res = await slackCall('conversations.list', credential.accessToken, { types: 'public_channel,private_channel', limit: 50 }, 'GET');
    return { success: true, itemsProcessed: res.channels?.length ?? 0 };
  }

  async handleWebhook(payload: unknown): Promise<WebhookProcessResult> {
    const type = (payload as any)?.type || 'event_callback';
    if (type === 'url_verification') {
      return { success: true, eventType: 'slack.url_verification', data: { challenge: (payload as any).challenge } };
    }
    return { success: true, eventType: `slack.${type}`, data: payload };
  }

  getActions(): AppActionDefinition[] {
    return [
      {
        id: 'list_channels',
        label: 'List channels',
        description: 'List public and private channels you are a member of.',
        inputSchema: { type: 'object', properties: { maxResults: { type: 'number' } } },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_dms',
        label: 'List direct messages',
        description: 'List your direct message and group DM conversations.',
        inputSchema: { type: 'object', properties: {} },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'get_channel',
        label: 'Get channel details',
        description: 'Fetch details (topic, purpose, member count) for one channel.',
        inputSchema: { type: 'object', properties: { channelId: { type: 'string' } }, required: ['channelId'] },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_messages',
        label: 'List channel messages',
        description: 'Fetch recent messages from a channel (for summarizing).',
        inputSchema: {
          type: 'object',
          properties: { channelId: { type: 'string' }, maxResults: { type: 'number' } },
          required: ['channelId'],
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'get_thread',
        label: 'Get thread replies',
        description: 'Fetch all replies in a message thread.',
        inputSchema: {
          type: 'object',
          properties: { channelId: { type: 'string' }, threadTs: { type: 'string' } },
          required: ['channelId', 'threadTs'],
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'search_messages',
        label: 'Search messages',
        description:
          'Search messages across the workspace. Supports Slack search operators (from:@user, in:#channel, before:, after:).',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'send_message',
        label: 'Send message',
        description: 'Post a new message in a channel or DM.',
        inputSchema: {
          type: 'object',
          properties: { channelId: { type: 'string' }, text: { type: 'string' } },
          required: ['channelId', 'text'],
        },
        permissionLevel: 'write',
        requiresConfirmation: true,
      },
      {
        id: 'reply_in_thread',
        label: 'Reply in thread',
        description: 'Post a reply within an existing message thread.',
        inputSchema: {
          type: 'object',
          properties: { channelId: { type: 'string' }, threadTs: { type: 'string' }, text: { type: 'string' } },
          required: ['channelId', 'threadTs', 'text'],
        },
        permissionLevel: 'write',
        requiresConfirmation: true,
      },
      {
        id: 'add_reaction',
        label: 'Add reaction',
        description: 'Add an emoji reaction to a message.',
        inputSchema: {
          type: 'object',
          properties: { channelId: { type: 'string' }, timestamp: { type: 'string' }, emoji: { type: 'string' } },
          required: ['channelId', 'timestamp', 'emoji'],
        },
        permissionLevel: 'write',
        requiresConfirmation: false,
      },
    ];
  }

  async executeAction(
    credential: ResolvedCredential,
    actionId: string,
    input: Record<string, unknown>,
  ): Promise<AppActionResult> {
    const token = credential.accessToken;

    switch (actionId) {
      case 'list_channels': {
        const res = await slackCall(
          'conversations.list',
          token,
          { types: 'public_channel,private_channel', limit: num(input['maxResults']) ?? 50, exclude_archived: true },
          'GET',
        );
        return { success: true, message: `Found ${res.channels.length} channel(s).`, data: { channels: res.channels } };
      }
      case 'list_dms': {
        const res = await slackCall('conversations.list', token, { types: 'im,mpim', limit: 50 }, 'GET');
        return { success: true, message: `Found ${res.channels.length} conversation(s).`, data: { conversations: res.channels } };
      }
      case 'get_channel': {
        const res = await slackCall('conversations.info', token, { channel: input['channelId'] }, 'GET');
        return { success: true, message: `Fetched #${res.channel.name}.`, data: { channel: res.channel } };
      }
      case 'list_messages': {
        const res = await slackCall(
          'conversations.history',
          token,
          { channel: input['channelId'], limit: num(input['maxResults']) ?? 50 },
          'GET',
        );
        return { success: true, message: `Found ${res.messages.length} message(s).`, data: { messages: res.messages } };
      }
      case 'get_thread': {
        const res = await slackCall('conversations.replies', token, { channel: input['channelId'], ts: input['threadTs'] }, 'GET');
        return { success: true, message: `Found ${res.messages.length} message(s) in thread.`, data: { messages: res.messages } };
      }
      case 'search_messages': {
        const res = await slackCall('search.messages', token, { query: input['query'], count: 30 }, 'GET');
        return {
          success: true,
          message: `Found ${res.messages?.total ?? 0} matching message(s).`,
          data: { messages: res.messages?.matches ?? [] },
        };
      }
      case 'send_message': {
        const res = await slackCall('chat.postMessage', token, { channel: input['channelId'], text: input['text'] });
        return { success: true, message: 'Message sent.', data: { message: res.message, ts: res.ts } };
      }
      case 'reply_in_thread': {
        const res = await slackCall('chat.postMessage', token, {
          channel: input['channelId'],
          thread_ts: input['threadTs'],
          text: input['text'],
        });
        return { success: true, message: 'Reply sent.', data: { message: res.message, ts: res.ts } };
      }
      case 'add_reaction': {
        await slackCall('reactions.add', token, {
          channel: input['channelId'],
          timestamp: input['timestamp'],
          name: String(input['emoji'] ?? '').replace(/:/g, ''),
        });
        return { success: true, message: 'Reaction added.' };
      }
      default:
        throw new BadRequestException(`Unknown Slack action '${actionId}'.`);
    }
  }
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}
