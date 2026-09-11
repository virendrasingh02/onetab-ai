import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { NotionProvider } from './notion.provider.js';

describe('NotionProvider', () => {
  let provider: NotionProvider;
  let mockConfig: Record<string, string | undefined>;

  beforeEach(() => {
    mockConfig = {
      NOTION_CLIENT_ID: 'test-notion-client-id',
      NOTION_CLIENT_SECRET: 'test-notion-client-secret',
    };
    const configService = { get: vi.fn((key: string) => mockConfig[key]) } as unknown as ConfigService;
    provider = new NotionProvider(configService);
  });

  it('exposes accurate Notion capabilities', () => {
    const caps = provider.getCapabilities();
    expect(caps.provider).toBe('NOTION');
    expect(caps.authType).toBe('OAUTH2');
  });

  it('synthesizes an authorization URL against api.notion.com/v1/oauth/authorize', async () => {
    const authUrl = await provider.getAuthorizationUrl('state-notion');
    expect(authUrl).toContain('https://api.notion.com/v1/oauth/authorize');
    expect(authUrl).toContain('client_id=test-notion-client-id');
    expect(authUrl).toContain('owner=user');
  });

  it('gates create_page and add_comment behind confirmation, leaves search/get free', () => {
    const actions = provider.getActions();
    expect(actions.find((a) => a.id === 'create_page')?.requiresConfirmation).toBe(true);
    expect(actions.find((a) => a.id === 'add_comment')?.requiresConfirmation).toBe(true);
    expect(actions.find((a) => a.id === 'search')?.requiresConfirmation).toBe(false);
    expect(actions.find((a) => a.id === 'get_page')?.requiresConfirmation).toBe(false);
  });

  it('refuses to build an authorization URL without configured client credentials', async () => {
    mockConfig = {};
    await expect(provider.getAuthorizationUrl('state')).rejects.toThrow(/NOTION_CLIENT_ID/);
  });
});
