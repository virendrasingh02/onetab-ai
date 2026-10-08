import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

vi.mock('axios', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { post: vi.fn(), isAxiosError: () => false }) };
});
import { MicrosoftTeamsProvider, TEAMS_SCOPES } from './microsoft-teams.provider.js';

describe('MicrosoftTeamsProvider', () => {
  let provider: MicrosoftTeamsProvider;
  let mockConfig: Record<string, string | undefined>;

  beforeEach(() => {
    mockConfig = {
      MICROSOFT_TEAMS_CLIENT_ID: 'test-teams-client-id',
      MICROSOFT_TEAMS_CLIENT_SECRET: 'test-teams-client-secret',
      AZURE_TENANT_ID: 'common',
    };
    const configService = {
      get: vi.fn((key: string) => mockConfig[key]),
    } as unknown as ConfigService;
    provider = new MicrosoftTeamsProvider(configService);
  });

  it('exposes accurate Microsoft Teams capabilities', () => {
    const caps = provider.getCapabilities();
    expect(caps.provider).toBe('MICROSOFT_TEAMS');
    expect(caps.displayName).toBe('Microsoft Teams');
    expect(caps.authType).toBe('OAUTH2');
    expect(caps.supportsMessaging).toBe(true);
    expect(caps.supportsWebhooks).toBe(true);
    expect(caps.scopes?.length).toBeGreaterThan(0);
  });

  it('generates Microsoft Graph OAuth authorization URL', async () => {
    const authUrl = await provider.getAuthorizationUrl('state-teams-123');
    expect(authUrl).toContain('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    expect(authUrl).toContain('client_id=test-teams-client-id');
    expect(authUrl).toContain('state=state-teams-123');
    expect(decodeURIComponent(authUrl)).toContain('scope=');
    expect(decodeURIComponent(authUrl)).toContain('ChannelMessage.Send');
  });

  it('exposes the structured Teams actions', () => {
    const actions = provider.getActions();
    expect(actions).toHaveLength(15);

    const actionIds = actions.map((a) => a.id);
    expect(actionIds).toEqual(
      expect.arrayContaining([
        'list_teams',
        'get_team',
        'list_channels',
        'get_channel',
        'get_members',
        'send_channel_message',
        'send_direct_message',
        'search_messages',
        'list_channel_messages',
        'get_message',
        'reply_to_message',
        'create_meeting',
        'get_meeting',
        'update_meeting',
        'cancel_meeting',
      ]),
    );

    // Cancel meeting is destructive and requires confirmation
    const cancelMeeting = actions.find((a) => a.id === 'cancel_meeting');
    expect(cancelMeeting?.permissionLevel).toBe('destructive');
    expect(cancelMeeting?.requiresConfirmation).toBe(true);

    // Read actions do not require confirmation
    const listTeams = actions.find((a) => a.id === 'list_teams');
    expect(listTeams?.permissionLevel).toBe('read');
    expect(listTeams?.requiresConfirmation).toBe(false);

    const searchMessages = actions.find((a) => a.id === 'search_messages');
    expect(searchMessages?.permissionLevel).toBe('read');
  });

  it('declares a polled new-message trigger backed by a read action', () => {
    const triggers = provider.getTriggers();
    expect(triggers.map((t) => t.id)).toEqual(['new_message']);
    const read = provider.getActions().find((a) => a.id === triggers[0].pollActionId);
    expect(read?.permissionLevel).toBe('read');
  });

  it('refuses to connect when the server has no Azure app, instead of faking a connection', async () => {
    mockConfig = {};
    expect(provider.isServerConfigured()).toBe(false);
    await expect(provider.getAuthorizationUrl('state')).rejects.toThrow(/isn’t set up on this server/);
    await expect(provider.handleCallback('code', 'state')).rejects.toThrow(/isn’t set up on this server/);
  });

  it('searches Teams chat messages through the Microsoft Search API', async () => {
    const call = axios as unknown as ReturnType<typeof vi.fn>;
    call.mockResolvedValueOnce({
      data: { value: [{ hitsContainers: [{ hits: [{ hitId: 'm1', summary: 'deploy done', resource: { from: 'a' } }] }] }] },
    });
    const res = await provider.executeAction(
      { id: 'cred-1', provider: 'MICROSOFT_TEAMS', scopeType: 'USER', accessToken: 'real-token', metadata: {}, scopes: TEAMS_SCOPES },
      'search_messages',
      { query: 'deploy' },
    );
    const request = call.mock.calls[0][0] as { url: string; method: string; data: { requests: Array<{ entityTypes: string[] }> } };
    expect(request.url).toBe('https://graph.microsoft.com/v1.0/search/query');
    expect(request.method).toBe('POST');
    expect(request.data.requests[0].entityTypes).toEqual(['chatMessage']);
    expect(res.data).toEqual({ messages: [{ id: 'm1', summary: 'deploy done', from: 'a' }], count: 1 });
  });

  it('processes incoming webhook event notifications', async () => {
    const webhookRes = await provider.handleWebhook(
      {
        value: [
          {
            subscriptionId: 'sub-123',
            clientState: 'evt-teams-01',
            resource: 'teams/team-1/channels/chan-1/messages',
            changeType: 'created',
          },
        ],
      },
      {},
    );

    expect(webhookRes.success).toBe(true);
    expect(webhookRes.eventType).toBe('new_message');
    expect(webhookRes.eventId).toBe('evt-teams-01');
  });
});
