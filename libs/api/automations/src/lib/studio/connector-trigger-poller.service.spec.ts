import { describe, expect, it, vi } from 'vitest';
import { compileStudioGraph } from '@org/types';
import {
  ConnectorTriggerPollerService,
  fireBudget,
  isPollDue,
  MAX_RUNS_PER_HOUR,
  MAX_RUNS_PER_POLL,
} from './connector-trigger-poller.service.js';

const NOW = new Date('2026-10-08T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

describe('isPollDue', () => {
  it('checks every two minutes and backs off after failures', () => {
    expect(isPollDue(null, NOW)).toBe(true);
    expect(isPollDue({ lastPolledAt: minutesAgo(1), failures: 0 }, NOW)).toBe(false);
    expect(isPollDue({ lastPolledAt: minutesAgo(2), failures: 0 }, NOW)).toBe(true);
    expect(isPollDue({ lastPolledAt: minutesAgo(5), failures: 2 }, NOW)).toBe(false); // 8 min
    expect(isPollDue({ lastPolledAt: minutesAgo(30), failures: 9 }, NOW)).toBe(true); // capped at 30
  });
});

describe('fireBudget', () => {
  it('caps runs per check and per hour, resetting each hour', () => {
    expect(fireBudget(null, NOW).allowed).toBe(MAX_RUNS_PER_POLL);
    expect(fireBudget({ windowStartAt: minutesAgo(10), firedInWindow: MAX_RUNS_PER_HOUR - 3 }, NOW).allowed).toBe(3);
    expect(fireBudget({ windowStartAt: minutesAgo(10), firedInWindow: MAX_RUNS_PER_HOUR }, NOW).allowed).toBe(0);
    const reset = fireBudget({ windowStartAt: minutesAgo(61), firedInWindow: MAX_RUNS_PER_HOUR }, NOW);
    expect(reset).toEqual({ allowed: MAX_RUNS_PER_POLL, windowStartAt: NOW, firedInWindow: 0 });
  });
});

const compiled = compileStudioGraph({
  nodes: [
    { id: 't', type: 'APP_CONNECTOR_TRIGGER', position: { x: 0, y: 0 }, data: { config: { provider: 'GITHUB', triggerId: 'new_issue', input: { repo: 'acme/app' } } } },
    { id: 'a', type: 'AGENT', position: { x: 0, y: 0 }, data: { config: { instructions: 'Triage {{event.title}}' } } },
  ],
  edges: [{ id: 'e', source: 't', target: 'a' }],
});

function setup(opts: { state?: Record<string, unknown> | null; integration?: Record<string, unknown> | null; items?: unknown[] } = {}) {
  const entry = {
    workflowId: 'wf1',
    workspaceId: 'ws',
    agent: { id: 'a1', name: 'Triage', creatorId: 'owner' },
    trigger: { provider: 'GITHUB', triggerId: 'new_issue', input: { repo: 'acme/app' } },
    compiled,
  };
  const prisma = {
    connectorTriggerState: {
      findUnique: vi.fn().mockResolvedValue(opts.state ?? null),
      upsert: vi.fn().mockResolvedValue({}),
    },
    externalIntegration: {
      findFirst: vi.fn().mockResolvedValue(opts.integration === undefined ? { id: 'int1', status: 'CONNECTED' } : opts.integration),
    },
  };
  const engine = { startWorkflow: vi.fn().mockResolvedValue({ runId: 'r' }) };
  const canvasAgents = { activeAppTriggers: vi.fn().mockResolvedValue([entry]), sync: vi.fn().mockResolvedValue('wf1') };
  const connectors = {
    trigger: vi.fn().mockReturnValue({ id: 'new_issue', label: 'New issue', description: '', pollActionId: 'list_issues', itemsPath: 'issues', idField: 'id' }),
    manifest: vi.fn().mockReturnValue({ name: 'GitHub' }),
  };
  const integrations = {
    pollAction: vi.fn().mockResolvedValue({ success: true, data: { issues: opts.items ?? [{ id: 3 }, { id: 2 }, { id: 1 }] } }),
  };
  const poller = new ConnectorTriggerPollerService(prisma as never, engine as never, canvasAgents as never, connectors as never, integrations as never);
  return { poller, prisma, engine, integrations, canvasAgents };
}

const configKey = 'GITHUB:new_issue:{"repo":"acme/app"}';

describe('ConnectorTriggerPollerService', () => {
  it('only records what is there on the first check', async () => {
    const { poller, engine, prisma, integrations } = setup();
    expect(await poller.pollDue(NOW)).toBe(0);
    expect(engine.startWorkflow).not.toHaveBeenCalled();
    expect(integrations.pollAction).toHaveBeenCalledWith('int1', 'list_issues', { repo: 'acme/app' }, 'owner', 'ws');
    expect(prisma.connectorTriggerState.upsert.mock.calls[0][0].create).toMatchObject({ configKey, seenIds: ['3', '2', '1'], failures: 0 });
  });

  it('starts one run per new item, oldest first, with the item as the event', async () => {
    const { poller, engine, canvasAgents } = setup({
      state: { configKey, seenIds: ['1'], lastPolledAt: minutesAgo(3), failures: 0, windowStartAt: null, firedInWindow: 0 },
    });
    expect(await poller.pollDue(NOW)).toBe(2);
    expect(canvasAgents.sync).toHaveBeenCalledTimes(1);
    expect(engine.startWorkflow.mock.calls.map((c) => (c[1] as { event: { id: number } }).event.id)).toEqual([2, 3]);
    expect(engine.startWorkflow.mock.calls[0][2]).toMatchObject({ startedBy: 'event' });
  });

  it('starts over without replaying history when the trigger changes', async () => {
    const { poller, engine } = setup({
      state: { configKey: 'GITHUB:new_issue:{"repo":"other/repo"}', seenIds: ['9'], lastPolledAt: minutesAgo(3), failures: 0, windowStartAt: null, firedInWindow: 0 },
    });
    expect(await poller.pollDue(NOW)).toBe(0);
    expect(engine.startWorkflow).not.toHaveBeenCalled();
  });

  it('records a missing connection on the trigger instead of failing silently', async () => {
    const { poller, prisma, integrations } = setup({ integration: null });
    await poller.pollDue(NOW);
    expect(integrations.pollAction).not.toHaveBeenCalled();
    expect(prisma.connectorTriggerState.upsert.mock.calls[0][0].create).toMatchObject({
      lastError: expect.stringMatching(/GitHub isn’t connected/),
      failures: 1,
    });
  });

  it('waits between checks', async () => {
    const { poller, integrations } = setup({
      state: { configKey, seenIds: ['1'], lastPolledAt: minutesAgo(1), failures: 0, windowStartAt: null, firedInWindow: 0 },
    });
    await poller.pollDue(NOW);
    expect(integrations.pollAction).not.toHaveBeenCalled();
  });

  it('skips past the hourly cap and says so', async () => {
    const { poller, engine, prisma } = setup({
      state: { configKey, seenIds: ['1'], lastPolledAt: minutesAgo(3), failures: 0, windowStartAt: minutesAgo(5), firedInWindow: MAX_RUNS_PER_HOUR - 1 },
    });
    expect(await poller.pollDue(NOW)).toBe(1);
    expect(engine.startWorkflow).toHaveBeenCalledTimes(1);
    expect(prisma.connectorTriggerState.upsert.mock.calls[0][0].update).toMatchObject({
      lastError: expect.stringMatching(/Skipped 1 event/),
      firedInWindow: MAX_RUNS_PER_HOUR,
      seenIds: ['3', '2', '1'],
    });
  });
});
