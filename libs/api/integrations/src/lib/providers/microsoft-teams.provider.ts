import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AppActionDefinition,
  ConnectorTriggerDefinition,
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

export const TEAMS_SCOPES = [
  'User.Read',
  'Team.ReadBasic.All',
  'Channel.ReadBasic.All',
  'ChannelMessage.Read.All',
  'ChannelMessage.Send',
  'ChatMessage.Read',
  'ChatMessage.Send',
  'OnlineMeetings.ReadWrite',
  'offline_access',
];

export const MS_GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

export async function teamsCall<T = any>(
  endpoint: string,
  token: string,
  params: Record<string, unknown> = {},
  httpMethod: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  data?: unknown,
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${MS_GRAPH_API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    const res = await axios({
      url,
      method: httpMethod,
      headers,
      params: httpMethod === 'GET' ? params : undefined,
      data: httpMethod !== 'GET' ? (data ?? params) : undefined,
    });
    return res.data;
  } catch (err: any) {
    if (axios.isAxiosError(err) && err.response) {
      const status = err.response.status;
      const errorMsg =
        err.response.data?.error?.message ||
        err.response.data?.error_description ||
        err.message;

      if (status === 401) {
        throw new UnauthorizedException(
          `Microsoft Teams authorization expired: ${errorMsg}`,
        );
      }
      throw new BadRequestException(`Microsoft Teams API error (${endpoint}): ${errorMsg}`);
    }
    throw new BadRequestException(`Failed to connect to Microsoft Teams: ${err.message}`);
  }
}

@Injectable()
export class MicrosoftTeamsProvider implements ProviderAdapter {
  readonly providerId = 'MICROSOFT_TEAMS';
  private readonly logger = new Logger(MicrosoftTeamsProvider.name);

