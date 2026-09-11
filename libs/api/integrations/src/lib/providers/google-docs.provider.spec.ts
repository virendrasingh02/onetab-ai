import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { GoogleDocsProvider } from './google-docs.provider.js';

describe('GoogleDocsProvider', () => {
  let provider: GoogleDocsProvider;
  let mockConfig: Record<string, string | undefined>;

  beforeEach(() => {
    mockConfig = {
      GOOGLE_CLIENT_ID: 'test-google-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    };

    const configService = {
      get: vi.fn((key: string) => mockConfig[key]),
    } as unknown as ConfigService;

    provider = new GoogleDocsProvider(configService);
  });

  it('exposes accurate Google Docs capabilities', () => {
    const caps = provider.getCapabilities();

    expect(caps.provider).toBe('GOOGLE_DOCS');
    expect(caps.authType).toBe('OAUTH2');
    expect(caps.scopes?.some((s) => s.scope.includes('documents.readonly'))).toBe(true);
  });

  it('only registers read actions — Docs is a viewer, not an editor', () => {
    const actions = provider.getActions();
    expect(actions.every((a) => a.permissionLevel === 'read')).toBe(true);
    expect(actions.map((a) => a.id)).toEqual(
      expect.arrayContaining(['list_documents', 'search_documents', 'get_document']),
    );
  });

  it('synthesizes an authorization URL using its own default callback path', async () => {
    const authUrl = await provider.getAuthorizationUrl('state-docs');
    expect(decodeURIComponent(authUrl)).toContain(
      'http://localhost:3000/api/v1/integrations/google_docs/callback',
    );
  });
});
