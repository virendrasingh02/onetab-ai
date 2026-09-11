import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { GitHubProvider } from './github.provider.js';

describe('GitHubProvider', () => {
  let provider: GitHubProvider;
  let mockConfig: Record<string, string | undefined>;

  beforeEach(() => {
    mockConfig = {
      GITHUB_CLIENT_ID: 'test-github-client-id',
      GITHUB_CLIENT_SECRET: 'test-github-client-secret',
    };
    const configService = { get: vi.fn((key: string) => mockConfig[key]) } as unknown as ConfigService;
    provider = new GitHubProvider(configService);
  });

  it('exposes accurate GitHub capabilities', () => {
    const caps = provider.getCapabilities();
    expect(caps.provider).toBe('GITHUB');
    expect(caps.authType).toBe('OAUTH2');
    expect(caps.supportsWebhooks).toBe(true);
  });

  it('synthesizes an authorization URL requesting repo scope', async () => {
    const authUrl = await provider.getAuthorizationUrl('state-gh');
    expect(authUrl).toContain('https://github.com/login/oauth/authorize');
    expect(authUrl).toContain('client_id=test-github-client-id');
    expect(decodeURIComponent(authUrl)).toContain('repo');
    expect(authUrl).toContain('state=state-gh');
  });

  it('gates create_issue and comment_on_issue behind confirmation, leaves reads free', () => {
    const actions = provider.getActions();
    expect(actions.find((a) => a.id === 'create_issue')?.requiresConfirmation).toBe(true);
    expect(actions.find((a) => a.id === 'comment_on_issue')?.requiresConfirmation).toBe(true);
    expect(actions.find((a) => a.id === 'list_issues')?.requiresConfirmation).toBe(false);
    expect(actions.find((a) => a.id === 'list_review_requests')).toBeDefined();
  });

  it('refuses to build an authorization URL without configured client credentials', async () => {
    mockConfig = {};
    await expect(provider.getAuthorizationUrl('state')).rejects.toThrow(/GITHUB_CLIENT_ID/);
  });
});
