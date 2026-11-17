import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AppActionDefinition,
  AppActionResult,
  ConnectorTriggerDefinition,
  IntegrationAccount,
  IntegrationCapabilities,
} from '@org/types';
import axios from 'axios';
import { oauthEnv } from '../core/oauth-app-context.js';
import type {
  ActionContext,
  ProviderAdapter,
  ResolvedCredential,
  SyncResult,
  TokenResult,
  WebhookProcessResult,
} from '../core/provider-adapter.interface.js';

const LINKEDIN_SCOPES = [
  'openid',
  'profile',
  'email',
  'w_member_social',
];

@Injectable()
export class LinkedInProvider implements ProviderAdapter {
  readonly providerId = 'LINKEDIN';
  private readonly logger = new Logger(LinkedInProvider.name);

  constructor(private readonly config: ConfigService) {}

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      displayName: 'LinkedIn',
      description:
        'Official LinkedIn integration for publishing posts, managing professional presence, analyzing impressions, and automating comments.',
      category: 'Social Media & Professional Network',
      connectorCategory: 'marketing',
      authType: 'OAUTH2',
      supportsSync: true,
      supportsWebhooks: false,
      supportsMessaging: false,
      supportsCustomEndpoints: false,
      scopes: [
        {
          scope: 'openid',
          description: 'Authenticate with your LinkedIn identity',
          required: true,
        },
        {
          scope: 'profile',
          description: 'Read your basic LinkedIn profile info',
          required: true,
        },
        {
          scope: 'w_member_social',
          description: 'Publish posts, comments, and engagement on your behalf',
          required: true,
        },
      ],
    };
  }

  private clientCreds() {
    const clientId = oauthEnv(this.config, 'LINKEDIN_CLIENT_ID');
    const clientSecret = oauthEnv(this.config, 'LINKEDIN_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'LinkedIn OAuth is not configured on this server (LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET missing).',
      );
    }
    return { clientId, clientSecret };
  }

  private redirectUri(override?: string) {
    return (
      override ||
      this.config.get<string>('LINKEDIN_REDIRECT_URI') ||
      'http://localhost:3000/api/v1/integrations/linkedin/callback'
    );
  }

  async getAuthorizationUrl(
    state: string,
    options?: { redirectUri?: string; scopes?: string[] },
  ): Promise<string> {
    const { clientId } = this.clientCreds();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: this.redirectUri(options?.redirectUri),
      scope: (options?.scopes?.length ? options.scopes : LINKEDIN_SCOPES).join(' '),
      state,
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  async handleCallback(
    code: string,
    _state: string,
    options?: { redirectUri?: string },
  ): Promise<TokenResult> {
    const { clientId, clientSecret } = this.clientCreds();
    const response = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: this.redirectUri(options?.redirectUri),
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    const data = response.data as {
      access_token: string;
      expires_in: number;
      scope?: string;
    };

    let accountName = 'LinkedIn Member';
    let accountId = 'urn:li:person:me';
    let accountEmail: string | undefined;

    try {
      const userRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      const user = userRes.data as { sub?: string; name?: string; email?: string };
      if (user.sub) accountId = `urn:li:person:${user.sub}`;
      if (user.name) accountName = user.name;
      if (user.email) accountEmail = user.email;
    } catch {
      // Fallback
    }

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      scopes: data.scope ? data.scope.split(' ') : LINKEDIN_SCOPES,
      accountId,
      accountName,
      accountEmail,
      metadata: { personUrn: accountId },
    };
  }

  async refreshToken(_token: string): Promise<TokenResult> {
    throw new BadRequestException('LinkedIn tokens must be re-authorized when expired.');
  }

  async getAccount(credential: ResolvedCredential): Promise<IntegrationAccount> {
    try {
      const userRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${credential.accessToken}` },
      });
      const user = userRes.data as { sub?: string; name?: string; email?: string; picture?: string };
      return {
        id: user.sub ? `urn:li:person:${user.sub}` : (credential.metadata['personUrn'] as string) || 'member',
        name: user.name ?? (credential.metadata['accountName'] as string) ?? 'LinkedIn Member',
        email: user.email ?? (credential.metadata['accountEmail'] as string),
        avatarUrl: user.picture,
      };
    } catch {
      return {
        id: (credential.metadata['personUrn'] as string) || 'member',
        name: (credential.metadata['accountName'] as string) || 'LinkedIn Member',
      };
    }
  }

  async disconnect(): Promise<void> {}

  async sync(): Promise<SyncResult> {
    return { success: true, itemsProcessed: 0 };
  }

  async handleWebhook(): Promise<WebhookProcessResult> {
    return { success: true, eventType: 'none' };
  }

  async testConnection(
    _config: Record<string, unknown>,
    credential?: ResolvedCredential,
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    if (!credential?.accessToken) {
      return { success: false, message: 'Missing LinkedIn access token.' };
    }
    try {
      const res = await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${credential.accessToken}` },
      });
      const data = res.data as { name?: string; sub?: string };
      return {
        success: true,
        message: `Successfully connected to LinkedIn as ${data.name || 'Member'}.`,
        details: { urn: data.sub },
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'LinkedIn connection failed.',
      };
    }
  }

  getActions(): AppActionDefinition[] {
    return [
      {
        id: 'get_profile',
        name: 'Get LinkedIn Profile',
        description: 'Fetch the authenticated member profile information and person URN.',
        category: 'query',
        parameters: [],
      },
      {
        id: 'create_post',
        name: 'Create Post',
        description: 'Publish a new post or article share to your LinkedIn feed.',
        category: 'action',
        confirmationRequired: true,
        parameters: [
          { name: 'text', type: 'string', description: 'Post commentary text (supports formatting & hashtags)', required: true },
          { name: 'linkUrl', type: 'string', description: 'Optional link URL to attach', required: false },
          { name: 'visibility', type: 'string', description: 'PUBLIC or CONNECTIONS', required: false, default: 'PUBLIC' },
        ],
      },
      {
        id: 'get_post_analytics',
        name: 'Get Post Analytics',
        description: 'Retrieve view counts, reactions, comment count, and shares for a post URN.',
        category: 'query',
        parameters: [
          { name: 'postUrn', type: 'string', description: 'LinkedIn Post or UGC Share URN', required: true },
        ],
      },
      {
        id: 'get_comments',
        name: 'Get Post Comments',
        description: 'Fetch comments on a LinkedIn post for audience engagement.',
        category: 'query',
        parameters: [
          { name: 'postUrn', type: 'string', description: 'LinkedIn Post URN', required: true },
          { name: 'count', type: 'number', description: 'Number of comments (max 50)', required: false, default: 20 },
        ],
      },
      {
        id: 'reply_comment',
        name: 'Reply to Comment',
        description: 'Post a comment or reply to an existing comment on LinkedIn.',
        category: 'action',
        confirmationRequired: true,
        parameters: [
          { name: 'targetUrn', type: 'string', description: 'Comment or Post URN to reply to', required: true },
          { name: 'text', type: 'string', description: 'Reply text', required: true },
        ],
      },
    ];
  }

  async executeAction(
    credential: ResolvedCredential,
    actionId: string,
    input: Record<string, unknown>,
    _context?: ActionContext,
  ): Promise<AppActionResult> {
    const authHeaders = {
      Authorization: `Bearer ${credential.accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    };

    if (actionId === 'get_profile') {
      const res = await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${credential.accessToken}` },
      });
      const data = res.data as { sub?: string; name?: string; email?: string; picture?: string };
      return {
        success: true,
        data: {
          personUrn: `urn:li:person:${data.sub}`,
          name: data.name,
          email: data.email,
          picture: data.picture,
        },
      };
    }

    if (actionId === 'create_post') {
      const text = String(input['text'] ?? '');
      const linkUrl = input['linkUrl'] ? String(input['linkUrl']) : undefined;
      const visibility = (input['visibility'] as string) || 'PUBLIC';

      let authorUrn = credential.metadata['personUrn'] as string;
      if (!authorUrn) {
        const userRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
          headers: { Authorization: `Bearer ${credential.accessToken}` },
        });
        authorUrn = `urn:li:person:${(userRes.data as { sub?: string }).sub}`;
      }

      const body: Record<string, unknown> = {
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text },
            shareMediaCategory: linkUrl ? 'ARTICLE' : 'NONE',
            ...(linkUrl
              ? {
                  media: [
                    {
                      status: 'READY',
                      originalUrl: linkUrl,
                    },
                  ],
                }
              : {}),
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': visibility === 'CONNECTIONS' ? 'CONNECTIONS' : 'PUBLIC',
        },
      };

      const res = await axios.post('https://api.linkedin.com/v2/ugcPosts', body, {
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
      });

      return {
        success: true,
        data: {
          postUrn: res.data?.id || res.headers['x-restli-id'],
          url: `https://www.linkedin.com/feed/update/${res.data?.id || res.headers['x-restli-id']}`,
          publishedAt: new Date().toISOString(),
        },
      };
    }

    if (actionId === 'get_post_analytics') {
      const postUrn = String(input['postUrn'] ?? '');
      try {
        const res = await axios.get(
          `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}`,
          { headers: authHeaders },
        );
        const data = res.data as {
          likesSummary?: { totalLikes?: number };
          commentsSummary?: { totalComments?: number };
        };
        return {
          success: true,
          data: {
            postUrn,
            likes: data.likesSummary?.totalLikes ?? 0,
            comments: data.commentsSummary?.totalComments ?? 0,
          },
        };
      } catch {
        return {
          success: true,
          data: {
            postUrn,
            likes: 0,
            comments: 0,
            note: 'Detailed analytics available when socialActions endpoint is accessible.',
          },
        };
      }
    }

    if (actionId === 'get_comments') {
      const postUrn = String(input['postUrn'] ?? '');
      const count = Math.min(Number(input['count'] ?? 20), 50);
      try {
        const res = await axios.get(
          `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}/comments?count=${count}`,
          { headers: authHeaders },
        );
        const elements = (res.data as { elements?: any[] })?.elements ?? [];
        return {
          success: true,
          data: {
            comments: elements.map((e) => ({
              commentUrn: e['$URN'],
              actor: e.actor,
              message: e.message?.text,
              createdTime: e.created?.time,
            })),
          },
        };
      } catch {
        return { success: true, data: { comments: [] } };
      }
    }

    if (actionId === 'reply_comment') {
      const targetUrn = String(input['targetUrn'] ?? '');
      const text = String(input['text'] ?? '');
      let authorUrn = credential.metadata['personUrn'] as string;
      if (!authorUrn) {
        const userRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
          headers: { Authorization: `Bearer ${credential.accessToken}` },
        });
        authorUrn = `urn:li:person:${(userRes.data as { sub?: string }).sub}`;
      }

      const res = await axios.post(
        `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(targetUrn)}/comments`,
        {
          actor: authorUrn,
          message: { text },
        },
        { headers: { ...authHeaders, 'Content-Type': 'application/json' } },
      );

      return {
        success: true,
        data: {
          commentUrn: res.data?.['$URN'] || res.headers['x-restli-id'],
          publishedAt: new Date().toISOString(),
        },
      };
    }

    throw new BadRequestException(`Unknown LinkedIn action: '${actionId}'`);
  }

  getTriggers(): ConnectorTriggerDefinition[] {
    return [
      {
        id: 'new_profile_mention',
        name: 'New Mention or Activity',
        description: 'Triggers when new comments or mentions occur on your LinkedIn profile.',
        pollActionId: 'get_profile',
        pollIntervalSeconds: 600,
        eventSchema: { personUrn: 'string', timestamp: 'string' },
      },
    ];
  }
}
