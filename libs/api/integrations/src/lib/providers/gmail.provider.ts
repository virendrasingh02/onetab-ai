import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AppActionDefinition,
  AppActionResult,
  IntegrationAccount,
  IntegrationCapabilities,
  IntegrationMessage,
  IntegrationThread,
  ReplyMessageInput,
  SendMessageInput,
} from '@org/types';
import axios from 'axios';
import type {
  MessageQuery,
  ProviderAdapter,
  ResolvedCredential,
  SyncResult,
  TokenResult,
  WebhookProcessResult,
} from '../core/provider-adapter.interface.js';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

@Injectable()
export class GmailProvider implements ProviderAdapter {
  readonly providerId = 'GMAIL';
  private readonly logger = new Logger(GmailProvider.name);

  constructor(private readonly config: ConfigService) {}

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      displayName: 'Gmail',
      description:
        'Read, search, organize, reply to, and send emails directly through Google Workspace and Gmail API.',
      category: 'Productivity & Project Management',
      authType: 'OAUTH2',
      supportsSync: true,
      supportsWebhooks: true,
      supportsMessaging: true,
      supportsCustomEndpoints: false,
      scopes: [
        {
          scope: 'https://www.googleapis.com/auth/gmail.readonly',
          description: 'View your email messages and settings',
          required: true,
        },
        {
          scope: 'https://www.googleapis.com/auth/gmail.send',
          description: 'Send email on your behalf',
          required: true,
        },
        {
          scope: 'https://www.googleapis.com/auth/gmail.modify',
          description: 'Manage drafts, labels, and read statuses',
          required: false,
        },
      ],
    };
  }

  async getAuthorizationUrl(
    state: string,
    options?: { redirectUri?: string; scopes?: string[]; loginHint?: string },
  ): Promise<string> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new BadRequestException('GOOGLE_CLIENT_ID is not configured.');
    }

    const redirectUri =
      options?.redirectUri ||
      this.config.get<string>('GOOGLE_REDIRECT_URI') ||
      'http://localhost:3000/api/v1/integrations/gmail/callback';

    const requestedScopes = options?.scopes?.length ? options.scopes : GMAIL_SCOPES;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: requestedScopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
      include_granted_scopes: 'true',
    });

    if (options?.loginHint) {
      params.append('login_hint', options.loginHint);
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleCallback(
    code: string,
    _state: string,
    options?: { redirectUri?: string },
  ): Promise<TokenResult> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri =
      options?.redirectUri ||
      this.config.get<string>('GOOGLE_REDIRECT_URI') ||
      'http://localhost:3000/api/v1/integrations/gmail/callback';

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Google OAuth client credentials are not configured.');
    }

    try {
      const tokenResponse = await axios.post<{
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        scope: string;
        token_type: string;
      }>(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      const { access_token, refresh_token, expires_in, scope } = tokenResponse.data;
      const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

      // Fetch user profile from Google
      const profileResponse = await axios.get<{
        id: string;
        email: string;
        name: string;
        picture?: string;
      }>('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      return {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in,
        tokenExpiresAt,
        scopes: scope ? scope.split(' ') : GMAIL_SCOPES,
        accountId: profileResponse.data.id || profileResponse.data.email,
        accountEmail: profileResponse.data.email,
        accountName: profileResponse.data.name,
        metadata: {
          picture: profileResponse.data.picture,
          email: profileResponse.data.email,
        },
      };
    } catch (err: any) {
      this.logger.error(
        `Gmail OAuth token exchange failed: ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`,
      );
      throw new UnauthorizedException(
        err.response?.data?.error_description || 'Failed to exchange OAuth authorization code.',
      );
    }
  }

  async refreshToken(refreshToken: string): Promise<TokenResult> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Google OAuth client credentials are not configured.');
    }

    try {
      const response = await axios.post<{
        access_token: string;
        expires_in: number;
        scope?: string;
      }>(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in,
        tokenExpiresAt: new Date(Date.now() + response.data.expires_in * 1000),
        scopes: response.data.scope ? response.data.scope.split(' ') : undefined,
      };
    } catch (err: any) {
      this.logger.error(
        `Gmail refresh token request failed: ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`,
      );
      throw new UnauthorizedException('Failed to refresh Gmail access token. Authorization may have been revoked.');
    }
  }

  async getAccount(credential: ResolvedCredential): Promise<IntegrationAccount> {
    const profile = await this.executeWithAuth(credential, async (token) => {
      const res = await axios.get<{
        emailAddress: string;
        messagesTotal: number;
        threadsTotal: number;
        historyId: string;
      }>('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    });

    return {
      id: credential.id,
      provider: this.providerId,
      accountId: profile.emailAddress,
      email: profile.emailAddress,
      name: (credential.metadata['accountName'] as string) || profile.emailAddress,
      avatarUrl: credential.metadata['picture'] as string,
      scopes: credential.scopes,
      status: 'CONNECTED',
      connectedAt: new Date().toISOString(),
      metadata: {
        messagesTotal: profile.messagesTotal,
        threadsTotal: profile.threadsTotal,
        historyId: profile.historyId,
      },
    };
  }

  async disconnect(credential: ResolvedCredential): Promise<void> {
    if (credential.accessToken) {
      try {
        await axios.post(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(credential.accessToken)}`,
          {},
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        );
      } catch (err: any) {
        this.logger.warn(`Google token revocation notice: ${err.message}`);
      }
    }
  }

  async testConnection(
    _config: Record<string, unknown>,
    credential?: ResolvedCredential,
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    if (!credential) {
      return { success: false, message: 'No credential provided for Gmail connection test.' };
    }
    try {
      const account = await this.getAccount(credential);
      return {
        success: true,
        message: `Successfully connected to Gmail account ${account.email}`,
        details: account,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Gmail connection test failed: ${err.message}`,
      };
    }
  }

  async getMessages(
    credential: ResolvedCredential,
    query?: MessageQuery,
  ): Promise<{ messages: IntegrationMessage[]; nextPageToken?: string }> {
    return this.executeWithAuth(credential, async (token) => {
      const params: Record<string, string | number> = {
        maxResults: query?.maxResults ?? 20,
      };
      if (query?.query) params['q'] = query.query;
      if (query?.pageToken) params['pageToken'] = query.pageToken;
      if (query?.includeSpamTrash) params['includeSpamTrash'] = 'true';
      if (query?.labelIds?.length) params['labelIds'] = query.labelIds.join(',');

      const listRes = await axios.get<{
        messages?: Array<{ id: string; threadId: string }>;
        nextPageToken?: string;
        resultSizeEstimate?: number;
      }>('https://gmail.googleapis.com/gmail/v1/users/me/messages', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      if (!listRes.data.messages || listRes.data.messages.length === 0) {
        return { messages: [], nextPageToken: undefined };
      }

      // Fetch message details in batch
      const messageDetails = await Promise.all(
        listRes.data.messages.slice(0, 20).map(async (msg) => {
          try {
            const detailRes = await axios.get(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            return this.parseGmailMessage(detailRes.data, credential.id);
          } catch (err) {
            this.logger.warn(`Failed to fetch message ${msg.id}: ${err instanceof Error ? err.message : String(err)}`);
            return null;
          }
        }),
      );

      const validMessages = messageDetails.filter(
        (m): m is IntegrationMessage => m !== null,
      );

      return {
        messages: validMessages,
        nextPageToken: listRes.data.nextPageToken,
      };
    });
  }

  async getThread(
    credential: ResolvedCredential,
    threadId: string,
  ): Promise<IntegrationThread> {
    return this.executeWithAuth(credential, async (token) => {
      const res = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const threadData = res.data;
      const parsedMessages = (threadData.messages || []).map((msg: any) =>
        this.parseGmailMessage(msg, credential.id),
      );

      const participantsMap = new Map<string, { name?: string; email: string }>();
      for (const msg of parsedMessages) {
        if (msg.from?.email) participantsMap.set(msg.from.email, msg.from);
        for (const recipient of msg.to) {
          if (recipient.email) participantsMap.set(recipient.email, recipient);
        }
      }

      const lastMessage = parsedMessages[parsedMessages.length - 1];

      return {
        id: threadData.id,
        provider: this.providerId,
        integrationId: credential.id,
        snippet: threadData.snippet || lastMessage?.snippet || '',
        historyId: threadData.historyId,
        messageCount: parsedMessages.length,
        messages: parsedMessages,
        participants: Array.from(participantsMap.values()),
        lastMessageDate: lastMessage?.date || new Date().toISOString(),
        isUnread: parsedMessages.some((m: IntegrationMessage) => !m.isRead),
      };
    });
  }

  async sendMessage(
    credential: ResolvedCredential,
    message: SendMessageInput,
  ): Promise<IntegrationMessage> {
    return this.executeWithAuth(credential, async (token) => {
      const rawMime = this.buildMimeMessage(message);
      const encodedMessage = Buffer.from(rawMime, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await axios.post(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        { raw: encodedMessage },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      );

      const sentMsg = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${res.data.id}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      return this.parseGmailMessage(sentMsg.data, credential.id);
    });
  }

  async replyMessage(
    credential: ResolvedCredential,
    reply: ReplyMessageInput,
  ): Promise<IntegrationMessage> {
    return this.executeWithAuth(credential, async (token) => {
      const rawMime = this.buildMimeMessage(reply, {
        threadId: reply.threadId,
        inReplyTo: reply.inReplyToMessageId,
        references: reply.inReplyToMessageId,
      });

      const encodedMessage = Buffer.from(rawMime, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await axios.post(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        { raw: encodedMessage, threadId: reply.threadId },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      );

      const sentMsg = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${res.data.id}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      return this.parseGmailMessage(sentMsg.data, credential.id);
    });
  }

  async createDraft(
    credential: ResolvedCredential,
    draft: SendMessageInput,
  ): Promise<IntegrationMessage> {
    return this.executeWithAuth(credential, async (token) => {
      const rawMime = this.buildMimeMessage(draft);
      const encodedMessage = Buffer.from(rawMime, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await axios.post(
        'https://gmail.googleapis.com/gmail/v1/users/me/drafts',
        { message: { raw: encodedMessage } },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      );

      return this.parseGmailMessage(res.data.message, credential.id);
    });
  }

  async modifyMessageLabels(
    credential: ResolvedCredential,
    messageId: string,
    addLabelIds: string[] = [],
    removeLabelIds: string[] = [],
  ): Promise<IntegrationMessage> {
    return this.executeWithAuth(credential, async (token) => {
      const res = await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
        { addLabelIds, removeLabelIds },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      );

      return this.parseGmailMessage(res.data, credential.id);
    });
  }

  /**
   * The four actions below are a discoverable façade over the messaging
   * methods already implemented above (`sendMessage`, `replyMessage`,
   * `createDraft`, `modifyMessageLabels`) — no new Gmail logic, just metadata
   * (`inputSchema`, `permissionLevel`, `requiresConfirmation`) a chat
   * conversation can use to list and gate them.
   */
  getActions(): AppActionDefinition[] {
    return [
      {
        id: 'send_message',
        label: 'Send email',
        description: 'Send a new email from the connected Gmail account.',
        inputSchema: {
          type: 'object',
          properties: {
            to: {
              type: 'array',
              items: { type: 'string' },
              description: 'Recipient email addresses.',
            },
            subject: { type: 'string' },
            bodyText: { type: 'string' },
          },
          required: ['to', 'subject', 'bodyText'],
        },
        permissionLevel: 'write',
        requiresConfirmation: true,
      },
      {
        id: 'reply_message',
        label: 'Reply to email',
        description: 'Reply within an existing Gmail thread.',
        inputSchema: {
          type: 'object',
          properties: {
            threadId: { type: 'string' },
            inReplyToMessageId: { type: 'string' },
            to: { type: 'array', items: { type: 'string' } },
            subject: { type: 'string' },
            bodyText: { type: 'string' },
          },
          required: [
            'threadId',
            'inReplyToMessageId',
            'to',
            'subject',
            'bodyText',
          ],
        },
        permissionLevel: 'write',
        requiresConfirmation: true,
      },
      {
        id: 'create_draft',
        label: 'Save draft',
        description: 'Save an email as a draft without sending it.',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'array', items: { type: 'string' } },
            subject: { type: 'string' },
            bodyText: { type: 'string' },
          },
          required: ['to', 'subject', 'bodyText'],
        },
        permissionLevel: 'write',
        requiresConfirmation: false,
      },
      {
        id: 'modify_labels',
        label: 'Update labels',
        description:
          'Add or remove labels on a message (e.g. archive, mark read).',
        inputSchema: {
          type: 'object',
          properties: {
            messageId: { type: 'string' },
            addLabelIds: { type: 'array', items: { type: 'string' } },
            removeLabelIds: { type: 'array', items: { type: 'string' } },
          },
          required: ['messageId'],
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
    switch (actionId) {
      case 'send_message': {
        const message = await this.sendMessage(credential, {
          to: this.parseRecipients(input['to']),
          subject: String(input['subject'] ?? ''),
          bodyText: input['bodyText'] ? String(input['bodyText']) : undefined,
          bodyHtml: input['bodyHtml'] ? String(input['bodyHtml']) : undefined,
        });
        return {
          success: true,
          message: `Email sent to ${message.to.map((recipient) => recipient.email).join(', ')}.`,
          data: message,
        };
      }
      case 'reply_message': {
        const message = await this.replyMessage(credential, {
          threadId: String(input['threadId'] ?? ''),
          inReplyToMessageId: String(input['inReplyToMessageId'] ?? ''),
          to: this.parseRecipients(input['to']),
          subject: String(input['subject'] ?? ''),
          bodyText: input['bodyText'] ? String(input['bodyText']) : undefined,
          bodyHtml: input['bodyHtml'] ? String(input['bodyHtml']) : undefined,
        });
        return { success: true, message: 'Reply sent.', data: message };
      }
      case 'create_draft': {
        const message = await this.createDraft(credential, {
          to: this.parseRecipients(input['to']),
          subject: String(input['subject'] ?? ''),
          bodyText: input['bodyText'] ? String(input['bodyText']) : undefined,
          bodyHtml: input['bodyHtml'] ? String(input['bodyHtml']) : undefined,
        });
        return { success: true, message: 'Draft saved.', data: message };
      }
      case 'modify_labels': {
        const message = await this.modifyMessageLabels(
          credential,
          String(input['messageId'] ?? ''),
          this.parseStringArray(input['addLabelIds']),
          this.parseStringArray(input['removeLabelIds']),
        );
        return { success: true, message: 'Labels updated.', data: message };
      }
      default:
        throw new BadRequestException(`Unknown Gmail action '${actionId}'.`);
    }
  }

  private parseRecipients(value: unknown): string[] {
    if (Array.isArray(value)) return value.map((entry) => String(entry));
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    return [];
  }

  private parseStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
  }

  async sync(
    credential: ResolvedCredential,
    cursor?: string,
  ): Promise<SyncResult> {
    const list = await this.getMessages(credential, {
      pageToken: cursor,
      maxResults: 50,
    });

    return {
      success: true,
      itemsProcessed: list.messages.length,
      newCursor: list.nextPageToken,
      hasMore: Boolean(list.nextPageToken),
      syncedMessages: list.messages,
    };
  }

  async handleWebhook(
    payload: unknown,
    _headers: Record<string, string>,
  ): Promise<WebhookProcessResult> {
    this.logger.log(`Received Gmail push notification: ${JSON.stringify(payload)}`);
    return {
      success: true,
      eventType: 'gmail.mailbox.updated',
      data: payload,
    };
  }

  // --- Helper Methods --------------------------------------------------------

  private async executeWithAuth<T>(
    credential: ResolvedCredential,
    fn: (token: string) => Promise<T>,
  ): Promise<T> {
    try {
      return await fn(credential.accessToken);
    } catch (err: any) {
      if (err.response?.status === 401 && credential.refreshToken) {
        this.logger.log(`Gmail token expired, refreshing for integration ${credential.id}`);
        const refreshed = await this.refreshToken(credential.refreshToken);
        credential.accessToken = refreshed.accessToken;
        return await fn(refreshed.accessToken);
      }
      throw err;
    }
  }

  private parseGmailMessage(raw: any, integrationId: string): IntegrationMessage {
    const headers: Record<string, string> = {};
    if (raw.payload?.headers) {
      for (const h of raw.payload.headers) {
        headers[h.name.toLowerCase()] = h.value;
      }
    }

    const parseAddress = (str?: string): { name?: string; email: string } => {
      if (!str) return { email: '' };
      const match = str.match(/(.*)<(.*)>/);
      if (match && match[1] && match[2]) {
        return { name: match[1].trim().replace(/^["']|["']$/g, ''), email: match[2].trim() };
      }
      return { email: str.trim() };
    };

    const parseAddressList = (str?: string): Array<{ name?: string; email: string }> => {
      if (!str) return [];
      return str.split(',').map((part) => parseAddress(part.trim())).filter((a) => a.email);
    };

    let bodyText = '';
    let bodyHtml = '';

    const extractBody = (part: any) => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyText += Buffer.from(part.body.data, 'base64').toString('utf8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        bodyHtml += Buffer.from(part.body.data, 'base64').toString('utf8');
      }
      if (part.parts) {
        for (const subPart of part.parts) extractBody(subPart);
      }
    };

    if (raw.payload) {
      extractBody(raw.payload);
    }

    const labels: string[] = raw.labelIds || [];
    const isRead = !labels.includes('UNREAD');
    const isStarred = labels.includes('STARRED');

    const internalDate = raw.internalDate
      ? new Date(Number.parseInt(raw.internalDate, 10)).toISOString()
      : headers['date']
        ? new Date(headers['date']).toISOString()
        : new Date().toISOString();

    return {
      id: raw.id,
      provider: this.providerId,
      integrationId,
      threadId: raw.threadId,
      from: parseAddress(headers['from']),
      to: parseAddressList(headers['to']),
      cc: parseAddressList(headers['cc']),
      bcc: parseAddressList(headers['bcc']),
      subject: headers['subject'] || '(No Subject)',
      snippet: raw.snippet,
      bodyText: bodyText || raw.snippet || '',
      bodyHtml: bodyHtml || undefined,
      date: internalDate,
      isRead,
      isStarred,
      labels,
      metadata: {
        historyId: raw.historyId,
        sizeEstimate: raw.sizeEstimate,
      },
    };
  }

  private buildMimeMessage(
    input: SendMessageInput,
    extraHeaders: Record<string, string> = {},
  ): string {
    const formatAddresses = (
      addrs?: Array<{ name?: string; email: string }> | string[],
    ): string => {
      if (!addrs || addrs.length === 0) return '';
      return addrs
        .map((a) => {
          if (typeof a === 'string') return a;
          return a.name ? `"${a.name}" <${a.email}>` : a.email;
        })
        .join(', ');
    };

    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const lines: string[] = [
      `To: ${formatAddresses(input.to)}`,
      `Subject: =?UTF-8?B?${Buffer.from(input.subject, 'utf8').toString('base64')}?=`,
    ];

    if (input.cc && (Array.isArray(input.cc) ? input.cc.length > 0 : false)) {
      lines.push(`Cc: ${formatAddresses(input.cc)}`);
    }
    if (input.bcc && (Array.isArray(input.bcc) ? input.bcc.length > 0 : false)) {
      lines.push(`Bcc: ${formatAddresses(input.bcc)}`);
    }

    if (extraHeaders['inReplyTo']) {
      lines.push(`In-Reply-To: <${extraHeaders['inReplyTo']}>`);
    }
    if (extraHeaders['references']) {
      lines.push(`References: <${extraHeaders['references']}>`);
    }

    lines.push('MIME-Version: 1.0');
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    lines.push('');

    // Plain text version
    if (input.bodyText) {
      lines.push(`--${boundary}`);
      lines.push('Content-Type: text/plain; charset=UTF-8');
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('');
      lines.push(Buffer.from(input.bodyText, 'utf8').toString('base64'));
    }

    // HTML version
    if (input.bodyHtml) {
      lines.push(`--${boundary}`);
      lines.push('Content-Type: text/html; charset=UTF-8');
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('');
      lines.push(Buffer.from(input.bodyHtml, 'utf8').toString('base64'));
    }

    lines.push(`--${boundary}--`);
    return lines.join('\r\n');
  }
}
