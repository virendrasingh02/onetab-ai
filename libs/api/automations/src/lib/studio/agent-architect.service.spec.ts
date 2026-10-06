import { describe, expect, it, vi } from 'vitest';
import { AgentArchitectService } from './agent-architect.service.js';

const graph = {
  nodes: [
    { id: 'trigger', type: 'TRIGGER_MANUAL', position: { x: 0, y: 0 }, data: { label: 'When you run it', config: {} } },
    { id: 'read', type: 'MCP_TOOL', position: { x: 300, y: 0 }, data: { label: 'Read tasks', config: { toolName: 'find_tasks', input: '{}' } } },
    { id: 'write', type: 'AGENT', position: { x: 600, y: 0 }, data: { label: 'Write report', config: { goal: 'Write it.' } } },
    { id: 'post', type: 'MCP_TOOL', position: { x: 900, y: 0 }, data: { label: 'Post report', config: { toolName: 'send_channel_message', input: '{}' } } },
    { id: 'result', type: 'END', position: { x: 1200, y: 0 }, data: { label: 'Result', config: {} } },
  ],
  edges: [
    { id: 'e1', source: 'trigger', target: 'read' },
    { id: 'e2', source: 'read', target: 'write' },
    { id: 'e3', source: 'write', target: 'post' },
    { id: 'e4', source: 'post', target: 'result' },
  ],
};

function make(runs: { list?: unknown[]; run?: unknown } = {}) {
  const prisma = {
    knowledgeBase: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findUnique: vi.fn().mockResolvedValue({ timezone: 'Europe/London' }) },
  };
  const planner = { catalog: vi.fn().mockResolvedValue({ tools: [], apps: [], events: [] }), plan: vi.fn() };
  const canvas = { listRuns: vi.fn().mockResolvedValue(runs.list ?? []), getRun: vi.fn().mockResolvedValue(runs.run) };
  const ai = { chat: vi.fn() };
  const credentials = { resolveCredential: vi.fn().mockResolvedValue({ apiKey: undefined }) };
  const service = new AgentArchitectService(prisma as never, planner as never, canvas as never, ai as never, { resolve: vi.fn() } as never, credentials as never);
  return { service, ai, canvas };
}

describe('AgentArchitectService', () => {
  it('edits by rules without calling a model, and reports the computed diff', async () => {
    const { service, ai } = make();
    const res = await service.edit('ws', 'u', { command: 'Add approval before sending', graphJson: JSON.stringify(graph) });
    expect(ai.chat).not.toHaveBeenCalled();
    expect(res.by).toBe('rules');
    expect(res.changes).toEqual(['Added “Approve: Post report”']);
    expect(res.flow).toBe('When you run it → Read tasks → Write report → Approve: Post report → Post report → Result');
  });

  it('reads a schedule in the owner’s time zone', async () => {
    const { service } = make();
    const res = await service.edit('ws', 'u', { command: 'Run it every Monday at 9am', graphJson: JSON.stringify(graph) });
    expect(res.graph.nodes[0]).toMatchObject({ type: 'TRIGGER_SCHEDULE', data: { config: { cron: '0 9 * * 1', timezone: 'Europe/London' } } });
  });

  it('explains a failed run from its real steps, and proposes retries only for temporary failures', async () => {
    const { service } = make({
      list: [{ id: 'run1', status: 'FAILED' }],
      run: {
        id: 'run1',
        status: 'FAILED',
        errorsJson: null,
        steps: [
          { stepId: 'read', status: 'FAILED', errorMessage: 'connect ETIMEDOUT', outputJson: {} },
          { stepId: 'post', status: 'FAILED', errorMessage: 'Slack isn’t connected. Connect Slack in Integrations.', outputJson: {} },
        ],
      },
    });
    const res = await service.diagnose('ws', 'agent', JSON.stringify(graph));
    expect(res.findings.map((f) => [f.step, f.code, f.retryable])).toEqual([
      ['Read tasks', 'TIMEOUT', true],
      ['Post report', 'MISSING_CONNECTION', false],
    ]);
    expect(res.ops).toEqual([{ op: 'set_retries', retries: 3, nodeIds: ['read'] }]);
    expect(res.retrySafe).toBe(false);
    expect(res.summary).toMatch(/^Read tasks failed: connect ETIMEDOUT/);
  });

  it('says so when there is nothing to diagnose', async () => {
    const { service } = make({ list: [] });
    const res = await service.diagnose('ws', 'agent', JSON.stringify(graph));
    expect(res.summary).toMatch(/hasn’t run yet/);
    expect(res.findings).toEqual([]);
  });

  it('refuses to edit something that is not a canvas graph', async () => {
    const { service } = make();
    await expect(service.edit('ws', 'u', { command: 'Add Slack', graphJson: '{"nodes":[]}' })).rejects.toThrow();
  });
});
