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
  redirectUriEnvKey: 'GOOGLE_DRIVE_REDIRECT_URI',
  defaultCallbackPath: 'google_drive',
};

const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

@Injectable()
export class GoogleDriveProvider implements ProviderAdapter {
  readonly providerId = 'GOOGLE_DRIVE';
  private readonly logger = new Logger(GoogleDriveProvider.name);

  constructor(private readonly config: ConfigService) {}

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      displayName: 'Google Drive',
      description:
        'Browse, search, and preview files and folders in Google Drive; upload new files the app creates.',
      category: 'Productivity & Project Management',
      authType: 'OAUTH2',
      supportsSync: true,
      supportsWebhooks: false,
      supportsMessaging: false,
      supportsCustomEndpoints: false,
      scopes: [
        {
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          description: 'View files and folders in your Drive',
          required: true,
        },
        {
          scope: 'https://www.googleapis.com/auth/drive.file',
          description: 'Upload and manage files this app creates',
          required: false,
        },
      ],
    };
  }

  async getAuthorizationUrl(
    state: string,
    options?: { redirectUri?: string; scopes?: string[]; loginHint?: string },
  ): Promise<string> {
    return buildGoogleAuthorizationUrl(this.config, OAUTH_OPTS, DRIVE_SCOPES, state, options);
  }

  async handleCallback(
    code: string,
    _state: string,
    options?: { redirectUri?: string },
  ): Promise<TokenResult> {
    return exchangeGoogleAuthorizationCode(this.config, OAUTH_OPTS, code, DRIVE_SCOPES, options);
  }

  async refreshToken(refreshToken: string): Promise<TokenResult> {
    return refreshGoogleAccessToken(this.config, refreshToken);
  }

  async getAccount(credential: ResolvedCredential): Promise<IntegrationAccount> {
    const about = await this.executeWithAuth(credential, (token) =>
      axios.get<{ user: { emailAddress: string; displayName: string; photoLink?: string }; storageQuota: Record<string, string> }>(
        'https://www.googleapis.com/drive/v3/about',
        { headers: { Authorization: `Bearer ${token}` }, params: { fields: 'user,storageQuota' } },
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
      metadata: { storageQuota: about.data.storageQuota },
    };
  }

  async disconnect(credential: ResolvedCredential): Promise<void> {
    if (credential.accessToken) await revokeGoogleToken(credential.accessToken);
  }

  async testConnection(
    _config: Record<string, unknown>,
    credential?: ResolvedCredential,
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    if (!credential) return { success: false, message: 'No credential provided for Google Drive connection test.' };
    try {
      const account = await this.getAccount(credential);
      return { success: true, message: `Successfully connected to Google Drive for ${account.email}`, details: account };
    } catch (err: any) {
      return { success: false, message: `Google Drive connection test failed: ${err.message}` };
    }
  }

  async sync(credential: ResolvedCredential): Promise<SyncResult> {
    const result = await this.executeWithAuth(credential, (token) =>
      listGoogleDriveFiles(token, { orderBy: 'modifiedTime desc', pageSize: 25 }),
    );
    return { success: true, itemsProcessed: result.files.length };
  }

  async handleWebhook(payload: unknown): Promise<WebhookProcessResult> {
    this.logger.log('Google Drive does not have an active push-notification channel registered.');
    return { success: true, eventType: 'google_drive.unsubscribed', data: payload };
  }

  getActions(): AppActionDefinition[] {
    return [
      {
        id: 'list_files',
        label: 'List files',
        description: 'List files and folders, optionally within one folder.',
        inputSchema: {
          type: 'object',
          properties: {
            folderId: { type: 'string' },
            maxResults: { type: 'number' },
          },
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'search_files',
        label: 'Search files',
        description: 'Full-text search across file names and content.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            mimeType: { type: 'string' },
          },
          required: ['query'],
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'get_file',
        label: 'Get file details',
        description: 'Fetch metadata (owner, links, size, sharing) for one file.',
        inputSchema: {
          type: 'object',
          properties: { fileId: { type: 'string' } },
          required: ['fileId'],
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_recent',
        label: 'Recent files',
        description: 'Files ordered by most recently modified.',
        inputSchema: { type: 'object', properties: { maxResults: { type: 'number' } } },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_shared_with_me',
        label: 'Shared with me',
        description: 'Files other people have shared with you.',
        inputSchema: { type: 'object', properties: { maxResults: { type: 'number' } } },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'upload_file',
        label: 'Upload file',
        description:
          'Upload a new file (only files this app creates can be managed later, per the drive.file scope).',
        inputSchema: {
          type: 'object',
          properties: {
            filename: { type: 'string' },
            mimeType: { type: 'string' },
            contentBase64: { type: 'string' },
            folderId: { type: 'string' },
          },
          required: ['filename', 'mimeType', 'contentBase64'],
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
      case 'list_files': {
        const result = await this.executeWithAuth(credential, (token) =>
          listGoogleDriveFiles(token, {
            q: input['folderId'] ? `'${String(input['folderId'])}' in parents` : undefined,
            pageSize: num(input['maxResults']) ?? 25,
            orderBy: 'folder,modifiedTime desc',
          }),
        );
        return { success: true, message: `Found ${result.files.length} item(s).`, data: result };
      }
      case 'search_files': {
        const query = String(input['query'] ?? '').replace(/'/g, "\\'");
        const result = await this.executeWithAuth(credential, (token) =>
          listGoogleDriveFiles(token, {
            q: `fullText contains '${query}'`,
            mimeType: str(input['mimeType']),
            pageSize: 25,
          }),
        );
        return { success: true, message: `Found ${result.files.length} matching file(s).`, data: result };
      }
      case 'get_file': {
        const file = await this.executeWithAuth(credential, (token) =>
          axios.get(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(String(input['fileId'] ?? ''))}`, {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              fields:
                'id, name, mimeType, iconLink, webViewLink, webContentLink, thumbnailLink, modifiedTime, createdTime, size, owners(displayName, emailAddress), shared, permissions(emailAddress, role), description',
            },
          }),
        );
        return { success: true, message: `Fetched "${file.data.name}".`, data: { file: file.data } };
      }
      case 'list_recent': {
        const result = await this.executeWithAuth(credential, (token) =>
          listGoogleDriveFiles(token, { orderBy: 'viewedByMeTime desc', pageSize: num(input['maxResults']) ?? 25 }),
        );
        return { success: true, message: `${result.files.length} recent file(s).`, data: result };
      }
      case 'list_shared_with_me': {
        const result = await this.executeWithAuth(credential, (token) =>
          listGoogleDriveFiles(token, { q: 'sharedWithMe', pageSize: num(input['maxResults']) ?? 25 }),
        );
        return { success: true, message: `${result.files.length} file(s) shared with you.`, data: result };
      }
      case 'upload_file': {
        const file = await this.executeWithAuth(credential, (token) => this.uploadFile(token, input));
        return { success: true, message: `Uploaded "${file.name}".`, data: { file } };
      }
      default:
        throw new BadRequestException(`Unknown Google Drive action '${actionId}'.`);
    }
  }

  private async uploadFile(token: string, input: Record<string, unknown>) {
    const filename = String(input['filename'] ?? 'Untitled');
    const mimeType = String(input['mimeType'] ?? 'application/octet-stream');
    const contentBase64 = String(input['contentBase64'] ?? '');
    const folderId = str(input['folderId']);

    const boundary = `----onetab-${Date.now()}`;
    const metadata = JSON.stringify({ name: filename, parents: folderId ? [folderId] : undefined });
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n${contentBase64}\r\n` +
      `--${boundary}--`;

    const res = await axios.post(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      body,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
      },
    );
    return res.data as { id: string; name: string };
  }

  private async executeWithAuth<T>(
    credential: ResolvedCredential,
    fn: (token: string) => Promise<T>,
  ): Promise<T> {
    return executeWithGoogleAuth(this.config, credential, fn);
  }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}
