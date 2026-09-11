import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { GoogleSheetsProvider } from './google-sheets.provider.js';

describe('GoogleSheetsProvider', () => {
  let provider: GoogleSheetsProvider;
  let mockConfig: Record<string, string | undefined>;

  beforeEach(() => {
    mockConfig = {
      GOOGLE_CLIENT_ID: 'test-google-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    };

    const configService = {
      get: vi.fn((key: string) => mockConfig[key]),
    } as unknown as ConfigService;

    provider = new GoogleSheetsProvider(configService);
  });

  it('exposes accurate Google Sheets capabilities', () => {
    const caps = provider.getCapabilities();

    expect(caps.provider).toBe('GOOGLE_SHEETS');
    expect(caps.authType).toBe('OAUTH2');
    expect(caps.scopes?.some((s) => s.scope.includes('spreadsheets.readonly'))).toBe(true);
  });

  it('only registers read actions — never writes cell values', () => {
    const actions = provider.getActions();
    expect(actions.every((a) => a.permissionLevel === 'read')).toBe(true);
    expect(actions.every((a) => a.requiresConfirmation === false)).toBe(true);
  });

  it('synthesizes an authorization URL using its own default callback path', async () => {
    const authUrl = await provider.getAuthorizationUrl('state-sheets');
    expect(decodeURIComponent(authUrl)).toContain(
      'http://localhost:3000/api/v1/integrations/google_sheets/callback',
    );
  });
});
