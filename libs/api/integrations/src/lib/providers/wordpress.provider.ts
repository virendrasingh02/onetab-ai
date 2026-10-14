import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AppActionDefinition,
  AppActionResult,
  ConnectorTriggerDefinition,
  IntegrationAccount,
  IntegrationCapabilities,
} from '@org/types';
import { connectorRequest, ConnectorHttpError } from '../core/connector-http.js';
import { SSRFGuardService } from '../core/ssrf-guard.service.js';
import type {
  ProviderAdapter,
  ResolvedCredential,
  SyncResult,
  WebhookProcessResult,
} from '../core/provider-adapter.interface.js';
import { boundedInt, parseCredentialBundle, requireText, textOf } from './credential-json.js';

const APP = 'WordPress';

interface WordPressAuth extends Record<string, string> {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

/** `https://Example.com/blog/` → `https://example.com/blog`. HTTPS only: the password travels in every request. */
export function normalizeSiteUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    throw new BadRequestException('Enter your site’s address, for example https://example.com.');
  }
  if (url.protocol !== 'https:') {
    throw new BadRequestException('WordPress application passwords are only safe over HTTPS. Use your site’s https:// address.');
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

function stripHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactPost(p: any) {
  return {
    id: p.id,
    title: stripHtml(p.title?.rendered ?? p.title),
    status: p.status,
    link: p.link,
    date: p.date_gmt ? `${p.date_gmt}Z` : p.date,
    author: p.author,
    excerpt: stripHtml(p.excerpt?.rendered).slice(0, 300),
  };
}

function compactComment(c: any) {
  return {
    id: c.id,
    post: c.post,
    author: c.author_name,
    authorEmail: c.author_email,
    status: c.status,
    date: c.date_gmt ? `${c.date_gmt}Z` : c.date,
    content: stripHtml(c.content?.rendered ?? c.content).slice(0, 1000),
    link: c.link,
  };
}

/**
 * WordPress REST API (`/wp-json/wp/v2`), connected with the site address, a
 * username and an application password (Users → Profile → Application
 * Passwords). That password can be revoked in WordPress at any time and is
 * stored encrypted like every manual credential. The site address is checked
 * against the SSRF guard before every request.
 *
 * Content actions are conservative: posts are created as drafts, publishing is
 * its own action that asks for approval, and deleting moves to the trash.
 */
@Injectable()
export class WordPressProvider implements ProviderAdapter {
  readonly providerId = 'WORDPRESS';

  constructor(private readonly ssrf: SSRFGuardService) {}

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      displayName: 'WordPress',
      description: 'Read, draft, publish and moderate posts and comments on your WordPress site through its REST API.',
      category: 'Content management',
      connectorCategory: 'content',
      authType: 'BASIC',
      supportsSync: false,
      supportsWebhooks: false,
      supportsMessaging: false,
      supportsCustomEndpoints: false,
      scopes: [
        { scope: 'edit_posts', description: 'Read and draft posts as the connected user', required: true },
        { scope: 'publish_posts', description: 'Publish posts (asks for approval)' },
        { scope: 'moderate_comments', description: 'Approve, hold or trash comments' },
      ],
      credentialFields: [
        { key: 'siteUrl', label: 'Site address', placeholder: 'https://example.com' },
        { key: 'username', label: 'Username' },
        {
          key: 'applicationPassword',
          label: 'Application password',
          secret: true,
          help: 'In WordPress: Users → Profile → Application Passwords. Use a user whose role matches what agents may do.',
        },
      ],
    };
  }

  secretFields(): string[] {
    return ['applicationPassword'];
  }

  private async auth(accessToken: string): Promise<WordPressAuth> {
    const auth = parseCredentialBundle<WordPressAuth>(accessToken, APP, ['siteUrl', 'username', 'applicationPassword']);
    const siteUrl = normalizeSiteUrl(auth.siteUrl);
    await this.ssrf.validateUrl(siteUrl);
    return { ...auth, siteUrl };
  }

  private call<T = any>(
    auth: WordPressAuth,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    options: { params?: Record<string, unknown>; data?: unknown } = {},
  ) {
    return connectorRequest<T>(APP, {
      method,
      url: `${auth.siteUrl}/wp-json/wp/v2${path}`,
      headers: { Accept: 'application/json' },
      auth: { username: auth.username, password: auth.applicationPassword.replace(/\s+/g, ' ') },
      params: options.params,
      data: options.data,
      httpAgent: this.ssrf.agents.httpAgent,
      httpsAgent: this.ssrf.agents.httpsAgent,
    });
  }

  async getAccount(credential: ResolvedCredential): Promise<IntegrationAccount> {
    const auth = await this.auth(credential.accessToken);
    const { data } = await this.call(auth, 'GET', '/users/me', { params: { context: 'edit' } });
    return {
      id: credential.id,
      provider: this.providerId,
      accountId: String(data.id),
      email: data.email,
      name: data.name || auth.username,
      scopes: credential.scopes,
      status: 'CONNECTED',
      connectedAt: new Date().toISOString(),
      metadata: { siteUrl: auth.siteUrl, roles: data.roles },
    };
  }

  async disconnect(): Promise<void> {
    // The application password is revoked from the user's WordPress profile.
  }

  async sync(): Promise<SyncResult> {
    return { success: true, itemsProcessed: 0 };
  }

  async handleWebhook(payload: unknown): Promise<WebhookProcessResult> {
    return { success: true, eventType: 'wordpress.webhook', data: payload };
  }

  async testConnection(
    config: Record<string, unknown>,
    credential?: ResolvedCredential,
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    try {
      const auth = await this.auth(credential ? credential.accessToken : JSON.stringify(config));
      const { data } = await this.call(auth, 'GET', '/users/me', { params: { context: 'edit' } });
      return {
        success: true,
        message: `Connected to ${new URL(auth.siteUrl).host} as ${data.name ?? auth.username}.`,
        details: { roles: data.roles, displayName: new URL(auth.siteUrl).host },
      };
    } catch (error) {
      return { success: false, message: `WordPress connection failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  getTriggers(): ConnectorTriggerDefinition[] {
    return [
      {
        id: 'new_post',
        label: 'New published post',
        description: 'Starts the agent for each newly published post.',
        pollActionId: 'list_posts',
        defaultInput: { status: 'publish' },
        itemsPath: 'posts',
        idField: 'id',
      },
      {
        id: 'new_comment',
        label: 'New comment',
        description: 'Starts the agent for each new comment (including those waiting for approval).',
        pollActionId: 'list_comments',
        itemsPath: 'comments',
        idField: 'id',
      },
    ];
  }

  getActions(): AppActionDefinition[] {
    const id = { type: 'string', description: 'The WordPress post id.' };
    return [
      {
        id: 'list_posts',
        label: 'List posts',
        description: 'List posts, newest first. Filter by status or search text.',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['publish', 'draft', 'pending', 'future', 'private', 'any'] },
            search: { type: 'string' },
            limit: { type: 'number' },
          },
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'get_post',
        label: 'Get post',
        description: 'Fetch one post with its content.',
        inputSchema: { type: 'object', properties: { postId: id }, required: ['postId'] },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_comments',
        label: 'List comments',
        description: 'List comments, newest first. Filter by status or post.',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['approve', 'hold', 'spam', 'trash', 'all'] },
            postId: id,
            limit: { type: 'number' },
          },
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'create_draft_post',
        label: 'Create draft post',
        description: 'Create a post as a draft. It is not public until someone publishes it.',
        inputSchema: {
          type: 'object',
          properties: { title: { type: 'string' }, content: { type: 'string', description: 'HTML or plain text.' }, excerpt: { type: 'string' } },
          required: ['title', 'content'],
        },
        permissionLevel: 'write',
        requiresConfirmation: false,
      },
      {
        id: 'update_post',
        label: 'Update post',
        description: 'Change a post’s title, content or excerpt without changing whether it is published.',
        inputSchema: {
          type: 'object',
          properties: { postId: id, title: { type: 'string' }, content: { type: 'string' }, excerpt: { type: 'string' } },
          required: ['postId'],
        },
        permissionLevel: 'write',
        requiresConfirmation: true,
      },
      {
        id: 'publish_post',
        label: 'Publish post',
        description: 'Make a draft public. Visitors can read it immediately.',
        inputSchema: { type: 'object', properties: { postId: id }, required: ['postId'] },
        permissionLevel: 'write',
        requiresConfirmation: true,
      },
      {
        id: 'moderate_comment',
        label: 'Moderate comment',
        description: 'Approve a comment, hold it for review, or mark it as spam.',
        inputSchema: {
          type: 'object',
          properties: { commentId: { type: 'string' }, status: { type: 'string', enum: ['approved', 'hold', 'spam'] } },
          required: ['commentId', 'status'],
        },
        permissionLevel: 'write',
        requiresConfirmation: false,
      },
      {
        id: 'reply_to_comment',
        label: 'Reply to comment',
        description: 'Post a public reply to a comment as the connected user.',
        inputSchema: {
          type: 'object',
          properties: { postId: id, commentId: { type: 'string' }, content: { type: 'string' } },
          required: ['postId', 'commentId', 'content'],
        },
        permissionLevel: 'write',
        requiresConfirmation: true,
      },
      {
        id: 'trash_post',
        label: 'Move post to trash',
        description: 'Move a post to the trash. It can be restored from WordPress until the trash is emptied.',
        inputSchema: { type: 'object', properties: { postId: id }, required: ['postId'] },
        permissionLevel: 'destructive',
        requiresConfirmation: true,
      },
    ];
  }

  async executeAction(
    credential: ResolvedCredential,
    actionId: string,
    input: Record<string, unknown>,
  ): Promise<AppActionResult> {
    const auth = await this.auth(credential.accessToken);
    try {
      switch (actionId) {
        case 'list_posts': {
          const { data } = await this.call(auth, 'GET', '/posts', {
            params: {
              per_page: boundedInt(input['limit'], 20, 1, 100),
              orderby: 'date',
              order: 'desc',
              status: textOf(input['status']) || 'any',
              ...(textOf(input['search']) ? { search: textOf(input['search']) } : {}),
            },
          });
          const posts = (data as any[]).map(compactPost);
          return { success: true, message: `Found ${posts.length} post(s).`, data: { posts } };
        }
        case 'get_post': {
          const { postId } = requireText(input, 'postId');
          const { data } = await this.call(auth, 'GET', `/posts/${encodeURIComponent(postId)}`, { params: { context: 'edit' } });
          return {
            success: true,
            message: `Fetched “${stripHtml(data.title?.rendered ?? data.title)}”.`,
            data: { post: { ...compactPost(data), content: stripHtml(data.content?.raw ?? data.content?.rendered).slice(0, 8000) } },
          };
        }
        case 'list_comments': {
          const { data } = await this.call(auth, 'GET', '/comments', {
            params: {
              per_page: boundedInt(input['limit'], 20, 1, 100),
              orderby: 'date',
              order: 'desc',
              status: textOf(input['status']) || 'all',
              context: 'edit',
              ...(textOf(input['postId']) ? { post: textOf(input['postId']) } : {}),
            },
          });
          const comments = (data as any[]).map(compactComment);
          return { success: true, message: `Found ${comments.length} comment(s).`, data: { comments } };
        }
        case 'create_draft_post': {
          const { title, content } = requireText(input, 'title', 'content');
          const { data } = await this.call(auth, 'POST', '/posts', {
            data: { title, content, status: 'draft', ...(textOf(input['excerpt']) ? { excerpt: textOf(input['excerpt']) } : {}) },
          });
          return { success: true, message: `Draft “${title}” created.`, data: { post: compactPost(data) } };
        }
        case 'update_post': {
          const { postId } = requireText(input, 'postId');
          const fields: Record<string, string> = {};
          for (const key of ['title', 'content', 'excerpt']) if (textOf(input[key])) fields[key] = textOf(input[key]);
          if (!Object.keys(fields).length) throw new BadRequestException('Give at least one of title, content or excerpt to change.');
          const { data } = await this.call(auth, 'POST', `/posts/${encodeURIComponent(postId)}`, { data: fields });
          return { success: true, message: 'Post updated.', data: { post: compactPost(data) } };
        }
        case 'publish_post': {
          const { postId } = requireText(input, 'postId');
          const { data } = await this.call(auth, 'POST', `/posts/${encodeURIComponent(postId)}`, { data: { status: 'publish' } });
          return { success: true, message: 'Post published.', data: { post: compactPost(data) } };
        }
        case 'moderate_comment': {
          const { commentId, status } = requireText(input, 'commentId', 'status');
          if (!['approved', 'hold', 'spam'].includes(status)) throw new BadRequestException('status must be approved, hold or spam.');
          const { data } = await this.call(auth, 'POST', `/comments/${encodeURIComponent(commentId)}`, { data: { status } });
          return { success: true, message: `Comment marked ${status}.`, data: { comment: compactComment(data) } };
        }
        case 'reply_to_comment': {
          const { postId, commentId, content } = requireText(input, 'postId', 'commentId', 'content');
          const { data } = await this.call(auth, 'POST', '/comments', {
            data: { post: Number(postId), parent: Number(commentId), content },
          });
          return { success: true, message: 'Reply posted.', data: { comment: compactComment(data) } };
        }
        case 'trash_post': {
          const { postId } = requireText(input, 'postId');
          // No `force`: WordPress moves the post to the trash instead of erasing it.
          await this.call(auth, 'DELETE', `/posts/${encodeURIComponent(postId)}`);
          return { success: true, message: 'Post moved to the trash.', data: { postId } };
        }
        default:
          throw new BadRequestException(`Unknown WordPress action '${actionId}'.`);
      }
    } catch (error) {
      if (error instanceof ConnectorHttpError) return { success: false, message: error.message };
      throw error;
    }
  }
}
