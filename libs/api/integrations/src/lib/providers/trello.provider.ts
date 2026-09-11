import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
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
  WebhookProcessResult,
} from '../core/provider-adapter.interface.js';

const API_BASE = 'https://api.trello.com/1';

interface TrelloAuth {
  apiKey: string;
  token: string;
}

/** Trello's `accessToken` is a JSON-encoded {apiKey, token} bundle — encrypted
 * at rest through the same `encryptedAccessToken` column an OAuth token would
 * use (see `IntegrationsService.initiateConnect`'s manual-credential branch).
 * Trello has no server-to-server OAuth2 code exchange to hook into; each user
 * brings their own personal API key + token, generated from their own Trello
 * account, exactly the same trust model as the existing Custom API connector. */
function parseAuth(accessToken: string): TrelloAuth {
  try {
    const parsed = JSON.parse(accessToken);
    if (parsed?.apiKey && parsed?.token) return parsed;
  } catch {
    // fall through
  }
  throw new UnauthorizedException('Trello credentials are missing or corrupted — please reconnect.');
}

async function trelloCall<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  auth: TrelloAuth,
  params: Record<string, unknown> = {},
): Promise<T> {
  try {
    const res = await axios.request({
      method,
      url: `${API_BASE}${path}`,
      params: { key: auth.apiKey, token: auth.token, ...params },
    });
    return res.data;
  } catch (err: any) {
    if (err.response?.status === 401) {
      throw new UnauthorizedException('Trello rejected this API key/token — it may have been revoked.');
    }
    throw new BadRequestException(`Trello API error: ${err.response?.data || err.message}`);
  }
}

