import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { deriveWebhookSecret } from '../core/webhook-secret.js';
import type { ResolvedCredential } from '../core/provider-adapter.interface.js';
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

  describe('webhooks', () => {
    const credential = { id: 'int_1' } as ResolvedCredential;
    const sign = (body: string, id = 'int_1') => {
      const config = { get: (k: string) => mockConfig[k] };
      return `sha256=${createHmac('sha256', deriveWebhookSecret(config, id)).update(body).digest('hex')}`;
    };

    it('accepts a push signed with the connection secret and rejects any other', () => {
      const body = JSON.stringify({ action: 'opened' });
      expect(provider.verifyWebhook(credential, body, { 'x-hub-signature-256': sign(body) })).toBe(true);
      expect(provider.verifyWebhook(credential, body + ' ', { 'x-hub-signature-256': sign(body) })).toBe(false);
      expect(provider.verifyWebhook(credential, body, { 'x-hub-signature-256': sign(body, 'other') })).toBe(false);
      expect(provider.verifyWebhook(credential, body, {})).toBe(false);
    });

    it('turns a merged pull request into a pull_request event', () => {
      const [event] = provider.parseWebhookEvents(
        credential,
        {
          action: 'closed',
          repository: { full_name: 'acme/web' },
          pull_request: { id: 9, number: 4, title: 'Fix', html_url: 'u', user: { login: 'jo' }, merged: true, base: { ref: 'main' }, head: { ref: 'fix' } },
        },
        { 'x-github-event': 'pull_request', 'x-github-delivery': 'd1' },
      );
      expect(event).toMatchObject({ eventId: 'd1', triggerId: 'pull_request', item: { action: 'merged', merged: true, repository: 'acme/web', number: 4 } });
    });

    it('ignores pull-request actions nobody reacts to and unrelated events', () => {
      expect(provider.parseWebhookEvents(credential, { action: 'labeled', pull_request: {} }, { 'x-github-event': 'pull_request' })).toEqual([]);
      expect(provider.parseWebhookEvents(credential, {}, { 'x-github-event': 'ping' })).toEqual([]);
    });
  });
});
