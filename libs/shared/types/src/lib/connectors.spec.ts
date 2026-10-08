import { describe, expect, it } from 'vitest';
import type { AppActionDefinition } from './integrations.js';
import {
  buildConnectorManifest,
  connectorActionRef,
  connectorStatus,
  connectorToolName,
  diffPolledItems,
  normalizeConnectorCategory,
  parseConnectorActionRef,
  parseConnectorTriggerEventType,
  selectAgentTools,
  summarizeConnectorUsage,
  type ConnectorManifestSource,
} from './connectors.js';

const caps = (over: Partial<ConnectorManifestSource> = {}): ConnectorManifestSource => ({
  provider: 'SLACK',
  displayName: 'Slack',
  description: 'Team chat',
  category: 'Customer Support & Communication',
  authType: 'OAUTH2',
  supportsSync: false,
  supportsWebhooks: true,
  supportsMessaging: true,
  supportsCustomEndpoints: false,
  ...over,
});

const action = (id: string, permissionLevel: AppActionDefinition['permissionLevel']): AppActionDefinition => ({
  id,
  label: id.replace(/_/g, ' '),
  description: '',
  inputSchema: { type: 'object', properties: {} },
  permissionLevel,
  requiresConfirmation: permissionLevel !== 'read',
});

describe('normalizeConnectorCategory', () => {
  it('prefers a declared category', () => {
    expect(normalizeConnectorCategory('email', 'Productivity & Project Management')).toBe('email');
  });
  it('falls back to keywords, then custom', () => {
    expect(normalizeConnectorCategory(undefined, 'Developer Tools')).toBe('developer_tools');
    expect(normalizeConnectorCategory('nonsense', 'Customer Support & Communication')).toBe('customer_support');
    expect(normalizeConnectorCategory(undefined, '')).toBe('custom');
  });
});

describe('buildConnectorManifest', () => {
  const manifest = buildConnectorManifest(
    caps({ connectorCategory: 'communication' }),
    [action('list_messages', 'read'), action('send_message', 'write'), action('delete_message', 'destructive')],
    [
      { id: 'new_message', label: 'New message', description: '', pollActionId: 'list_messages', itemsPath: 'messages', idField: 'ts' },
      // Watches a write: dropped, it could never run.
      { id: 'bogus', label: 'Bogus', description: '', pollActionId: 'send_message', itemsPath: 'x', idField: 'id' },
    ],
  );

  it('splits reads into queries and the rest into actions, with canonical tool names', () => {
    expect(manifest.counts).toEqual({ actions: 2, queries: 1, triggers: 1 });
    const send = manifest.capabilities.find((c) => c.id === 'send_message')!;
    expect(send.kind).toBe('action');
    expect(send.toolName).toBe('slack_send_message');
    expect(send.actionRef).toBe('SLACK.send_message');
  });

  it('keeps only triggers that watch a read, with their event type', () => {
    expect(manifest.triggers.map((t) => t.eventType)).toEqual(['connector:SLACK:new_message']);
  });

  it('derives agent capabilities from category and capability mix', () => {
    expect(manifest.agentCapabilities).toEqual(
      expect.arrayContaining(['communication', 'notification', 'collaboration', 'research', 'automation']),
    );
  });

  it('says why a connector is unavailable on this server', () => {
    const off = buildConnectorManifest(caps(), [], [], { configured: false });
    expect(off.serverConfigured).toBe(false);
    expect(off.unavailableReason).toMatch(/Slack/);
  });
});

describe('naming', () => {
  it('round-trips action refs and trigger event types', () => {
    expect(connectorToolName('GOOGLE_CALENDAR', 'create-event')).toBe('google_calendar_create_event');
    expect(parseConnectorActionRef(connectorActionRef('github', 'create_issue'))).toEqual({ provider: 'GITHUB', actionId: 'create_issue' });
    expect(parseConnectorActionRef('nodot')).toBeNull();
    expect(parseConnectorTriggerEventType('connector:GMAIL:new_email')).toEqual({ provider: 'GMAIL', triggerId: 'new_email' });
    expect(parseConnectorTriggerEventType('task.created')).toBeNull();
  });
});

