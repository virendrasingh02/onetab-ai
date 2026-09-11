import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { SlackProvider } from './slack.provider.js';

describe('SlackProvider', () => {
  let provider: SlackProvider;
  let mockConfig: Record<string, string | undefined>;

  beforeEach(() => {
    mockConfig = {
      SLACK_CLIENT_ID: 'test-slack-client-id',
      SLACK_CLIENT_SECRET: 'test-slack-client-secret',
    };
    const configService = { get: vi.fn((key: string) => mockConfig[key]) } as unknown as ConfigService;
    provider = new SlackProvider(configService);
  });

  it('exposes accurate Slack capabilities', () => {
    const caps = provider.getCapabilities();
    expect(caps.provider).toBe('SLACK');
    expect(caps.authType).toBe('OAUTH2');
    expect(caps.supportsMessaging).toBe(true);
  });

  it('requests a user token (not a bot token) via user_scope', async () => {
    const authUrl = await provider.getAuthorizationUrl('state-slack');
    expect(authUrl).toContain('https://slack.com/oauth/v2/authorize');
    expect(decodeURIComponent(authUrl)).toContain('user_scope=');
    expect(decodeURIComponent(authUrl)).toContain('search:read');
    expect(decodeURIComponent(authUrl)).toContain('chat:write');
  });

  it('gates send_message and reply_in_thread behind confirmation, leaves reads/reactions free', () => {
    const actions = provider.getActions();
    expect(actions.find((a) => a.id === 'send_message')?.requiresConfirmation).toBe(true);
    expect(actions.find((a) => a.id === 'reply_in_thread')?.requiresConfirmation).toBe(true);
    expect(actions.find((a) => a.id === 'search_messages')?.requiresConfirmation).toBe(false);
    expect(actions.find((a) => a.id === 'add_reaction')?.requiresConfirmation).toBe(false);
  });

  it('refuses to build an authorization URL without configured client credentials', async () => {
    mockConfig = {};
    await expect(provider.getAuthorizationUrl('state')).rejects.toThrow(/SLACK_CLIENT_ID/);
  });
});
