import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleAuthorizationCode,
  executeWithGoogleAuth,
  listGoogleDriveFiles,
  refreshGoogleAccessToken,
  revokeGoogleToken,
  type GoogleOAuthConfig,
} from './google-oauth.util.js';

const OAUTH_OPTS: GoogleOAuthConfig = {
  redirectUriEnvKey: 'GOOGLE_DOCS_REDIRECT_URI',
  defaultCallbackPath: 'google_docs',
};

const DOCS_SCOPES = [
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const DOC_MIME_TYPE = 'application/vnd.google-apps.document';

/** Flattens the Docs API's nested paragraph/textRun structure into plain text. */
function extractPlainText(body: any): string {
  const out: string[] = [];
  const walk = (elements: any[] | undefined) => {
    if (!elements) return;
    for (const el of elements) {
      if (el.paragraph?.elements) {
        for (const pe of el.paragraph.elements) {
          if (pe.textRun?.content) out.push(pe.textRun.content);
        }
      } else if (el.table?.tableRows) {
        for (const row of el.table.tableRows) {
          for (const cell of row.tableCells ?? []) {
            walk(cell.content);
          }
        }
      }
    }
  };
  walk(body?.content);
  return out.join('').trim();
}

@Injectable()
export class GoogleDocsProvider implements ProviderAdapter {
  readonly providerId = 'GOOGLE_DOCS';
  private readonly logger = new Logger(GoogleDocsProvider.name);

  constructor(private readonly config: ConfigService) {}

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      displayName: 'Google Docs',
      description:
        'Browse, search, and read Google Docs content — full text is available to AI summarization and extraction.',
      category: 'Productivity & Project Management',
      authType: 'OAUTH2',
      supportsSync: true,
      supportsWebhooks: false,
      supportsMessaging: false,
      supportsCustomEndpoints: false,
      scopes: [
        {
          scope: 'https://www.googleapis.com/auth/documents.readonly',
          description: 'Read the content of your Google Docs',
          required: true,
        },
        {
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          description: 'List which documents exist and their metadata',
          required: true,
        },
      ],
    };
  }

  async getAuthorizationUrl(
    state: string,
    options?: { redirectUri?: string; scopes?: string[]; loginHint?: string },
  ): Promise<string> {
    return buildGoogleAuthorizationUrl(this.config, OAUTH_OPTS, DOCS_SCOPES, state, options);
  }

  async handleCallback(
    code: string,
    _state: string,
    options?: { redirectUri?: string },
  ): Promise<TokenResult> {
    return exchangeGoogleAuthorizationCode(this.config, OAUTH_OPTS, code, DOCS_SCOPES, options);
  }

  async refreshToken(refreshToken: string): Promise<TokenResult> {
    return refreshGoogleAccessToken(this.config, refreshToken);
  }

  async getAccount(credential: ResolvedCredential): Promise<IntegrationAccount> {
    const about = await this.executeWithAuth(credential, (token) =>
      axios.get<{ user: { emailAddress: string; displayName: string; photoLink?: string } }>(
        'https://www.googleapis.com/drive/v3/about',
        { headers: { Authorization: `Bearer ${token}` }, params: { fields: 'user' } },
      ),
    );

    return {
      id: credential.id,
      provider: this.providerId,
      accountId: about.data.user.emailAddress,
      email: about.data.user.emailAddress,
      name: about.data.user.displayName,
      avatarUrl: about.data.user.photoLink,
      scopes: credential.scopes,
      status: 'CONNECTED',
      connectedAt: new Date().toISOString(),
    };
  }

  async disconnect(credential: ResolvedCredential): Promise<void> {
    if (credential.accessToken) await revokeGoogleToken(credential.accessToken);
  }

  async testConnection(
    _config: Record<string, unknown>,
    credential?: ResolvedCredential,
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    if (!credential) return { success: false, message: 'No credential provided for Google Docs connection test.' };
    try {
      const account = await this.getAccount(credential);
      return { success: true, message: `Successfully connected to Google Docs for ${account.email}`, details: account };
    } catch (err: any) {
      return { success: false, message: `Google Docs connection test failed: ${err.message}` };
    }
  }

  async sync(credential: ResolvedCredential): Promise<SyncResult> {
    const result = await this.executeWithAuth(credential, (token) =>
      listGoogleDriveFiles(token, { mimeType: DOC_MIME_TYPE, orderBy: 'modifiedTime desc', pageSize: 25 }),
    );
    return { success: true, itemsProcessed: result.files.length };
  }

  async handleWebhook(payload: unknown): Promise<WebhookProcessResult> {
    this.logger.log('Google Docs does not have an active push-notification channel registered.');
    return { success: true, eventType: 'google_docs.unsubscribed', data: payload };
  }

  getActions(): AppActionDefinition[] {
    return [
      {
        id: 'list_documents',
        label: 'List documents',
        description: 'List Google Docs, most recently modified first.',
        inputSchema: { type: 'object', properties: { maxResults: { type: 'number' } } },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'search_documents',
        label: 'Search documents',
        description: 'Full-text search across document titles and content.',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'get_document',
        label: 'Get document content',
        description:
          'Fetch a document\'s plain-text content and metadata — the real source an AI summary or extraction should be based on.',
        inputSchema: {
          type: 'object',
          properties: { documentId: { type: 'string' } },
          required: ['documentId'],
        },
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
    switch (actionId) {
      case 'list_documents': {
        const result = await this.executeWithAuth(credential, (token) =>
          listGoogleDriveFiles(token, {
            mimeType: DOC_MIME_TYPE,
            orderBy: 'modifiedTime desc',
            pageSize: num(input['maxResults']) ?? 25,
          }),
        );
        return { success: true, message: `Found ${result.files.length} document(s).`, data: result };
      }
      case 'search_documents': {
        const query = String(input['query'] ?? '').replace(/'/g, "\\'");
        const result = await this.executeWithAuth(credential, (token) =>
          listGoogleDriveFiles(token, { mimeType: DOC_MIME_TYPE, q: `fullText contains '${query}'`, pageSize: 25 }),
        );
        return { success: true, message: `Found ${result.files.length} matching document(s).`, data: result };
      }
      case 'get_document': {
        const documentId = String(input['documentId'] ?? '');
        const doc = await this.executeWithAuth(credential, (token) =>
          axios.get(`https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        );
        const plainText = extractPlainText(doc.data.body);
        return {
          success: true,
          message: `Fetched "${doc.data.title}" (${plainText.length} characters).`,
          data: { documentId, title: doc.data.title, plainText },
        };
      }
      default:
        throw new BadRequestException(`Unknown Google Docs action '${actionId}'.`);
    }
  }

  private async executeWithAuth<T>(
    credential: ResolvedCredential,
    fn: (token: string) => Promise<T>,
  ): Promise<T> {
    return executeWithGoogleAuth(this.config, credential, fn);
  }
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}
