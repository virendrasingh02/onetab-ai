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
  redirectUriEnvKey: 'GOOGLE_SHEETS_REDIRECT_URI',
  defaultCallbackPath: 'google_sheets',
};

const SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const SHEET_MIME_TYPE = 'application/vnd.google-apps.spreadsheet';

@Injectable()
export class GoogleSheetsProvider implements ProviderAdapter {
  readonly providerId = 'GOOGLE_SHEETS';
  private readonly logger = new Logger(GoogleSheetsProvider.name);

  constructor(private readonly config: ConfigService) {}

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      displayName: 'Google Sheets',
      description:
        'Browse, search, and read real Google Sheets data — cell values and ranges are always fetched live, never fabricated.',
      category: 'Productivity & Project Management',
      authType: 'OAUTH2',
      supportsSync: true,
      supportsWebhooks: false,
      supportsMessaging: false,
      supportsCustomEndpoints: false,
      scopes: [
        {
          scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
          description: 'Read the content of your Google Sheets',
          required: true,
        },
        {
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          description: 'List which spreadsheets exist and their metadata',
          required: true,
        },
      ],
    };
  }

  async getAuthorizationUrl(
    state: string,
    options?: { redirectUri?: string; scopes?: string[]; loginHint?: string },
  ): Promise<string> {
    return buildGoogleAuthorizationUrl(this.config, OAUTH_OPTS, SHEETS_SCOPES, state, options);
  }

  async handleCallback(
    code: string,
    _state: string,
    options?: { redirectUri?: string },
  ): Promise<TokenResult> {
    return exchangeGoogleAuthorizationCode(this.config, OAUTH_OPTS, code, SHEETS_SCOPES, options);
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
    if (!credential) return { success: false, message: 'No credential provided for Google Sheets connection test.' };
    try {
      const account = await this.getAccount(credential);
      return { success: true, message: `Successfully connected to Google Sheets for ${account.email}`, details: account };
    } catch (err: any) {
      return { success: false, message: `Google Sheets connection test failed: ${err.message}` };
    }
  }

  async sync(credential: ResolvedCredential): Promise<SyncResult> {
    const result = await this.executeWithAuth(credential, (token) =>
      listGoogleDriveFiles(token, { mimeType: SHEET_MIME_TYPE, orderBy: 'modifiedTime desc', pageSize: 25 }),
    );
    return { success: true, itemsProcessed: result.files.length };
  }

  async handleWebhook(payload: unknown): Promise<WebhookProcessResult> {
    this.logger.log('Google Sheets does not have an active push-notification channel registered.');
    return { success: true, eventType: 'google_sheets.unsubscribed', data: payload };
  }

  getActions(): AppActionDefinition[] {
    return [
      {
        id: 'list_spreadsheets',
        label: 'List spreadsheets',
        description: 'List Google Sheets, most recently modified first.',
        inputSchema: { type: 'object', properties: { maxResults: { type: 'number' } } },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'search_spreadsheets',
        label: 'Search spreadsheets',
        description: 'Full-text search across spreadsheet titles and content.',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'get_spreadsheet',
        label: 'Get spreadsheet structure',
        description: 'List a spreadsheet\'s tabs (sheets) and their dimensions.',
        inputSchema: {
          type: 'object',
          properties: { spreadsheetId: { type: 'string' } },
          required: ['spreadsheetId'],
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'get_range',
        label: 'Get cell range',
        description:
          'Fetch the real values of a range (e.g. "Sheet1!A1:D50") — rows are returned exactly as stored, never inferred.',
        inputSchema: {
          type: 'object',
          properties: {
            spreadsheetId: { type: 'string' },
            range: { type: 'string' },
          },
          required: ['spreadsheetId', 'range'],
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
      case 'list_spreadsheets': {
        const result = await this.executeWithAuth(credential, (token) =>
          listGoogleDriveFiles(token, {
            mimeType: SHEET_MIME_TYPE,
            orderBy: 'modifiedTime desc',
            pageSize: num(input['maxResults']) ?? 25,
          }),
        );
        return { success: true, message: `Found ${result.files.length} spreadsheet(s).`, data: result };
      }
      case 'search_spreadsheets': {
        const query = String(input['query'] ?? '').replace(/'/g, "\\'");
        const result = await this.executeWithAuth(credential, (token) =>
          listGoogleDriveFiles(token, { mimeType: SHEET_MIME_TYPE, q: `fullText contains '${query}'`, pageSize: 25 }),
        );
        return { success: true, message: `Found ${result.files.length} matching spreadsheet(s).`, data: result };
      }
      case 'get_spreadsheet': {
        const spreadsheetId = String(input['spreadsheetId'] ?? '');
        const sheet = await this.executeWithAuth(credential, (token) =>
          axios.get(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { fields: 'properties(title),sheets(properties(sheetId,title,gridProperties))' },
          }),
        );
        const tabs = (sheet.data.sheets ?? []).map((s: any) => ({
          sheetId: s.properties?.sheetId,
          title: s.properties?.title,
          rowCount: s.properties?.gridProperties?.rowCount,
          columnCount: s.properties?.gridProperties?.columnCount,
        }));
        return {
          success: true,
          message: `"${sheet.data.properties?.title}" has ${tabs.length} tab(s).`,
          data: { title: sheet.data.properties?.title, tabs },
        };
      }
      case 'get_range': {
        const spreadsheetId = String(input['spreadsheetId'] ?? '');
        const range = String(input['range'] ?? '');
        const values = await this.executeWithAuth(credential, (token) =>
          axios.get(
            `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        );
        const rows: unknown[][] = values.data.values ?? [];
        return {
          success: true,
          message: `Fetched ${rows.length} row(s) from ${range}.`,
          data: { range, rows },
        };
      }
      default:
        throw new BadRequestException(`Unknown Google Sheets action '${actionId}'.`);
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
