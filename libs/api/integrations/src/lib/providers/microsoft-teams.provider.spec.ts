import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
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

  it('exposes all 14 required structured actions matching specifications', () => {
    const actions = provider.getActions();
    expect(actions).toHaveLength(14);

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

  it('exposes event triggers for channels, mentions, and meetings', () => {
    const triggers = provider.getTriggers();
    expect(triggers).toHaveLength(3);
    const triggerIds = triggers.map((t) => t.id);
    expect(triggerIds).toContain('new_message');
    expect(triggerIds).toContain('mention');
    expect(triggerIds).toContain('meeting_event');
  });

  it('validates connection health in testConnection', async () => {
    const result = await provider.testConnection({}, {
      id: 'cred-1',
      provider: 'MICROSOFT_TEAMS',
      scopeType: 'WORKSPACE',
      accessToken: 'simulated_test_token',
      metadata: { accountEmail: 'lead@company.com' },
      scopes: TEAMS_SCOPES,
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Microsoft Teams');
  });

  it('executes send_channel_message action in sandbox mode', async () => {
    const credential = {
      id: 'cred-1',
      provider: 'MICROSOFT_TEAMS',
      scopeType: 'WORKSPACE',
      accessToken: 'simulated_test_token',
      metadata: { accountEmail: 'lead@company.com' },
      scopes: TEAMS_SCOPES,
    };

    const res = await provider.executeAction(credential, 'send_channel_message', {
      teamId: 'team-eng',
      channelId: 'chan-alerts',
      content: 'Critical deployment succeeded',
    });

    expect(res.success).toBe(true);
    expect(res.message).toContain('Microsoft Teams');
    expect(res.data).toBeDefined();
    expect((res.data as any).channelId).toBe('chan-alerts');
  });

  it('executes create_meeting action in sandbox mode', async () => {
    const credential = {
      id: 'cred-1',
      provider: 'MICROSOFT_TEAMS',
      scopeType: 'WORKSPACE',
      accessToken: 'simulated_test_token',
      metadata: {},
      scopes: TEAMS_SCOPES,
    };

    const res = await provider.executeAction(credential, 'create_meeting', {
      subject: 'Architecture Alignment',
      startDateTime: '2026-10-09T10:00:00Z',
      endDateTime: '2026-10-09T11:00:00Z',
    });

    expect(res.success).toBe(true);
    expect((res.data as any).joinWebUrl).toContain('teams.microsoft.com');
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