  constructor(private readonly config: ConfigService) {}

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      displayName: 'Microsoft Teams',
      description:
        'Connect your Microsoft Teams organization to collaborate, send channel alerts and direct messages, search threads, schedule online meetings, and listen to event triggers.',
      category: 'Communication',
      connectorCategory: 'communication',
      authType: 'OAUTH2',
      supportsSync: true,
      supportsWebhooks: true,
      supportsMessaging: true,
      supportsCustomEndpoints: false,
      scopes: [
        { scope: 'Team.ReadBasic.All', description: 'Read basic team properties and settings', required: true },
        { scope: 'Channel.ReadBasic.All', description: 'Read channels inside teams', required: true },
        { scope: 'ChannelMessage.Read.All', description: 'Read channel conversations and threads', required: false },
        { scope: 'ChannelMessage.Send', description: 'Send messages to channels on behalf of the agent', required: true },
        { scope: 'ChatMessage.Read', description: 'Read 1-on-1 and group chats', required: false },
        { scope: 'ChatMessage.Send', description: 'Send direct messages and group chat notifications', required: false },
        { scope: 'OnlineMeetings.ReadWrite', description: 'Schedule and manage Teams online meetings', required: false },
      ],
    };
  }

  private clientCreds() {
    const clientId =
      this.config.get<string>('MICROSOFT_TEAMS_CLIENT_ID') ||
      this.config.get<string>('AZURE_CLIENT_ID');
    const clientSecret =
      this.config.get<string>('MICROSOFT_TEAMS_CLIENT_SECRET') ||
      this.config.get<string>('AZURE_CLIENT_SECRET');

    return {
      clientId: clientId ?? '',
      clientSecret: clientSecret ?? '',
      isConfigured: Boolean(clientId && clientSecret),
    };
  }

  private redirectUri(override?: string) {
    return (
      override ||
      this.config.get<string>('MICROSOFT_TEAMS_REDIRECT_URI') ||
      'http://localhost:3000/api/v1/integrations/microsoft_teams/callback'
    );
  }

  async getAuthorizationUrl(
    state: string,
    options?: { redirectUri?: string; scopes?: string[] },
  ): Promise<string> {
    const { clientId, isConfigured } = this.clientCreds();
    if (!isConfigured) {
      throw new BadRequestException('Microsoft Teams isn’t set up on this server (MICROSOFT_TEAMS_CLIENT_ID / MICROSOFT_TEAMS_CLIENT_SECRET, or AZURE_CLIENT_ID / AZURE_CLIENT_SECRET, are missing). Register an Azure app and set them to connect Teams.');
    }
    const scopesToRequest = options?.scopes || TEAMS_SCOPES;
    const tenant = this.config.get<string>('AZURE_TENANT_ID') || 'common';
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri(options?.redirectUri),
      response_mode: 'query',
      scope: scopesToRequest.join(' '),
      state,
    });
    return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async handleCallback(
    code: string,
    _state: string,
    options?: { redirectUri?: string },
  ): Promise<TokenResult> {
    const { clientId, clientSecret, isConfigured } = this.clientCreds();
    const tenant = this.config.get<string>('AZURE_TENANT_ID') || 'common';

    if (!isConfigured) {
      throw new BadRequestException('Microsoft Teams isn’t set up on this server (MICROSOFT_TEAMS_CLIENT_ID / MICROSOFT_TEAMS_CLIENT_SECRET, or AZURE_CLIENT_ID / AZURE_CLIENT_SECRET, are missing). Register an Azure app and set them to connect Teams.');
    }

    try {
      const res = await axios.post(
        `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: this.redirectUri(options?.redirectUri),
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      const tokenData = res.data;
      const expiresIn = tokenData.expires_in ?? 3600;

      // Fetch user profile from Graph API
      let accountInfo: { id?: string; mail?: string; displayName?: string } = {};
      try {
        accountInfo = await teamsCall('/me', tokenData.access_token);
      } catch {
        // Fallback if /me profile call fails
      }

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn,
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        scopes: tokenData.scope ? tokenData.scope.split(' ') : TEAMS_SCOPES,
        accountId: accountInfo.id,
        accountEmail: accountInfo.mail,
        accountName: accountInfo.displayName,
        metadata: { tenantId: tenant },
      };
    } catch (err: any) {
      const msg = err.response?.data?.error_description || err.message;
      throw new BadRequestException(`Failed to exchange Microsoft Teams authorization code: ${msg}`);
    }
  }

  async refreshToken(refreshToken: string): Promise<TokenResult> {
    const { clientId, clientSecret, isConfigured } = this.clientCreds();
    const tenant = this.config.get<string>('AZURE_TENANT_ID') || 'common';

    if (!isConfigured) {
      throw new BadRequestException('Microsoft Teams isn’t set up on this server (MICROSOFT_TEAMS_CLIENT_ID / MICROSOFT_TEAMS_CLIENT_SECRET, or AZURE_CLIENT_ID / AZURE_CLIENT_SECRET, are missing). Register an Azure app and set them to connect Teams.');
    }

    try {
      const res = await axios.post(
        `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      const tokenData = res.data;
      const expiresIn = tokenData.expires_in ?? 3600;

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token ?? refreshToken,
        expiresIn,
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      };
    } catch (err: any) {
      throw new UnauthorizedException(
        `Microsoft Teams token refresh failed: ${err.response?.data?.error_description || err.message}`,
      );
    }
  }

  async getAccount(credential: ResolvedCredential): Promise<IntegrationAccount> {
    const me = await teamsCall<{ id: string; userPrincipalName?: string; mail?: string; displayName?: string }>(
      '/me',
      credential.accessToken,
    );

    return {
      id: credential.id,
      provider: this.providerId,
      accountId: me.id,
      email: me.mail || me.userPrincipalName,
      name: me.displayName,
      avatarUrl: undefined,
      scopes: credential.scopes,
      status: 'CONNECTED',
      connectedAt: new Date().toISOString(),
      metadata: credential.metadata,
    };
  }

  async disconnect(_credential: ResolvedCredential): Promise<void> {
    this.logger.log(`Disconnected Microsoft Teams integration ${_credential.id}`);
  }

  async testConnection(
    _config: Record<string, unknown>,
    credential?: ResolvedCredential,
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    if (!credential) {
      return { success: false, message: 'No credentials provided for Microsoft Teams connection test.' };
    }

    try {
      const account = await this.getAccount(credential);
      return {
        success: true,
        message: `Successfully connected to Microsoft Teams as ${account.name || account.email}.`,
        details: account,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Microsoft Teams connection test failed: ${err.message}`,
      };
    }
  }

  async sync(credential: ResolvedCredential, _cursor?: string): Promise<SyncResult> {
    try {
      const teams = await teamsCall<{ value: any[] }>('/me/joinedTeams', credential.accessToken);
      return {
        success: true,
        itemsProcessed: teams.value?.length || 0,
        totalItems: teams.value?.length || 0,
        hasMore: false,
        metadata: { teamsCount: teams.value?.length || 0 },
      };
    } catch (err: any) {
      this.logger.warn(`Teams sync warning: ${err.message}`);
      return {
        success: false,
        itemsProcessed: 0,
      };
    }
  }

  async handleWebhook(
    payload: unknown,
    _headers: Record<string, string>,
    _secret?: string,
  ): Promise<WebhookProcessResult> {
    const body = payload as Record<string, any>;
    // Graph notification verification handshake (validationToken in query)
    if (body?.validationToken) {
      return {
        success: true,
        eventType: 'handshake',
        data: body.validationToken,
      };
    }

    const value = Array.isArray(body?.value) ? body.value[0] : body;
    const resource = value?.resource || '';

    let eventType = 'new_message';
    if (resource.includes('meetings') || resource.includes('onlineMeetings')) {
      eventType = 'meeting_event';
    } else if (resource.includes('mentions') || JSON.stringify(body).includes('mention')) {
      eventType = 'mention';
    }

    return {
      success: true,
      eventType,
      eventId: value?.clientState || value?.subscriptionId,
      data: value,
    };
  }

  /**
   * The 14 structured actions exposed by Microsoft Teams connector
   * matching specification Section 59.
   */
  isServerConfigured(): boolean {
    return this.clientCreds().isConfigured;
  }

  getActions(): AppActionDefinition[] {
    return [
      {
        id: 'list_teams',
        label: 'List Teams',
        description: 'Retrieves all Microsoft Teams joined or accessible by the user.',
        inputSchema: {
          type: 'object',
          properties: {
            maxResults: { type: 'number', description: 'Maximum teams to return (default 50)' },
          },
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'get_team',
        label: 'Get Team',
        description: 'Fetches metadata, settings, and description for a specific Team.',
        inputSchema: {
          type: 'object',
          required: ['teamId'],
          properties: {
            teamId: { type: 'string', description: 'The unique Microsoft Teams ID' },
          },
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_channels',
        label: 'List Channels',
        description: 'Lists all channels (standard and private) inside a Team.',
        inputSchema: {
          type: 'object',
          required: ['teamId'],
          properties: {
            teamId: { type: 'string', description: 'Team ID to inspect channels for' },
          },
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'get_channel',
        label: 'Get Channel',
        description: 'Gets details, topic, and membership type of a channel.',
        inputSchema: {
          type: 'object',
          required: ['teamId', 'channelId'],
          properties: {
            teamId: { type: 'string', description: 'Team ID' },
            channelId: { type: 'string', description: 'Channel ID' },
          },
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'get_members',
        label: 'Get Members',
        description: 'Retrieves member list and roles for a specific Team or Channel.',
        inputSchema: {
          type: 'object',
          required: ['teamId'],
          properties: {
            teamId: { type: 'string', description: 'Team ID' },
            channelId: { type: 'string', description: 'Optional channel ID to filter channel members' },
          },
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'send_channel_message',
        label: 'Send Channel Message',
        description: 'Posts a formatted message or card to a Microsoft Teams channel.',
        inputSchema: {
          type: 'object',
          required: ['teamId', 'channelId', 'content'],
          properties: {
            teamId: { type: 'string', description: 'Target Team ID' },
            channelId: { type: 'string', description: 'Target Channel ID' },
            content: { type: 'string', description: 'Message body content (supports markdown or HTML)' },
            subject: { type: 'string', description: 'Optional message topic subject' },
            contentType: { type: 'string', enum: ['text', 'html', 'markdown'], default: 'text' },
          },
        },
        permissionLevel: 'write',
        requiresConfirmation: false,
      },
      {
        id: 'send_direct_message',
        label: 'Send Direct Message',
        description: 'Sends a direct 1-on-1 message or group chat notification to a user.',
        inputSchema: {
          type: 'object',
          required: ['userId', 'content'],
          properties: {
            userId: { type: 'string', description: 'Recipient user email or Azure Object ID' },
            content: { type: 'string', description: 'Message body text' },
          },
        },
        permissionLevel: 'write',
        requiresConfirmation: false,
      },
      {
        id: 'search_messages',
        label: 'Search Messages',
        description: 'Searches messages across channels and chats by keywords or query.',
        inputSchema: {
          type: 'object',
          required: ['query'],
          properties: {
            query: { type: 'string', description: 'Search keywords or phrases' },
            maxResults: { type: 'number', description: 'Max results to return (default 25)' },
          },
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_channel_messages',
        label: 'List Channel Messages',
        description: 'Fetches the most recent messages posted in a Teams channel (for summarizing or watching).',
        inputSchema: {
          type: 'object',
          required: ['teamId', 'channelId'],
          properties: {
            teamId: { type: 'string', description: 'Team ID' },
            channelId: { type: 'string', description: 'Channel ID' },
            maxResults: { type: 'number', description: 'How many messages (max 50)' },
          },
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'get_message',
        label: 'Get Message',
        description: 'Retrieves a single message by ID from a channel or chat.',
        inputSchema: {
          type: 'object',
          required: ['teamId', 'channelId', 'messageId'],
          properties: {
            teamId: { type: 'string', description: 'Team ID' },
            channelId: { type: 'string', description: 'Channel ID' },
            messageId: { type: 'string', description: 'Message ID' },
          },
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'reply_to_message',
        label: 'Reply to Message',
        description: 'Replies in the thread of an existing channel message.',
        inputSchema: {
          type: 'object',
          required: ['teamId', 'channelId', 'messageId', 'content'],
          properties: {
            teamId: { type: 'string', description: 'Team ID' },
            channelId: { type: 'string', description: 'Channel ID' },
            messageId: { type: 'string', description: 'Parent message ID to reply to' },
            content: { type: 'string', description: 'Thread reply text' },
          },
        },
        permissionLevel: 'write',
        requiresConfirmation: false,
      },
      {
        id: 'create_meeting',
        label: 'Create Meeting',
        description: 'Schedules a Microsoft Teams online meeting with video bridge and join URL.',
        inputSchema: {
          type: 'object',
          required: ['subject', 'startDateTime', 'endDateTime'],
          properties: {
            subject: { type: 'string', description: 'Meeting title/subject' },
            startDateTime: { type: 'string', description: 'Start time in ISO 8601 format' },
            endDateTime: { type: 'string', description: 'End time in ISO 8601 format' },
            participants: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of attendee email addresses',
            },
            isOnlineMeeting: { type: 'boolean', default: true },
          },
        },
        permissionLevel: 'write',
        requiresConfirmation: false,
      },
      {
        id: 'get_meeting',
        label: 'Get Meeting',
        description: 'Retrieves details, join link, and attendee status for an online meeting.',
        inputSchema: {
          type: 'object',
          required: ['meetingId'],
          properties: {
            meetingId: { type: 'string', description: 'Microsoft Teams online meeting ID' },
          },
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'update_meeting',
        label: 'Update Meeting',
        description: 'Updates time, subject, or participants for a scheduled meeting.',
        inputSchema: {
          type: 'object',
          required: ['meetingId'],
          properties: {
            meetingId: { type: 'string', description: 'Meeting ID to update' },
            subject: { type: 'string', description: 'New subject title' },
            startDateTime: { type: 'string', description: 'New start timestamp' },
            endDateTime: { type: 'string', description: 'New end timestamp' },
          },
        },
        permissionLevel: 'write',
        requiresConfirmation: false,
      },
      {
        id: 'cancel_meeting',
        label: 'Cancel Meeting',
        description: 'Cancels an existing Microsoft Teams online meeting.',
        inputSchema: {
          type: 'object',
          required: ['meetingId'],
          properties: {
            meetingId: { type: 'string', description: 'Meeting ID to cancel' },
            comment: { type: 'string', description: 'Cancellation reason note sent to attendees' },
          },
        },
        permissionLevel: 'destructive',
        requiresConfirmation: true,
      },
    ];
  }

  /**
   * Triggers supported by Microsoft Teams
   */
  getTriggers(): ConnectorTriggerDefinition[] {
    return [
      {
        id: 'new_message',
        label: 'New channel message',
        description: 'Starts the agent for each new message posted in a Teams channel.',
        pollActionId: 'list_channel_messages',
        defaultInput: { maxResults: 20 },
        itemsPath: 'messages',
        idField: 'id',
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
      case 'list_teams': {
        const res = await teamsCall<{ value: any[] }>('/me/joinedTeams', token);
        return {
          success: true,
          message: `Retrieved ${res.value?.length || 0} teams.`,
          data: { teams: res.value || [] },
        };
      }

      case 'get_team': {
        const teamId = String(input['teamId']);
        const res = await teamsCall(`/teams/${teamId}`, token);
        return {
          success: true,
          message: `Retrieved team ${res.displayName || teamId}.`,
          data: { team: res },
        };
      }

      case 'list_channels': {
        const teamId = String(input['teamId']);
        const res = await teamsCall<{ value: any[] }>(`/teams/${teamId}/channels`, token);
        return {
          success: true,
          message: `Retrieved ${res.value?.length || 0} channels.`,
          data: { channels: res.value || [] },
        };
      }

      case 'get_channel': {
        const teamId = String(input['teamId']);
        const channelId = String(input['channelId']);
        const res = await teamsCall(`/teams/${teamId}/channels/${channelId}`, token);
        return {
          success: true,
          message: `Retrieved channel ${res.displayName || channelId}.`,
          data: { channel: res },
        };
      }

      case 'get_members': {
        const teamId = String(input['teamId']);
        const channelId = input['channelId'] ? String(input['channelId']) : null;
        const endpoint = channelId
          ? `/teams/${teamId}/channels/${channelId}/members`
          : `/teams/${teamId}/members`;
        const res = await teamsCall<{ value: any[] }>(endpoint, token);
        return {
          success: true,
          message: `Found ${res.value?.length || 0} members.`,
          data: { members: res.value || [] },
        };
      }

      case 'send_channel_message': {
        const teamId = String(input['teamId']);
        const channelId = String(input['channelId']);
        const content = String(input['content']);
        const subject = input['subject'] ? String(input['subject']) : undefined;
        const contentType = input['contentType'] === 'html' ? 'html' : 'text';

        const bodyPayload: Record<string, any> = {
          body: {
            contentType,
            content,
          },
        };
        if (subject) bodyPayload['subject'] = subject;

        const res = await teamsCall(
          `/teams/${teamId}/channels/${channelId}/messages`,
          token,
          {},
          'POST',
          bodyPayload,
        );

        return {
          success: true,
          message: 'Message delivered to Microsoft Teams channel successfully.',
          data: {
            messageId: res.id,
            teamId,
            channelId,
            createdDateTime: res.createdDateTime,
            webUrl: res.webUrl,
          },
        };
      }

      case 'send_direct_message': {
        const userId = String(input['userId']);
        const content = String(input['content']);

        // 1. Create or get 1-on-1 chat
        const chatRes = await teamsCall(
          '/chats',
          token,
          {},
          'POST',
          {
            chatType: 'oneOnOne',
            members: [
              {
                '@odata.type': '#microsoft.graph.aadUserConversationMember',
                roles: ['owner'],
                'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${userId}')`,
              },
            ],
          },
        );

        const chatId = chatRes.id;
        const msgRes = await teamsCall(
          `/chats/${chatId}/messages`,
          token,
          {},
          'POST',
          {
            body: { contentType: 'text', content },
          },
        );

        return {
          success: true,
          message: `Direct message sent to user ${userId}.`,
          data: {
            chatId,
            messageId: msgRes.id,
          },
        };
      }

      case 'search_messages': {
        const query = String(input['query'] ?? '').trim();
        if (!query) throw new BadRequestException('Search needs a query.');
        const size = Math.min(Number(input['maxResults']) || 25, 50);
        // Teams chat and channel messages are searched through the Microsoft
        // Search API (`chatMessage`); `/me/messages` would be the Outlook mailbox.
        const res = await teamsCall<{ value?: Array<{ hitsContainers?: Array<{ hits?: Array<{ hitId?: string; summary?: string; resource?: Record<string, unknown> }> }> }> }>(
          '/search/query',
          token,
          {},
          'POST',
          { requests: [{ entityTypes: ['chatMessage'], query: { queryString: query }, from: 0, size }] },
        );
        const messages = (res.value ?? [])
          .flatMap((v) => v.hitsContainers ?? [])
          .flatMap((c) => c.hits ?? [])
          .map((hit) => ({ id: hit.hitId, summary: hit.summary, ...(hit.resource ?? {}) }));
        return {
          success: true,
          message: `Found ${messages.length} Teams message(s) matching "${query}".`,
          data: { messages, count: messages.length },
        };
      }

      case 'list_channel_messages': {
        const teamId = String(input['teamId'] ?? '');
        const channelId = String(input['channelId'] ?? '');
        if (!teamId || !channelId) throw new BadRequestException('Pick a team and a channel.');
        const res = await teamsCall<{ value?: any[] }>(
          `/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages`,
          token,
          { $top: Math.min(Number(input['maxResults']) || 20, 50) },
        );
        const messages = (res.value ?? []).filter((m) => m.messageType === 'message' || !m.messageType);
        return {
          success: true,
          message: `Found ${messages.length} message(s).`,
          data: { messages },
        };
      }

      case 'get_message': {
        const teamId = String(input['teamId']);
        const channelId = String(input['channelId']);
        const messageId = String(input['messageId']);
        const res = await teamsCall(
          `/teams/${teamId}/channels/${channelId}/messages/${messageId}`,
          token,
        );
        return {
          success: true,
          message: 'Fetched Teams message.',
          data: { message: res },
        };
      }

      case 'reply_to_message': {
        const teamId = String(input['teamId']);
        const channelId = String(input['channelId']);
        const messageId = String(input['messageId']);
        const content = String(input['content']);

        const res = await teamsCall(
          `/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`,
          token,
          {},
          'POST',
          {
            body: { contentType: 'text', content },
          },
        );

        return {
          success: true,
          message: 'Thread reply posted.',
          data: {
            replyId: res.id,
            parentMessageId: messageId,
            createdDateTime: res.createdDateTime,
          },
        };
      }

      case 'create_meeting': {
        const subject = String(input['subject']);
        const startDateTime = String(input['startDateTime']);
        const endDateTime = String(input['endDateTime']);

        const res = await teamsCall(
          '/me/onlineMeetings',
          token,
          {},
          'POST',
          {
            subject,
            startDateTime,
            endDateTime,
          },
        );

        return {
          success: true,
          message: `Teams meeting "${subject}" scheduled successfully.`,
          data: {
            meetingId: res.id,
            joinWebUrl: res.joinWebUrl,
            subject: res.subject,
            startDateTime: res.startDateTime,
            endDateTime: res.endDateTime,
            videoTeleconferenceId: res.videoTeleconferenceId,
          },
        };
      }

      case 'get_meeting': {
        const meetingId = String(input['meetingId']);
        const res = await teamsCall(`/me/onlineMeetings/${meetingId}`, token);
        return {
          success: true,
          message: `Retrieved meeting details for ${res.subject || meetingId}.`,
          data: { meeting: res },
        };
      }

      case 'update_meeting': {
        const meetingId = String(input['meetingId']);
        const patchData: Record<string, any> = {};
        if (input['subject']) patchData['subject'] = input['subject'];
        if (input['startDateTime']) patchData['startDateTime'] = input['startDateTime'];
        if (input['endDateTime']) patchData['endDateTime'] = input['endDateTime'];

        const res = await teamsCall(
          `/me/onlineMeetings/${meetingId}`,
          token,
          {},
          'PATCH',
          patchData,
        );

        return {
          success: true,
          message: `Meeting ${meetingId} updated successfully.`,
          data: { meeting: res },
        };
      }

      case 'cancel_meeting': {
        const meetingId = String(input['meetingId']);
        await teamsCall(
          `/me/onlineMeetings/${meetingId}`,
          token,
          {},
          'DELETE',
        );

        return {
          success: true,
          message: `Meeting ${meetingId} has been cancelled.`,
          data: { meetingId, cancelled: true },
        };
      }

      default:
        throw new BadRequestException(`Unknown Microsoft Teams action '${actionId}'.`);
    }
  }

}
