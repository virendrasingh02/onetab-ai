import { describe, expect, it } from 'vitest';
import { buildConnectableApps, buildRosterConnectors, workflowCoworkerIds, type RosterConnectorInput } from './coworker-roster.js';
import { COWORKER_TEMPLATES } from './coworker-templates.js';

const app = (provider: string, over: Partial<RosterConnectorInput> = {}): RosterConnectorInput => ({
  provider,
  name: provider[0] + provider.slice(1).toLowerCase(),
  category: 'finance',
  serverConfigured: true,
  readActions: 3,
  writeActions: 1,
  triggers: 1,
  connections: [],
  ...over,
});

describe('buildConnectableApps', () => {
  it('lists only apps with a working connection, workspace-wide first, by name', () => {
    const registry = new Map([
      ['XERO', app('XERO', { connections: [{ id: 'x-user', status: 'CONNECTED', scopeType: 'USER', displayName: 'mine' }, { id: 'x-ws', status: 'CONNECTED', scopeType: 'WORKSPACE', displayName: 'Demo Co' }] })],
      ['GITLAB', app('GITLAB', { connections: [{ id: 'g', status: 'EXPIRED', scopeType: 'WORKSPACE', displayName: 'gl' }] })],
      ['SENDGRID', app('SENDGRID')],
      ['ASANA', app('ASANA', { connections: [{ id: 'a-1', status: 'CONNECTED', scopeType: 'USER', displayName: 'me' }] })],
    ]);
    const out = buildConnectableApps({ registry, sharing: new Map([['x-ws', [{ id: 'cw-1', name: 'Ledger' }]]]) });
    expect(out.map((c) => c.provider)).toEqual(['ASANA', 'XERO']);
    expect(out[1]).toMatchObject({ state: 'ready_to_attach', integrationId: 'x-ws', connectionScope: 'WORKSPACE', sharedWith: [{ id: 'cw-1', name: 'Ledger' }] });
  });
});

describe('buildRosterConnectors', () => {
  it('derives every state from real links, connections and server setup', () => {
    const registry = new Map([
      ['QUICKBOOKS', app('QUICKBOOKS', { serverConfigured: false, unavailableReason: 'No Intuit app' })],
      ['XERO', app('XERO', { connections: [{ id: 'x-user', status: 'CONNECTED', scopeType: 'USER', displayName: 'mine' }, { id: 'x-ws', status: 'CONNECTED', scopeType: 'WORKSPACE', displayName: 'Demo Co' }] })],
      ['STRIPE', app('STRIPE', { connections: [{ id: 's-1', status: 'CONNECTED', scopeType: 'WORKSPACE', displayName: 'Stripe test' }] })],
      ['SENDGRID', app('SENDGRID')],
      ['GITLAB', app('GITLAB', { connections: [{ id: 'g', status: 'EXPIRED', scopeType: 'WORKSPACE', displayName: 'gl' }] })],
    ]);
    const out = buildRosterConnectors({
      templateProviders: ['QUICKBOOKS', 'XERO', 'STRIPE', 'SENDGRID', 'GITLAB', 'RAZORPAYX_PAYROLL'],
      attached: [
        { integrationId: 's-1', provider: 'STRIPE', status: 'CONNECTED', displayName: 'Stripe test', scopeType: 'WORKSPACE' },
        { integrationId: 'n-1', provider: 'NOTION', status: 'CONNECTED', displayName: 'Docs', scopeType: 'WORKSPACE' },
      ],
      registry,
      sharing: new Map([['s-1', [{ id: 'cw-2', name: 'Relay' }]]]),
    });
    const by = Object.fromEntries(out.map((c) => [c.provider, c]));
    expect(by['QUICKBOOKS']).toMatchObject({ state: 'not_set_up', reason: 'No Intuit app' });
    // The workspace-wide connection wins over a personal one.
    expect(by['XERO']).toMatchObject({ state: 'ready_to_attach', integrationId: 'x-ws' });
    expect(by['STRIPE']).toMatchObject({ state: 'attached', integrationId: 's-1', sharedWith: [{ id: 'cw-2', name: 'Relay' }] });
    expect(by['SENDGRID'].state).toBe('needs_connection');
    expect(by['GITLAB'].state).toBe('needs_reconnect');
    expect(by['RAZORPAYX_PAYROLL']).toMatchObject({ state: 'unavailable', name: 'RazorpayX Payroll' });
    // Something attached outside the template still shows, marked as such.
    expect(by['NOTION']).toMatchObject({ state: 'attached', fromTemplate: false });
    expect(out.map((c) => c.provider)).toEqual(['QUICKBOOKS', 'XERO', 'STRIPE', 'SENDGRID', 'GITLAB', 'RAZORPAYX_PAYROLL', 'NOTION']);
  });

  it('an attached connection that broke asks for a reconnect', () => {
    const [c] = buildRosterConnectors({
      templateProviders: ['STRIPE'],
      attached: [{ integrationId: 's', provider: 'STRIPE', status: 'ERROR', displayName: null, scopeType: 'WORKSPACE' }],
      registry: new Map([['STRIPE', app('STRIPE')]]),
      sharing: new Map(),
    });
    expect(c.state).toBe('needs_reconnect');
  });
});

describe('workflowCoworkerIds', () => {
  it('reads coworker ids the way the engine resolves node config', () => {
    const nodes = [
      { id: '1', type: 'AI_COWORKER', config: { coworkerId: 'a' } },
      { id: '2', type: 'aiActionNode', data: { type: 'AI_COWORKER', config: { entityId: 'b' } } },
      { id: '3', type: 'ai_coworker', data: { coworkerId: 'c' } },
      { id: '4', type: 'AGENT', config: { agentId: 'x' } },
      { id: '5', type: 'AI_COWORKER', config: { coworkerId: 'a' } },
    ];
    expect(workflowCoworkerIds(JSON.stringify(nodes))).toEqual(['a', 'b', 'c']);
    expect(workflowCoworkerIds('not json')).toEqual([]);
  });

  it('reads a Studio canvas graph', () => {
    const graph = {
      nodes: [
        { id: 'c1', type: 'AI_COWORKER', data: { label: 'Ledger', config: { coworkerId: 'ledger' } } },
        { id: 'a1', type: 'AGENT', data: { config: {} } },
      ],
      edges: [],
    };
    expect(workflowCoworkerIds(JSON.stringify(graph))).toEqual(['ledger']);
  });
});

describe('business coworker templates', () => {
  it('cover the five business areas without overlapping a default', () => {
    const keys = COWORKER_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    const names = COWORKER_TEMPLATES.filter((t) => t.seedByDefault).map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['Ledger', 'Tracker', 'Shipper', 'Ada', 'Relay']));
    const ledger = COWORKER_TEMPLATES.find((t) => t.key === 'ledger');
    expect(ledger?.connectors).toEqual(['QUICKBOOKS', 'XERO', 'STRIPE']);
    // Every collaborator a template names exists.
    for (const t of COWORKER_TEMPLATES) for (const c of t.collaborators) expect(keys).toContain(c);
  });
});
