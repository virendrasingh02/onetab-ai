import { buildConnectorManifest, type ConnectorSummary } from '@org/types';
import { describe, expect, it } from 'vitest';
import { coerceSchemaInput, inputToFieldValues, missingRequired } from '../components/connectors/schema-fields.js';
import { connectorCatalogNodes } from '../components/workflow-canvas/connector-nodes.js';
import { agentConnectorActions, customApiConfig, parseAgentTools, usableConnection } from './connectors.js';

const slack: ConnectorSummary = {
  ...buildConnectorManifest(
    {
      provider: 'SLACK',
      displayName: 'Slack',
      description: '',
      category: 'Communication',
      connectorCategory: 'communication',
      authType: 'OAUTH2',
      supportsSync: false,
      supportsWebhooks: false,
      supportsMessaging: true,
      supportsCustomEndpoints: false,
    },
    [
      { id: 'list_messages', label: 'List messages', description: '', inputSchema: {}, permissionLevel: 'read', requiresConfirmation: false },
      { id: 'send_message', label: 'Send', description: '', inputSchema: {}, permissionLevel: 'write', requiresConfirmation: false },
    ],
    [{ id: 'new_message', label: 'New message', description: '', pollActionId: 'list_messages', itemsPath: 'messages', idField: 'ts', defaultInput: { maxResults: 20 } }],
  ),
  status: 'connected',
  connections: [
    { id: 'ws', provider: 'SLACK', scopeType: 'WORKSPACE', status: 'CONNECTED', displayName: null, accountEmail: null, accountName: null, scopes: [], mine: false, lastSyncAt: null, lastErrorAt: null, lastErrorMessage: null, createdAt: '' },
    { id: 'mine', provider: 'SLACK', scopeType: 'USER', status: 'CONNECTED', displayName: null, accountEmail: null, accountName: null, scopes: [], mine: true, lastSyncAt: null, lastErrorAt: null, lastErrorMessage: null, createdAt: '' },
  ],
  usage: { windowDays: 30, calls: 0, failures: 0, avgDurationMs: null, lastUsedAt: null, topAction: null },
};

describe('agents and connectors', () => {
  const linked = { appLinks: [{ integration: { id: 'mine', provider: 'SLACK', status: 'CONNECTED' } }] };

  it('reads an agent’s saved tool list in either shape', () => {
    expect(parseAgentTools({ tools: '["a","b"]' } as never)).toEqual(['a', 'b']);
    expect(parseAgentTools({ tools: 'nope' } as never)).toEqual([]);
  });

  it('an unlinked app gives nothing; linked with no narrowing gives every action', () => {
    expect(agentConnectorActions({ tools: '[]' } as never, slack)).toEqual([]);
    expect(agentConnectorActions({ ...linked, tools: '[]' } as never, slack)).toEqual(['list_messages', 'send_message']);
    expect(agentConnectorActions({ ...linked, tools: '["slack_send_message"]' } as never, slack)).toEqual(['send_message']);
  });

  it('runs actions on the caller’s own connection first', () => {
    expect(usableConnection(slack)?.id).toBe('mine');
  });

  it('builds a custom API config from the simple form', () => {
    expect(customApiConfig({ baseUrl: ' https://x.test ', apiKeyHeader: 'X-Key', apiKey: 'k' })).toEqual({
      baseUrl: 'https://x.test',
      authType: 'API_KEY_HEADER',
      apiKeyHeader: 'X-Key',
      apiKey: 'k',
    });
    expect(customApiConfig({ baseUrl: 'https://x.test', apiKey: 't' })).toMatchObject({ authType: 'BEARER', bearerToken: 't' });
  });
});

describe('schema fields', () => {
  const schema = {
    type: 'object',
    required: ['to', 'subject'],
    properties: { to: { type: 'array' }, subject: { type: 'string' }, max: { type: 'number' }, urgent: { type: 'boolean' }, meta: { type: 'object' } },
  };

  it('turns text fields into typed input, leaving variables for run time', () => {
    expect(coerceSchemaInput(schema, { to: 'a@x.test, b@x.test', subject: '{{__last}}', max: '5', urgent: 'true', meta: '{"a":1}' })).toEqual({
      to: ['a@x.test', 'b@x.test'],
      subject: '{{__last}}',
      max: 5,
      urgent: true,
      meta: { a: 1 },
    });
    expect(missingRequired(schema, { to: 'a' })).toEqual(['subject']);
    expect(inputToFieldValues({ to: ['a', 'b'], meta: { a: 1 } })).toEqual({ to: 'a, b', meta: '{"a":1}' });
  });
});

describe('canvas connector cards', () => {
  it('offers one card per action, read and event, keyed uniquely', () => {
    const items = connectorCatalogNodes([slack]);
    expect(items.map((i) => i.key)).toEqual(['trigger:SLACK:new_message', 'action:SLACK:list_messages', 'action:SLACK:send_message']);
    expect(items[0]).toMatchObject({ type: 'APP_CONNECTOR_TRIGGER', defaultConfig: { provider: 'SLACK', triggerId: 'new_message', input: { maxResults: 20 } } });
    expect(items[2]).toMatchObject({ type: 'APP_CONNECTOR_ACTION', defaultConfig: { provider: 'SLACK', actionId: 'send_message' } });
  });

  it('leaves out connectors the server can’t connect', () => {
    expect(connectorCatalogNodes([{ ...slack, status: 'unavailable' }])).toEqual([]);
  });
});