describe('connectorStatus', () => {
  it('ranks connected over broken over absent', () => {
    expect(connectorStatus([{ status: 'ERROR' }, { status: 'CONNECTED' }], true)).toBe('connected');
    expect(connectorStatus([{ status: 'EXPIRED' }], true)).toBe('needs_attention');
    expect(connectorStatus([], true)).toBe('not_connected');
    expect(connectorStatus([], false)).toBe('unavailable');
  });
});

describe('summarizeConnectorUsage', () => {
  it('counts only app actions and names the most used', () => {
    const usage = summarizeConnectorUsage(
      [
        { action: 'APP_ACTION_SEND_MESSAGE', status: 'SUCCESS', durationMs: 100, createdAt: '2026-10-08T10:00:00.000Z' },
        { action: 'APP_ACTION_SEND_MESSAGE', status: 'FAILURE', durationMs: 300, createdAt: '2026-10-08T09:00:00.000Z' },
        { action: 'APP_ACTION_LIST_MESSAGES', status: 'SUCCESS', durationMs: null, createdAt: '2026-10-08T08:00:00.000Z' },
        { action: 'OAUTH_INITIATED', status: 'SUCCESS', durationMs: 5, createdAt: '2026-10-08T07:00:00.000Z' },
      ],
      [{ id: 'send_message', label: 'Send a message' }],
      30,
    );
    expect(usage).toEqual({
      windowDays: 30,
      calls: 3,
      failures: 1,
      avgDurationMs: 200,
      lastUsedAt: '2026-10-08T10:00:00.000Z',
      topAction: 'Send a message',
    });
  });
});

describe('selectAgentTools', () => {
  const tools = [
    { name: 'slack_send_message', provider: 'SLACK' },
    { name: 'slack_list_channels', provider: 'SLACK' },
    { name: 'github_create_issue', provider: 'GITHUB' },
  ];
  const builtin = (n: string) => ['search_docs', 'create_task'].includes(n);

  it('keeps the default built-ins when only connector actions are listed', () => {
    const picked = selectAgentTools(['slack_send_message'], tools, builtin);
    expect(picked.useDefaultBuiltins).toBe(true);
    expect(picked.builtinNames).toEqual([]);
    // Slack narrowed to the listed action; GitHub (linked, nothing listed) keeps all.
    expect(picked.integrationTools.map((t) => t.name)).toEqual(['slack_send_message', 'github_create_issue']);
  });

  it('uses the listed built-ins when there are some', () => {
    const picked = selectAgentTools(['search_docs', 'slack_list_channels'], tools, builtin);
    expect(picked.useDefaultBuiltins).toBe(false);
    expect(picked.builtinNames).toEqual(['search_docs']);
  });

  it('gives a canvas agent only what is drawn', () => {
    const picked = selectAgentTools(['github_create_issue'], tools, builtin, { inline: true });
    expect(picked.useDefaultBuiltins).toBe(false);
    expect(picked.integrationTools.map((t) => t.name)).toEqual(['github_create_issue']);
  });
});

describe('diffPolledItems', () => {
  const trigger = { itemsPath: 'messages', idField: 'id' };
  const data = { messages: [{ id: 'c' }, { id: 'b' }, { id: 'a' }] };

  it('records but does not fire on the first poll', () => {
    expect(diffPolledItems(data, trigger, null)).toEqual({ fresh: [], seen: ['c', 'b', 'a'] });
  });

  it('fires once per unseen item, oldest first', () => {
    const out = diffPolledItems(data, trigger, ['a']);
    expect(out.fresh.map((i) => i['id'])).toEqual(['b', 'c']);
    expect(out.seen).toEqual(['c', 'b', 'a']);
  });

  it('bounds memory and reports a missing list', () => {
    expect(diffPolledItems(data, trigger, ['z', 'y'], 3).seen).toEqual(['c', 'b', 'a']);
    expect(diffPolledItems({ other: 1 }, trigger, []).error).toMatch(/messages/);
  });
});
