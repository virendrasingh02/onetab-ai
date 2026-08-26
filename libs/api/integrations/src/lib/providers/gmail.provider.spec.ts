import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { GmailProvider } from './gmail.provider.js';

describe('GmailProvider', () => {
  let provider: GmailProvider;
  let mockConfig: Record<string, string | undefined>;

  beforeEach(() => {
    mockConfig = {
      GOOGLE_CLIENT_ID: 'test-google-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
      GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/v1/integrations/gmail/callback',
    };

    const configService = {
      get: vi.fn((key: string) => mockConfig[key]),
    } as unknown as ConfigService;

    provider = new GmailProvider(configService);
  });

  it('exposes accurate Gmail provider capabilities', () => {
    const caps = provider.getCapabilities();

    expect(caps.provider).toBe('GMAIL');
    expect(caps.authType).toBe('OAUTH2');
    expect(caps.supportsMessaging).toBe(true);
    expect(caps.supportsSync).toBe(true);
    expect(caps.scopes?.length).toBeGreaterThan(0);
  });

  it('synthesizes Google OAuth 2.0 authorization URL with minimal required scopes', async () => {
    const state = 'signed-oauth-state-xyz';
    const authUrl = await provider.getAuthorizationUrl(state);

    expect(authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(authUrl).toContain('client_id=test-google-client-id.apps.googleusercontent.com');
    expect(authUrl).toContain('access_type=offline');
    expect(authUrl).toContain('prompt=consent');
    expect(authUrl).toContain('state=signed-oauth-state-xyz');
    expect(authUrl).toContain('gmail.readonly');
    expect(authUrl).toContain('gmail.send');
  });
});
