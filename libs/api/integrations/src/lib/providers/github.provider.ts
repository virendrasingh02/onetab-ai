import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AppActionDefinition,
  AppActionResult,
  IntegrationAccount,
  IntegrationCapabilities,
} from '@org/types';
import axios from 'axios';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  ProviderAdapter,
  ResolvedCredential,
  SyncResult,
  TokenResult,
  WebhookProcessResult,
} from '../core/provider-adapter.interface.js';

const GITHUB_SCOPES = ['repo', 'read:user', 'notifications'];
const API_BASE = 'https://api.github.com';

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

@Injectable()
export class GitHubProvider implements ProviderAdapter {
  readonly providerId = 'GITHUB';
  private readonly logger = new Logger(GitHubProvider.name);

  constructor(private readonly config: ConfigService) {}

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      displayName: 'GitHub',
      description:
        'Repositories, issues, pull requests, commits, releases, and notifications — read and act on real GitHub data.',
      category: 'Developer Tools',
      authType: 'OAUTH2',
      supportsSync: true,
      supportsWebhooks: true,
      supportsMessaging: false,
      supportsCustomEndpoints: false,
      scopes: [
        { scope: 'repo', description: 'Read and write access to your repositories', required: true },
        { scope: 'read:user', description: 'Read your GitHub profile', required: true },
        { scope: 'notifications', description: 'Read your GitHub notifications', required: false },
      ],
    };
  }

  private clientCreds() {
    const clientId = this.config.get<string>('GITHUB_CLIENT_ID');
    const clientSecret = this.config.get<string>('GITHUB_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'GitHub OAuth is not configured on this server (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET missing). ' +
          'An administrator must register an OAuth App at github.com/settings/developers first.',
      );
    }
    return { clientId, clientSecret };
  }

  private redirectUri(override?: string) {
    return (
      override ||
      this.config.get<string>('GITHUB_REDIRECT_URI') ||
      'http://localhost:3000/api/v1/integrations/github/callback'
    );
  }

  async getAuthorizationUrl(
    state: string,
    options?: { redirectUri?: string; scopes?: string[] },
  ): Promise<string> {
    const { clientId } = this.clientCreds();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.redirectUri(options?.redirectUri),
      scope: (options?.scopes?.length ? options.scopes : GITHUB_SCOPES).join(' '),
      state,
      allow_signup: 'true',
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async handleCallback(
    code: string,
    _state: string,
    options?: { redirectUri?: string },
  ): Promise<TokenResult> {
    const { clientId, clientSecret } = this.clientCreds();
    try {
      const tokenRes = await axios.post<{
        access_token: string;
        scope: string;
        token_type: string;
        error?: string;
        error_description?: string;
      }>(
        'https://github.com/login/oauth/access_token',
        {
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: this.redirectUri(options?.redirectUri),
        },
        { headers: { Accept: 'application/json' } },
      );

      if (tokenRes.data.error || !tokenRes.data.access_token) {
        throw new UnauthorizedException(
          tokenRes.data.error_description || 'GitHub rejected the authorization code.',
        );
      }

      const accessToken = tokenRes.data.access_token;
      const profile = await axios.get<{ id: number; login: string; name?: string; email?: string; avatar_url?: string }>(
        `${API_BASE}/user`,
        { headers: ghHeaders(accessToken) },
      );

      return {
        accessToken,
        // Classic GitHub OAuth App tokens do not expire and have no refresh token.
        scopes: tokenRes.data.scope ? tokenRes.data.scope.split(',') : GITHUB_SCOPES,
        accountId: String(profile.data.id),
        accountEmail: profile.data.email ?? undefined,
        accountName: profile.data.name || profile.data.login,
        metadata: { login: profile.data.login, avatarUrl: profile.data.avatar_url },
      };
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.error(`GitHub OAuth token exchange failed: ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`);
      throw new UnauthorizedException('Failed to exchange GitHub authorization code.');
    }
  }

  async getAccount(credential: ResolvedCredential): Promise<IntegrationAccount> {
    const res = await axios.get<{ id: number; login: string; name?: string; avatar_url?: string }>(
      `${API_BASE}/user`,
      { headers: ghHeaders(credential.accessToken) },
    );
    return {
      id: credential.id,
      provider: this.providerId,
      accountId: String(res.data.id),
      email: (credential.metadata['accountEmail'] as string) || undefined,
      name: res.data.name || res.data.login,
      avatarUrl: res.data.avatar_url,
      scopes: credential.scopes,
      status: 'CONNECTED',
      connectedAt: new Date().toISOString(),
      metadata: { login: res.data.login },
    };
  }

  async disconnect(credential: ResolvedCredential): Promise<void> {
    try {
      const { clientId, clientSecret } = this.clientCreds();
      await axios.delete(`${API_BASE}/applications/${clientId}/token`, {
        auth: { username: clientId, password: clientSecret },
        data: { access_token: credential.accessToken },
        headers: { Accept: 'application/vnd.github+json' },
      });
    } catch (err: any) {
      this.logger.warn(`GitHub token revocation notice: ${err.message}`);
    }
  }

  async testConnection(
    _config: Record<string, unknown>,
    credential?: ResolvedCredential,
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    if (!credential) return { success: false, message: 'No credential provided for GitHub connection test.' };
    try {
      const account = await this.getAccount(credential);
      return { success: true, message: `Successfully connected to GitHub as ${account.metadata?.['login']}`, details: account };
    } catch (err: any) {
      return { success: false, message: `GitHub connection test failed: ${err.message}` };
    }
  }

  async sync(credential: ResolvedCredential): Promise<SyncResult> {
    const res = await axios.get(`${API_BASE}/user/repos`, {
      headers: ghHeaders(credential.accessToken),
      params: { sort: 'updated', per_page: 25 },
    });
    return { success: true, itemsProcessed: (res.data as unknown[]).length };
  }

  async handleWebhook(
    payload: unknown,
    headers: Record<string, string>,
    secret?: string,
  ): Promise<WebhookProcessResult> {
    if (secret) {
      const signature = headers['x-hub-signature-256'];
      if (!signature) return { success: false, eventType: 'github.unverified', shouldRetry: false };
      const expected = `sha256=${createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex')}`;
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        this.logger.warn('GitHub webhook signature verification failed.');
        return { success: false, eventType: 'github.invalid_signature', shouldRetry: false };
      }
    }
    const eventType = headers['x-github-event'] || 'github.event';
    return { success: true, eventType: `github.${eventType}`, data: payload };
  }

  getActions(): AppActionDefinition[] {
    return [
      {
        id: 'list_repos',
        label: 'List repositories',
        description: 'List repositories you have access to, most recently updated first.',
        inputSchema: { type: 'object', properties: { maxResults: { type: 'number' } } },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_branches',
        label: 'List branches',
        description: 'List branches on a repository.',
        inputSchema: {
          type: 'object',
          properties: { repo: { type: 'string', description: 'owner/repo' } },
          required: ['repo'],
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_issues',
        label: 'List issues',
        description: 'List issues on a repository (excludes pull requests).',
        inputSchema: {
          type: 'object',
          properties: {
            repo: { type: 'string', description: 'owner/repo' },
            state: { type: 'string', enum: ['open', 'closed', 'all'] },
          },
          required: ['repo'],
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'get_issue',
        label: 'Get issue',
        description: 'Fetch one issue by number.',
        inputSchema: {
          type: 'object',
          properties: { repo: { type: 'string' }, issueNumber: { type: 'number' } },
          required: ['repo', 'issueNumber'],
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'create_issue',
        label: 'Create issue',
        description: 'Open a new issue on a repository.',
        inputSchema: {
          type: 'object',
          properties: {
            repo: { type: 'string' },
            title: { type: 'string' },
            body: { type: 'string' },
            labels: { type: 'array', items: { type: 'string' } },
          },
          required: ['repo', 'title'],
        },
        permissionLevel: 'write',
        requiresConfirmation: true,
      },
      {
        id: 'comment_on_issue',
        label: 'Comment on issue',
        description: 'Post a comment on an issue or pull request.',
        inputSchema: {
          type: 'object',
          properties: { repo: { type: 'string' }, issueNumber: { type: 'number' }, body: { type: 'string' } },
          required: ['repo', 'issueNumber', 'body'],
        },
        permissionLevel: 'write',
        requiresConfirmation: true,
      },
      {
        id: 'list_pull_requests',
        label: 'List pull requests',
        description: 'List pull requests on a repository.',
        inputSchema: {
          type: 'object',
          properties: { repo: { type: 'string' }, state: { type: 'string', enum: ['open', 'closed', 'all'] } },
          required: ['repo'],
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'get_pull_request',
        label: 'Get pull request',
        description: 'Fetch one pull request by number, including review/merge state.',
        inputSchema: {
          type: 'object',
          properties: { repo: { type: 'string' }, prNumber: { type: 'number' } },
          required: ['repo', 'prNumber'],
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_review_requests',
        label: 'Pull requests awaiting my review',
        description: 'Search for open pull requests where you are requested as a reviewer.',
        inputSchema: { type: 'object', properties: {} },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_notifications',
        label: 'List notifications',
        description: 'List your unread GitHub notifications.',
        inputSchema: { type: 'object', properties: { all: { type: 'boolean' } } },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'search_issues',
        label: 'Search issues and pull requests',
        description: 'Search issues and pull requests across repositories you can access.',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_commits',
        label: 'List commits',
        description: 'List recent commits on a repository branch.',
        inputSchema: {
          type: 'object',
          properties: { repo: { type: 'string' }, branch: { type: 'string' } },
          required: ['repo'],
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_releases',
        label: 'List releases',
        description: 'List published releases on a repository.',
        inputSchema: { type: 'object', properties: { repo: { type: 'string' } }, required: ['repo'] },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
    ];
  }

  async executeAction(
    credential: ResolvedCredential,
    actionId: string,
    input: Record<string, unknown>,
  ): Promise<AppActionResult> {
    const headers = ghHeaders(credential.accessToken);
    const repo = () => String(input['repo'] ?? '');

    switch (actionId) {
      case 'list_repos': {
        const res = await axios.get(`${API_BASE}/user/repos`, {
          headers,
          params: { sort: 'updated', per_page: num(input['maxResults']) ?? 25 },
        });
        return { success: true, message: `Found ${res.data.length} repositor${res.data.length === 1 ? 'y' : 'ies'}.`, data: { repos: res.data } };
      }
      case 'list_branches': {
        const res = await axios.get(`${API_BASE}/repos/${repo()}/branches`, { headers, params: { per_page: 50 } });
        return { success: true, message: `Found ${res.data.length} branch(es).`, data: { branches: res.data } };
      }
      case 'list_issues': {
        const res = await axios.get(`${API_BASE}/repos/${repo()}/issues`, {
          headers,
          params: { state: str(input['state']) ?? 'open', per_page: 30 },
        });
        const issues = (res.data as any[]).filter((i) => !i.pull_request);
        return { success: true, message: `Found ${issues.length} issue(s).`, data: { issues } };
      }
      case 'get_issue': {
        const res = await axios.get(`${API_BASE}/repos/${repo()}/issues/${input['issueNumber']}`, { headers });
        return { success: true, message: `Fetched issue #${res.data.number}.`, data: { issue: res.data } };
      }
      case 'create_issue': {
        const res = await axios.post(
          `${API_BASE}/repos/${repo()}/issues`,
          { title: input['title'], body: input['body'], labels: input['labels'] },
          { headers },
        );
        return { success: true, message: `Created issue #${res.data.number}.`, data: { issue: res.data } };
      }
      case 'comment_on_issue': {
        const res = await axios.post(
          `${API_BASE}/repos/${repo()}/issues/${input['issueNumber']}/comments`,
          { body: input['body'] },
          { headers },
        );
        return { success: true, message: 'Comment posted.', data: { comment: res.data } };
      }
      case 'list_pull_requests': {
        const res = await axios.get(`${API_BASE}/repos/${repo()}/pulls`, {
          headers,
          params: { state: str(input['state']) ?? 'open', per_page: 30 },
        });
        return { success: true, message: `Found ${res.data.length} pull request(s).`, data: { pullRequests: res.data } };
      }
      case 'get_pull_request': {
        const res = await axios.get(`${API_BASE}/repos/${repo()}/pulls/${input['prNumber']}`, { headers });
        return { success: true, message: `Fetched PR #${res.data.number}.`, data: { pullRequest: res.data } };
      }
      case 'list_review_requests': {
        const res = await axios.get(`${API_BASE}/search/issues`, {
          headers,
          params: { q: 'review-requested:@me type:pr state:open', per_page: 30 },
        });
        return { success: true, message: `${res.data.total_count} pull request(s) awaiting your review.`, data: { pullRequests: res.data.items } };
      }
      case 'list_notifications': {
        const res = await axios.get(`${API_BASE}/notifications`, { headers, params: { all: input['all'] === true } });
        return { success: true, message: `${res.data.length} notification(s).`, data: { notifications: res.data } };
      }
      case 'search_issues': {
        const res = await axios.get(`${API_BASE}/search/issues`, { headers, params: { q: String(input['query'] ?? ''), per_page: 30 } });
        return { success: true, message: `${res.data.total_count} result(s).`, data: { results: res.data.items } };
      }
      case 'list_commits': {
        const res = await axios.get(`${API_BASE}/repos/${repo()}/commits`, {
          headers,
          params: { sha: str(input['branch']), per_page: 30 },
        });
        return { success: true, message: `${res.data.length} commit(s).`, data: { commits: res.data } };
      }
      case 'list_releases': {
        const res = await axios.get(`${API_BASE}/repos/${repo()}/releases`, { headers, params: { per_page: 20 } });
        return { success: true, message: `${res.data.length} release(s).`, data: { releases: res.data } };
      }
      default:
        throw new BadRequestException(`Unknown GitHub action '${actionId}'.`);
    }
  }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}
