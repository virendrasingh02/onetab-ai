import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { LinearProvider } from './linear.provider.js';

describe('LinearProvider', () => {
  let provider: LinearProvider;
  let mockConfig: Record<string, string | undefined>;

  beforeEach(() => {
    mockConfig = {
      LINEAR_CLIENT_ID: 'test-linear-client-id',
      LINEAR_CLIENT_SECRET: 'test-linear-client-secret',
    };
    const configService = { get: vi.fn((key: string) => mockConfig[key]) } as unknown as ConfigService;
    provider = new LinearProvider(configService);
  });

  it('exposes accurate Linear capabilities', () => {
    const caps = provider.getCapabilities();
    expect(caps.provider).toBe('LINEAR');
    expect(caps.authType).toBe('OAUTH2');
  });

  it('synthesizes an authorization URL against linear.app/oauth/authorize', async () => {
    const authUrl = await provider.getAuthorizationUrl('state-linear');
    expect(authUrl).toContain('https://linear.app/oauth/authorize');
    expect(authUrl).toContain('client_id=test-linear-client-id');
    expect(authUrl).toContain('state=state-linear');
  });

  it('gates create/update/comment behind confirmation, leaves list/get/search free', () => {
    const actions = provider.getActions();
    for (const id of ['create_issue', 'update_issue', 'add_comment']) {
      expect(actions.find((a) => a.id === id)?.requiresConfirmation).toBe(true);
    }
    for (const id of ['list_issues', 'get_issue', 'search_issues', 'list_teams']) {
      expect(actions.find((a) => a.id === id)?.requiresConfirmation).toBe(false);
    }
  });

  it('refuses to build an authorization URL without configured client credentials', async () => {
    mockConfig = {};
    await expect(provider.getAuthorizationUrl('state')).rejects.toThrow(/LINEAR_CLIENT_ID/);
  });
});