@Injectable()
export class TrelloProvider implements ProviderAdapter {
  readonly providerId = 'TRELLO';
  private readonly logger = new Logger(TrelloProvider.name);

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      displayName: 'Trello',
      description:
        'Boards, lists, and cards — read and manage real Trello cards using your own personal API key and token.',
      category: 'Productivity & Project Management',
      authType: 'API_KEY_QUERY',
      supportsSync: true,
      supportsWebhooks: false,
      supportsMessaging: false,
      supportsCustomEndpoints: false,
      scopes: [
        {
          scope: 'read,write',
          description: 'Your personal Trello API key and token (generated at trello.com/power-ups/admin)',
          required: true,
        },
      ],
    };
  }

  async getAccount(credential: ResolvedCredential): Promise<IntegrationAccount> {
    const auth = parseAuth(credential.accessToken);
    const me = await trelloCall('GET', '/members/me', auth, { fields: 'id,fullName,username,email,avatarUrl' });
    return {
      id: credential.id,
      provider: this.providerId,
      accountId: me.id,
      email: me.email,
      name: me.fullName || me.username,
      avatarUrl: me.avatarUrl ? `${me.avatarUrl}/50.png` : undefined,
      scopes: credential.scopes,
      status: 'CONNECTED',
      connectedAt: new Date().toISOString(),
      metadata: { username: me.username },
    };
  }

  async disconnect(credential: ResolvedCredential): Promise<void> {
    try {
      const auth = parseAuth(credential.accessToken);
      await trelloCall('DELETE', `/tokens/${auth.token}`, auth);
    } catch (err: any) {
      this.logger.warn(`Trello token revocation notice: ${err.message}`);
    }
  }

  async testConnection(
    config: Record<string, unknown>,
    credential?: ResolvedCredential,
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    const apiKey = credential ? parseAuth(credential.accessToken).apiKey : String(config['apiKey'] ?? '');
    const token = credential ? parseAuth(credential.accessToken).token : String(config['token'] ?? '');
    if (!apiKey || !token) {
      return { success: false, message: 'Both an API key and a token are required.' };
    }
    try {
      const me = await trelloCall('GET', '/members/me', { apiKey, token }, { fields: 'username' });
      return { success: true, message: `Successfully connected to Trello as ${me.username}`, details: me };
    } catch (err: any) {
      return { success: false, message: `Trello connection test failed: ${err.message}` };
    }
  }

  async sync(credential: ResolvedCredential): Promise<SyncResult> {
    const auth = parseAuth(credential.accessToken);
    const boards = await trelloCall('GET', '/members/me/boards', auth, { fields: 'id', filter: 'open' });
    return { success: true, itemsProcessed: boards.length };
  }

  async handleWebhook(payload: unknown): Promise<WebhookProcessResult> {
    this.logger.log('Trello does not have an active webhook subscription registered.');
    return { success: true, eventType: 'trello.unsubscribed', data: payload };
  }

  getActions(): AppActionDefinition[] {
    return [
      {
        id: 'list_boards',
        label: 'List boards',
        description: 'List your open Trello boards.',
        inputSchema: { type: 'object', properties: {} },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_lists',
        label: 'List lists on a board',
        description: 'List the lists (columns) on a board.',
        inputSchema: { type: 'object', properties: { boardId: { type: 'string' } }, required: ['boardId'] },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_cards',
        label: 'List cards',
        description: 'List cards on a board or list.',
        inputSchema: {
          type: 'object',
          properties: { boardId: { type: 'string' }, listId: { type: 'string' } },
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_overdue_cards',
        label: 'Overdue cards',
        description: 'List cards on a board whose due date has passed and are not marked complete.',
        inputSchema: { type: 'object', properties: { boardId: { type: 'string' } }, required: ['boardId'] },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'get_card',
        label: 'Get card',
        description: 'Fetch full details of a card, including members, labels, and due date.',
        inputSchema: { type: 'object', properties: { cardId: { type: 'string' } }, required: ['cardId'] },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'search',
        label: 'Search cards',
        description: 'Search cards by text across your boards.',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'create_card',
        label: 'Create card',
        description: 'Create a new card on a list.',
        inputSchema: {
          type: 'object',
          properties: {
            listId: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            due: { type: 'string' },
          },
          required: ['listId', 'name'],
        },
        permissionLevel: 'write',
        requiresConfirmation: true,
      },
      {
        id: 'update_card',
        label: 'Update card',
        description: 'Move a card to another list, rename it, or change its due date/completion.',
        inputSchema: {
          type: 'object',
          properties: {
            cardId: { type: 'string' },
            listId: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            due: { type: 'string' },
            dueComplete: { type: 'boolean' },
          },
          required: ['cardId'],
        },
        permissionLevel: 'write',
        requiresConfirmation: true,
      },
      {
        id: 'add_comment',
        label: 'Comment on card',
        description: 'Post a comment on a card.',
        inputSchema: {
          type: 'object',
          properties: { cardId: { type: 'string' }, text: { type: 'string' } },
          required: ['cardId', 'text'],
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
    const auth = parseAuth(credential.accessToken);

    switch (actionId) {
      case 'list_boards': {
        const boards = await trelloCall('GET', '/members/me/boards', auth, { filter: 'open', fields: 'id,name,url,shortUrl' });
        return { success: true, message: `Found ${boards.length} board(s).`, data: { boards } };
      }
      case 'list_lists': {
        const lists = await trelloCall('GET', `/boards/${input['boardId']}/lists`, auth, { filter: 'open' });
        return { success: true, message: `Found ${lists.length} list(s).`, data: { lists } };
      }
      case 'list_cards': {
        const path = input['listId'] ? `/lists/${input['listId']}/cards` : `/boards/${input['boardId']}/cards`;
        const cards = await trelloCall('GET', path, auth, { fields: 'id,name,due,dueComplete,idList,labels,url' });
        return { success: true, message: `Found ${cards.length} card(s).`, data: { cards } };
      }
      case 'list_overdue_cards': {
        const cards = await trelloCall('GET', `/boards/${input['boardId']}/cards`, auth, {
          fields: 'id,name,due,dueComplete,idList,url',
        });
        const now = Date.now();
        const overdue = (cards as any[]).filter((c) => c.due && !c.dueComplete && new Date(c.due).getTime() < now);
        return { success: true, message: `${overdue.length} overdue card(s).`, data: { cards: overdue } };
      }
      case 'get_card': {
        const card = await trelloCall('GET', `/cards/${input['cardId']}`, auth, {
          members: 'true',
          member_fields: 'fullName',
          attachments: 'true',
          fields: 'name,desc,due,dueComplete,idList,labels,url',
        });
        return { success: true, message: `Fetched "${card.name}".`, data: { card } };
      }
      case 'search': {
        const res = await trelloCall('GET', '/search', auth, { query: input['query'], modelTypes: 'cards', card_fields: 'name,due,url,idList' });
        return { success: true, message: `Found ${res.cards?.length ?? 0} matching card(s).`, data: { cards: res.cards ?? [] } };
      }
      case 'create_card': {
        const card = await trelloCall('POST', '/cards', auth, {
          idList: input['listId'],
          name: input['name'],
          desc: input['description'],
          due: input['due'],
        });
        return { success: true, message: `Created "${card.name}".`, data: { card } };
      }
      case 'update_card': {
        const card = await trelloCall('PUT', `/cards/${input['cardId']}`, auth, {
          idList: input['listId'],
          name: input['name'],
          desc: input['description'],
          due: input['due'],
          dueComplete: input['dueComplete'],
        });
        return { success: true, message: `Updated "${card.name}".`, data: { card } };
      }
      case 'add_comment': {
        const comment = await trelloCall('POST', `/cards/${input['cardId']}/actions/comments`, auth, { text: input['text'] });
        return { success: true, message: 'Comment posted.', data: { comment } };
      }
      default:
        throw new BadRequestException(`Unknown Trello action '${actionId}'.`);
    }
  }
}
