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

const API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

function notionHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

function pageTitle(page: any): string {
  const props = page.properties || {};
  for (const key of Object.keys(props)) {
    const prop = props[key];
    if (prop?.type === 'title' && Array.isArray(prop.title)) {
      return prop.title.map((t: any) => t.plain_text).join('') || 'Untitled';
    }
  }
  return page.url ? page.url.split('/').pop() : 'Untitled';
}

/** Flattens a block's rich_text into plain text, one line per block. */
function blockPlainText(block: any): string {
  const type = block.type;
  const data = block[type];
  const richText = data?.rich_text || data?.text;
  const text = Array.isArray(richText) ? richText.map((t: any) => t.plain_text).join('') : '';
  if (type === 'to_do') return `${data.checked ? '[x]' : '[ ]'} ${text}`;
  if (type === 'code') return text;
  return text;
}

@Injectable()
export class NotionProvider implements ProviderAdapter {
  readonly providerId = 'NOTION';
  private readonly logger = new Logger(NotionProvider.name);

  constructor(private readonly config: ConfigService) {}

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      displayName: 'Notion',
      description:
        'Search pages and databases, read real page content, and query database records from your connected Notion workspace.',
      category: 'Productivity & Project Management',
      authType: 'OAUTH2',
      supportsSync: true,
      supportsWebhooks: false,
      supportsMessaging: false,
      supportsCustomEndpoints: false,
      scopes: [
        {
          scope: 'default',
          description: 'Access to the pages and databases you share with this integration',
          required: true,
        },
      ],
    };
  }

  private clientCreds() {
    const clientId = this.config.get<string>('NOTION_CLIENT_ID');
    const clientSecret = this.config.get<string>('NOTION_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'Notion OAuth is not configured on this server (NOTION_CLIENT_ID / NOTION_CLIENT_SECRET missing). ' +
          'An administrator must register a public integration at notion.so/my-integrations first.',
      );
    }
    return { clientId, clientSecret };
  }

  private redirectUri(override?: string) {
    return (
      override ||
      this.config.get<string>('NOTION_REDIRECT_URI') ||
      'http://localhost:3000/api/v1/integrations/notion/callback'
    );
  }

  async getAuthorizationUrl(state: string, options?: { redirectUri?: string }): Promise<string> {
    const { clientId } = this.clientCreds();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.redirectUri(options?.redirectUri),
      response_type: 'code',
      owner: 'user',
      state,
    });
    return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
  }

  async handleCallback(
    code: string,
    _state: string,
    options?: { redirectUri?: string },
  ): Promise<TokenResult> {
    const { clientId, clientSecret } = this.clientCreds();
    try {
      const res = await axios.post<{
        access_token: string;
        bot_id: string;
        workspace_id: string;
        workspace_name?: string;
        workspace_icon?: string;
        owner?: { user?: { id: string; name?: string; person?: { email?: string }; avatar_url?: string } };
      }>(
        `${API_BASE}/oauth/token`,
        { grant_type: 'authorization_code', code, redirect_uri: this.redirectUri(options?.redirectUri) },
        {
          auth: { username: clientId, password: clientSecret },
          headers: { 'Content-Type': 'application/json' },
        },
      );

      return {
        accessToken: res.data.access_token,
        // Notion integration tokens do not expire and carry no refresh token.
        scopes: ['default'],
        accountId: res.data.owner?.user?.id || res.data.bot_id,
        accountEmail: res.data.owner?.user?.person?.email,
        accountName: res.data.owner?.user?.name || res.data.workspace_name,
        metadata: {
          workspaceId: res.data.workspace_id,
          workspaceName: res.data.workspace_name,
          workspaceIcon: res.data.workspace_icon,
          picture: res.data.owner?.user?.avatar_url,
        },
      };
    } catch (err: any) {
      this.logger.error(`Notion OAuth token exchange failed: ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`);
      throw new UnauthorizedException('Failed to exchange Notion authorization code.');
    }
  }

  async getAccount(credential: ResolvedCredential): Promise<IntegrationAccount> {
    const res = await axios.get(`${API_BASE}/users/me`, { headers: notionHeaders(credential.accessToken) });
    return {
      id: credential.id,
      provider: this.providerId,
      accountId: res.data.id,
      email: res.data.person?.email,
      name: (credential.metadata['workspaceName'] as string) || res.data.name,
      avatarUrl: res.data.avatar_url,
      scopes: credential.scopes,
      status: 'CONNECTED',
      connectedAt: new Date().toISOString(),
      metadata: { workspaceName: credential.metadata['workspaceName'] },
    };
  }

  async disconnect(_credential: ResolvedCredential): Promise<void> {
    // Notion has no token-revocation endpoint; the user removes access from
    // their workspace's Connections settings. We stop using the token here.
  }

  async testConnection(
    _config: Record<string, unknown>,
    credential?: ResolvedCredential,
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    if (!credential) return { success: false, message: 'No credential provided for Notion connection test.' };
    try {
      const account = await this.getAccount(credential);
      return {
        success: true,
        message: `Successfully connected to Notion workspace "${account.metadata?.['workspaceName'] || account.name}"`,
        details: account,
      };
    } catch (err: any) {
      return { success: false, message: `Notion connection test failed: ${err.message}` };
    }
  }

  async sync(credential: ResolvedCredential): Promise<SyncResult> {
    const res = await axios.post(
      `${API_BASE}/search`,
      { filter: { property: 'object', value: 'page' }, page_size: 25, sort: { direction: 'descending', timestamp: 'last_edited_time' } },
      { headers: notionHeaders(credential.accessToken) },
    );
    return { success: true, itemsProcessed: res.data.results.length };
  }

  async handleWebhook(payload: unknown): Promise<WebhookProcessResult> {
    this.logger.log('Notion does not have an active webhook subscription registered.');
    return { success: true, eventType: 'notion.unsubscribed', data: payload };
  }

  getActions(): AppActionDefinition[] {
    return [
      {
        id: 'search',
        label: 'Search Notion',
        description: 'Search pages and databases shared with this integration.',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' }, type: { type: 'string', enum: ['page', 'database'] } },
          required: ['query'],
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_pages',
        label: 'List recent pages',
        description: 'List pages, most recently edited first.',
        inputSchema: { type: 'object', properties: { maxResults: { type: 'number' } } },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_databases',
        label: 'List databases',
        description: 'List databases shared with this integration.',
        inputSchema: { type: 'object', properties: {} },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'get_page',
        label: 'Get page content',
        description: "Fetch a page's properties and real text content, ready for AI summarization.",
        inputSchema: { type: 'object', properties: { pageId: { type: 'string' } }, required: ['pageId'] },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'query_database',
        label: 'Query database',
        description: 'Fetch records from a database, optionally filtered.',
        inputSchema: {
          type: 'object',
          properties: { databaseId: { type: 'string' }, filter: { type: 'object' } },
          required: ['databaseId'],
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'create_page',
        label: 'Create page',
        description: 'Create a new page under a parent page or database.',
        inputSchema: {
          type: 'object',
          properties: {
            parentPageId: { type: 'string' },
            parentDatabaseId: { type: 'string' },
            title: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['title'],
        },
        permissionLevel: 'write',
        requiresConfirmation: true,
      },
      {
        id: 'list_comments',
        label: 'List comments',
        description: 'List comments on a page or block.',
        inputSchema: { type: 'object', properties: { blockId: { type: 'string' } }, required: ['blockId'] },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'add_comment',
        label: 'Add comment',
        description: 'Post a comment on a page.',
        inputSchema: {
          type: 'object',
          properties: { pageId: { type: 'string' }, text: { type: 'string' } },
          required: ['pageId', 'text'],
        },
        permissionLevel: 'write',
        requiresConfirmation: true,
      },
    ];
  }

  async executeAction(
    credential: ResolvedCredential,
    actionId: string,
    input: Record<string, unknown>,
  ): Promise<AppActionResult> {
    const headers = notionHeaders(credential.accessToken);

    switch (actionId) {
      case 'search': {
        const type = str(input['type']);
        const res = await axios.post(
          `${API_BASE}/search`,
          {
            query: String(input['query'] ?? ''),
            filter: type ? { property: 'object', value: type } : undefined,
            page_size: 25,
          },
          { headers },
        );
        const results = res.data.results.map((r: any) => this.normalizeResult(r));
        return { success: true, message: `Found ${results.length} result(s).`, data: { results } };
      }
      case 'list_pages': {
        const res = await axios.post(
          `${API_BASE}/search`,
          {
            filter: { property: 'object', value: 'page' },
            sort: { direction: 'descending', timestamp: 'last_edited_time' },
            page_size: num(input['maxResults']) ?? 25,
          },
          { headers },
        );
        const pages = res.data.results.map((r: any) => this.normalizeResult(r));
        return { success: true, message: `Found ${pages.length} page(s).`, data: { pages } };
      }
      case 'list_databases': {
        const res = await axios.post(
          `${API_BASE}/search`,
          { filter: { property: 'object', value: 'database' }, page_size: 25 },
          { headers },
        );
        const databases = res.data.results.map((r: any) => this.normalizeResult(r));
        return { success: true, message: `Found ${databases.length} database(s).`, data: { databases } };
      }
      case 'get_page': {
        const pageId = String(input['pageId'] ?? '');
        const page = await axios.get(`${API_BASE}/pages/${pageId}`, { headers });
        const plainText = await this.extractPageText(credential.accessToken, pageId);
        return {
          success: true,
          message: `Fetched "${pageTitle(page.data)}" (${plainText.length} characters).`,
          data: { pageId, title: pageTitle(page.data), url: page.data.url, plainText },
        };
      }
      case 'query_database': {
        const databaseId = String(input['databaseId'] ?? '');
        const res = await axios.post(
          `${API_BASE}/databases/${databaseId}/query`,
          { filter: input['filter'] || undefined, page_size: 50 },
          { headers },
        );
        return { success: true, message: `Found ${res.data.results.length} record(s).`, data: { records: res.data.results } };
      }
      case 'create_page': {
        const parent = input['parentDatabaseId']
          ? { database_id: input['parentDatabaseId'] }
          : { page_id: input['parentPageId'] };
        const properties: Record<string, unknown> = input['parentDatabaseId']
          ? { Name: { title: [{ text: { content: String(input['title'] ?? '') } }] } }
          : { title: { title: [{ text: { content: String(input['title'] ?? '') } }] } };
        const children = input['content']
          ? [
              {
                object: 'block',
                type: 'paragraph',
                paragraph: { rich_text: [{ type: 'text', text: { content: String(input['content']) } }] },
              },
            ]
          : undefined;

        const res = await axios.post(`${API_BASE}/pages`, { parent, properties, children }, { headers });
        return { success: true, message: `Created "${pageTitle(res.data)}".`, data: { page: res.data } };
      }
      case 'list_comments': {
        const res = await axios.get(`${API_BASE}/comments`, { headers, params: { block_id: input['blockId'] } });
        return { success: true, message: `${res.data.results.length} comment(s).`, data: { comments: res.data.results } };
      }
      case 'add_comment': {
        const res = await axios.post(
          `${API_BASE}/comments`,
          { parent: { page_id: input['pageId'] }, rich_text: [{ text: { content: String(input['text'] ?? '') } }] },
          { headers },
        );
        return { success: true, message: 'Comment posted.', data: { comment: res.data } };
      }
      default:
        throw new BadRequestException(`Unknown Notion action '${actionId}'.`);
    }
  }

  private normalizeResult(r: any) {
    return {
      id: r.id,
      object: r.object,
      title: r.object === 'page' ? pageTitle(r) : r.title?.map((t: any) => t.plain_text).join('') || 'Untitled',
      url: r.url,
      lastEditedTime: r.last_edited_time,
      icon: r.icon?.emoji || r.icon?.external?.url || r.icon?.file?.url,
    };
  }

  /**
   * Walks a page's block children (bounded depth/breadth) into plain text —
   * the real source for AI summarization, never invented.
   */
  private async extractPageText(token: string, blockId: string, depth = 0): Promise<string> {
    if (depth > 3) return '';
    const headers = notionHeaders(token);
    const lines: string[] = [];
    let cursor: string | undefined;
    let fetched = 0;

    do {
      const res: any = await axios.get(`${API_BASE}/blocks/${blockId}/children`, {
        headers,
        params: { start_cursor: cursor, page_size: 100 },
      });
      for (const block of res.data.results) {
        const text = blockPlainText(block);
        if (text) lines.push(text);
        if (block.has_children && depth < 3) {
          const nested = await this.extractPageText(token, block.id, depth + 1);
          if (nested) lines.push(nested);
        }
      }
      cursor = res.data.has_more ? res.data.next_cursor : undefined;
      fetched += res.data.results.length;
    } while (cursor && fetched < 300);

    return lines.join('\n');
  }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}
