import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { GoogleCalendarProvider } from './google-calendar.provider.js';

describe('GoogleCalendarProvider', () => {
  let provider: GoogleCalendarProvider;
  let mockConfig: Record<string, string | undefined>;

  beforeEach(() => {
    mockConfig = {
      GOOGLE_CLIENT_ID: 'test-google-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    };

    const configService = {
      get: vi.fn((key: string) => mockConfig[key]),
    } as unknown as ConfigService;

    provider = new GoogleCalendarProvider(configService);
  });

  it('exposes accurate Google Calendar capabilities', () => {
    const caps = provider.getCapabilities();

    expect(caps.provider).toBe('GOOGLE_CALENDAR');
    expect(caps.authType).toBe('OAUTH2');
    expect(caps.supportsMessaging).toBe(false);
    expect(caps.supportsSync).toBe(true);
    expect(caps.scopes?.length).toBeGreaterThan(0);
  });

  it('synthesizes an authorization URL scoped to Calendar with the correct default callback path', async () => {
    const authUrl = await provider.getAuthorizationUrl('signed-state-xyz');

    expect(authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(authUrl).toContain('client_id=test-google-client-id.apps.googleusercontent.com');
    expect(authUrl).toContain('access_type=offline');
    expect(authUrl).toContain('state=signed-state-xyz');
    expect(decodeURIComponent(authUrl)).toContain('calendar.readonly');
    expect(decodeURIComponent(authUrl)).toContain('calendar.events');
  });

  it('registers create/update/delete actions as confirmation-gated writes', () => {
    const actions = provider.getActions();
    const create = actions.find((a) => a.id === 'create_event');
    const del = actions.find((a) => a.id === 'delete_event');
    const list = actions.find((a) => a.id === 'list_events');

    expect(create?.requiresConfirmation).toBe(true);
    expect(del?.requiresConfirmation).toBe(true);
    expect(del?.permissionLevel).toBe('destructive');
    expect(list?.requiresConfirmation).toBe(false);
    expect(list?.permissionLevel).toBe('read');
  });

  it('refuses to build an authorization URL without configured client credentials', async () => {
    mockConfig = {};
    await expect(provider.getAuthorizationUrl('state')).rejects.toThrow(/GOOGLE_CLIENT_ID/);
  });
});
