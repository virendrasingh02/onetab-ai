import { describe, expect, it } from 'vitest';
import { agentContents, agentVersionSummary } from './agent-contents.js';

const graph = (nodes: unknown[], edges: unknown[]) =>
  JSON.stringify({ nodes, edges });

const node = (id: string, type: string, label: string, config = {}) => ({
  id,
  type,
  data: { label, config },
});

describe('agentContents', () => {
  it('falls back to the stored tools when there is no canvas', () => {
    const contents = agentContents({
      tools: '["search_docs","kb_search","slack.send_message"]',
    });
    expect(contents.tools.map((t) => t.label)).toEqual([
      'Search docs',
      'Send message',
    ]);
    expect(contents.apps).toEqual(['SLACK']);
  });

  it('survives a malformed tool list', () => {
    expect(agentContents({ tools: 'not json' }).tools).toEqual([]);
  });

  it('reads tools, apps and knowledge from the canvas over stale stored tools', () => {
    const contents = agentContents({
      tools: '["firecrawl_search"]',
      graphJson: graph(
        [
          node('s', 'START', 'Start'),
          node('a', 'AGENT', 'Helper', {
            instructions: 'Help',
            tools: ['create_task'],
          }),
          node('c', 'APP_CONNECTOR_ACTION', 'Gmail', {
            provider: 'GMAIL',
            actionId: 'send_message',
          }),
          node('n1', 'MCP_TOOL', 'Notify in Slack', {
            toolName: '',
            needsConnection: 'SLACK',
          }),
          node('n2', 'MCP_TOOL', 'Notify in Slack', {
            toolName: '',
            needsConnection: 'SLACK',
          }),
          node('e', 'END', 'End'),
        ],
        [
          { id: '1', source: 's', target: 'a' },
          { id: '2', source: 'a', target: 'c' },
          { id: '3', source: 'c', target: 'n1' },
          { id: '4', source: 'n1', target: 'n2' },
          { id: '5', source: 'n2', target: 'e' },
        ],
      ),
    });
    const labels = contents.tools.map((t) => t.label);
    expect(labels).toContain('Create a task');
    expect(labels).toContain('Send message');
    expect(labels.filter((l) => l === 'Notify in Slack')).toHaveLength(1);
    expect(labels).not.toContain('Search the web');
    expect(contents.apps).toEqual(expect.arrayContaining(['GMAIL', 'SLACK']));
    expect(contents.agents).toEqual(['Helper']);
  });
});

describe('agentVersionSummary', () => {
  it('is null when no version was saved', () => {
    expect(agentVersionSummary({})).toBeNull();
    expect(agentVersionSummary(null)).toBeNull();
  });

  it('shows the published version and flags a newer snapshot', () => {
    expect(
      agentVersionSummary({
        versions: [
          { version: 7, versionTag: 'v1.4.2-snapshot', status: 'SNAPSHOT' },
          {
            version: 5,
            versionTag: 'v1.4.0',
            status: 'PUBLISHED',
            publishedAt: '2026-11-01T00:00:00.000Z',
          },
          { version: 1, versionTag: 'v1.0.0', status: 'PUBLISHED' },
        ],
      }),
    ).toEqual({
      label: 'v1.4.0',
      published: true,
      publishedAt: '2026-11-01T00:00:00.000Z',
      newerSnapshot: 'v1.4.2',
      total: 3,
    });
  });

  it('falls back to the newest snapshot when nothing is published', () => {
    expect(
      agentVersionSummary({
        versions: [
          { version: 2, versionTag: 'v1.0.1-snapshot', status: 'SNAPSHOT' },
          { version: 1, versionTag: 'v1.0.0-snapshot', status: 'SNAPSHOT' },
        ],
      }),
    ).toEqual({ label: 'v1.0.1', published: false, total: 2 });
  });
});
