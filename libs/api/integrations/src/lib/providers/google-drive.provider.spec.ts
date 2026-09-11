import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { GoogleDriveProvider } from './google-drive.provider.js';

describe('GoogleDriveProvider', () => {
  let provider: GoogleDriveProvider;
  let mockConfig: Record<string, string | undefined>;

  beforeEach(() => {
    mockConfig = {
      GOOGLE_CLIENT_ID: 'test-google-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    };

    const configService = {
      get: vi.fn((key: string) => mockConfig[key]),
    } as unknown as ConfigService;

    provider = new GoogleDriveProvider(configService);
  });

  it('exposes accurate Google Drive capabilities', () => {
    const caps = provider.getCapabilities();

    expect(caps.provider).toBe('GOOGLE_DRIVE');
    expect(caps.authType).toBe('OAUTH2');
    expect(caps.supportsMessaging).toBe(false);
    expect(caps.scopes?.some((s) => s.scope.includes('drive.readonly'))).toBe(true);
  });

  it('synthesizes an authorization URL requesting the drive.readonly and drive.file scopes', async () => {
    const authUrl = await provider.getAuthorizationUrl('state-abc');
    const decoded = decodeURIComponent(authUrl);

    expect(authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(decoded).toContain('drive.readonly');
    expect(decoded).toContain('drive.file');
  });

  it('registers upload_file as a write action and list/search as reads', () => {
    const actions = provider.getActions();
    const upload = actions.find((a) => a.id === 'upload_file');
    const list = actions.find((a) => a.id === 'list_files');

    expect(upload?.permissionLevel).toBe('write');
    expect(list?.permissionLevel).toBe('read');
    expect(list?.requiresConfirmation).toBe(false);
  });
});
