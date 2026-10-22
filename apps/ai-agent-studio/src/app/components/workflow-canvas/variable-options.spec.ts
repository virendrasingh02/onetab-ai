import { describe, expect, it } from 'vitest';
import type { ConnectorSummary } from '@org/types';
import type { Edge, Node } from '@xyflow/react';
import { upstreamNodes, variableOptions } from './variable-options.js';

const node = (id: string, type: string, config: Record<string, unknown> = {}): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { title: id, config },
});
const edge = (source: string, target: string): Edge => ({ id: `${source}-${target}`, source, target });

const gmail = {
  provider: 'GMAIL',
  capabilities: [
    {
      id: 'search_messages',
      outputSchema: {
        type: 'object',
        properties: {
          messages: {
            type: 'array',
            description: 'Matching emails',
            items: {
              type: 'object',
              properties: {
                subject: { type: 'string' },
                from: { type: 'object', properties: { email: { type: 'string' } } },
              },
            },
          },
        },
      },
    },
    { id: 'send_message' },
  ],
} as unknown as ConnectorSummary;

describe('upstreamNodes', () => {
  it('follows edges back transitively and ignores downstream nodes', () => {
    const nodes = [node('a', 'START'), node('b', 'AGENT'), node('c', 'AGENT'), node('d', 'END')];
    const edges = [edge('a', 'b'), edge('b', 'c'), edge('c', 'd')];
    expect(upstreamNodes('c', nodes, edges).map((n) => n.id).sort()).toEqual(['a', 'b']);
  });

  it('terminates on a cycle', () => {
    const nodes = [node('a', 'AGENT'), node('b', 'AGENT')];
    expect(upstreamNodes('a', nodes, [edge('a', 'b'), edge('b', 'a')]).map((n) => n.id)).toEqual(['b']);
  });
});

describe('variableOptions', () => {
  const nodes = [
    node('mail', 'APP_CONNECTOR_ACTION', { provider: 'GMAIL', actionId: 'search_messages' }),
    node('send', 'APP_CONNECTOR_ACTION', { provider: 'GMAIL', actionId: 'send_message' }),
    node('agent', 'AGENT'),
  ];
  const edges = [edge('mail', 'send'), edge('send', 'agent')];

  it('lists the typed fields a connector step declares, under that step', () => {
    const tokens = variableOptions(nodes[2], nodes, edges, [gmail]).map((o) => o.token);
    expect(tokens).toContain('{{mail}}');
    expect(tokens).toContain('{{mail.messages}}');
    expect(tokens).toContain('{{mail.messages.0.subject}}');
    expect(tokens).toContain('{{mail.messages.0.from.email}}');
  });

  it('lists only the step for an action with no declared output', () => {
    const tokens = variableOptions(nodes[2], nodes, edges, [gmail]).map((o) => o.token);
    expect(tokens).toContain('{{send}}');
    expect(tokens.filter((t) => t.startsWith('{{send.'))).toEqual([]);
  });

  it('always ends with the run variables, and works with nothing selected', () => {
    const tokens = variableOptions(null, nodes, edges).map((o) => o.token);
    expect(tokens).toContain('{{now.date}}');
    expect(tokens).not.toContain('{{mail}}');
  });
});
