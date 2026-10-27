import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CanvasAgentRunService, canvasEvent, canvasSchedule } from './canvas-agent-run.service.js';
import { compileStudioGraph } from '@org/types';

const graph = (cron?: string) =>
  JSON.stringify({
    nodes: [
      { id: 't', type: cron ? 'TRIGGER_SCHEDULE' : 'TRIGGER_MANUAL', data: { label: 'When', config: cron ? { cron, timezone: 'Asia/Kolkata' } : {} } },
      { id: 'read', type: 'MCP_TOOL', data: { label: 'Read', config: { toolName: 'find_tasks', input: '{}' } } },
    ],
    edges: [{ id: 'e', source: 't', target: 'read' }],
  });

function make(agent: Record<string, unknown>, workflows: Array<{ id: string; description: string }> = []) {
  const prisma = {
    aIAgent: { findFirst: vi.fn().mockResolvedValue(agent), findUniqueOrThrow: vi.fn().mockResolvedValue({ workspaceId: 'ws' }) },
    automationWorkflow: {
      findFirst: vi.fn().mockResolvedValue(workflows[0] ? { id: workflows[0].id, isActive: true } : null),
      findMany: vi.fn().mockResolvedValue(workflows),
      create: vi.fn().mockResolvedValue({ id: 'wf_new' }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return { service: new CanvasAgentRunService(prisma as never, {} as never), prisma };
}

describe('scheduled canvas agents', () => {
  it('reads the schedule a canvas trigger carries', () => {
    expect(canvasSchedule(compileStudioGraph(JSON.parse(graph('0 9 * * 1'))))).toEqual({ cron: '0 9 * * 1', timezone: 'Asia/Kolkata' });
    expect(canvasSchedule(compileStudioGraph(JSON.parse(graph())))).toBeNull();
  });

  it('switching on needs a schedule', async () => {
    const { service } = make({ id: 'a', name: 'A', creatorId: 'u', graphJson: graph() });
    await expect(service.setActive('ws', 'a', true)).rejects.toMatchObject({ response: expect.objectContaining({ code: 'NO_SCHEDULE' }) });
  });

  it('switching on syncs the engine workflow and turns it on; a new workflow starts switched off', async () => {
    const { service, prisma } = make({ id: 'a', name: 'A', creatorId: 'u', graphJson: graph('0 9 * * 1') });
    // The sync finds no workflow yet; the activation read afterwards sees it on.
    prisma.automationWorkflow.findFirst.mockResolvedValueOnce(null).mockResolvedValue({ id: 'wf_new', isActive: true, nodesJson: '[]' });
    const res = await service.setActive('ws', 'a', true);
    expect(res).toEqual({ active: true, schedule: { cron: '0 9 * * 1', timezone: 'Asia/Kolkata' }, appTrigger: null, event: null, webhook: null });
    expect(prisma.automationWorkflow.create.mock.calls[0]![0].data).toMatchObject({ triggerType: 'CANVAS_AGENT', description: 'canvas-agent:a', isActive: false });
    expect(prisma.automationWorkflow.update).toHaveBeenCalledWith({ where: { id: 'wf_new' }, data: { isActive: true } });
  });

  it('fires from the agent’s current graph, only when due', async () => {
    const { service } = make({ id: 'a', name: 'A', creatorId: 'u', workspaceId: 'ws', graphJson: graph('0 9 * * 1') }, [{ id: 'wf1', description: 'canvas-agent:a' }]);
    const isDue = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    const due = await service.dueScheduledRuns(new Date(), isDue);
    expect(isDue).toHaveBeenCalledWith('0 9 * * 1', expect.any(Date), 'Asia/Kolkata');
    expect(due).toEqual([expect.objectContaining({ workflowId: 'wf1', agentId: 'a' })]);
    expect(await service.dueScheduledRuns(new Date(), isDue)).toEqual([]);
  });
});

const triggerGraph = (type: string, config: Record<string, unknown> = {}) =>
  JSON.stringify({
    nodes: [
      { id: 't', type, data: { label: 'When', config } },
      { id: 'read', type: 'MCP_TOOL', data: { label: 'Read', config: { toolName: 'find_tasks', input: '{}' } } },
    ],
    edges: [{ id: 'e', source: 't', target: 'read' }],
  });

describe('workspace-event canvas agents', () => {
  it('reads the event a trigger card starts on, and refuses an unknown one', () => {
    expect(canvasEvent(compileStudioGraph(JSON.parse(triggerGraph('TRIGGER_APP_EVENT', { eventType: 'task.created' }))))).toEqual({
      name: 'task.created',
      label: 'A task is created',
    });
    const bad = compileStudioGraph(JSON.parse(triggerGraph('TRIGGER_APP_EVENT', { eventType: 'record.created' })));
    expect(canvasEvent(bad)).toBeNull();
    expect(bad.issues).toEqual([expect.objectContaining({ level: 'error', nodeId: 't' })]);
  });

  it('can be switched on, and is found (and synced) only for its own event', async () => {
    const { service, prisma } = make(
      { id: 'a', name: 'A', creatorId: 'u', workspaceId: 'ws', graphJson: triggerGraph('TRIGGER_APP_EVENT', { eventType: 'task.created' }) },
      [{ id: 'wf1', description: 'canvas-agent:a' }],
    );
    await expect(service.setActive('ws', 'a', true)).resolves.toMatchObject({ event: { name: 'task.created' } });
    expect(await service.activeEventTriggers('ws', 'meeting.ended')).toEqual([]);
    const found = await service.activeEventTriggers('ws', 'task.created');
    expect(found).toEqual([expect.objectContaining({ id: 'wf1', name: 'A', creatorId: 'u' })]);
    // An agent's own run never re-triggers it.
    expect(prisma.automationWorkflow.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.not.objectContaining({ id: expect.anything() }) }));
    await service.activeEventTriggers('ws', 'task.created', 'wf1');
    expect(prisma.automationWorkflow.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { not: 'wf1' } }) }));
  });
});

describe('webhook canvas agents', () => {
  function makeWebhook(synced: { isActive: boolean; secret?: string } | null) {
    const nodesJson = JSON.stringify([{ id: 't', type: 'TRIGGER', config: { trigger: 'TRIGGER_WEBHOOK', ...(synced?.secret ? { webhookSecret: synced.secret } : {}) } }]);
    const prisma = {
      aIAgent: {
        findFirst: vi.fn().mockResolvedValue({ id: 'a', name: 'A', creatorId: 'u', graphJson: triggerGraph('TRIGGER_WEBHOOK') }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ workspaceId: 'ws' }),
      },
      automationWorkflow: {
        findFirst: vi.fn().mockResolvedValue(synced ? { id: 'wf1', isActive: synced.isActive, nodesJson } : null),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ isActive: synced?.isActive ?? false }),
        create: vi.fn().mockResolvedValue({ id: 'wf1' }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const engine = { startWorkflow: vi.fn().mockResolvedValue({ runId: 'run1', status: 'RUNNING' }) };
    return { service: new CanvasAgentRunService(prisma as never, engine as never), prisma, engine };
  }
  const syncedNodes = (prisma: ReturnType<typeof makeWebhook>['prisma']) => {
    const call = prisma.automationWorkflow.update.mock.calls.find((c) => c[0].data.nodesJson) ?? prisma.automationWorkflow.create.mock.calls[0];
    return JSON.parse(call![0].data.nodesJson) as Array<{ type: string; config: Record<string, unknown> }>;
  };

  it('switching on issues a secret on the engine workflow, and a re-sync keeps it', async () => {
    const first = makeWebhook(null);
    await first.service.setActive('ws', 'a', true);
    const secret = syncedNodes(first.prisma).find((n) => n.type === 'TRIGGER')?.config['webhookSecret'];
    expect(typeof secret).toBe('string');
    expect((secret as string).length).toBeGreaterThan(20);

    const again = makeWebhook({ isActive: true, secret: 'kept-secret' });
    await again.service.setActive('ws', 'a', true);
    expect(syncedNodes(again.prisma).find((n) => n.type === 'TRIGGER')?.config['webhookSecret']).toBe('kept-secret');
  });

  it('shows the secret only to someone who can manage the agent', async () => {
    const { service } = makeWebhook({ isActive: true, secret: 's3cret' });
    expect((await service.activation('ws', 'a')).webhook).toEqual({ path: '/workspaces/ws/agent-graphs/a/webhook' });
    expect((await service.activation('ws', 'a', { canManage: true })).webhook).toEqual({ path: '/workspaces/ws/agent-graphs/a/webhook', secret: 's3cret' });
  });

  it('starts a live run only with the right secret while switched on', async () => {
    const on = makeWebhook({ isActive: true, secret: 's3cret' });
    await expect(on.service.webhook('ws', 'a', { id: 1 }, 'wrong')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(on.service.webhook('ws', 'a', { id: 1 }, undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(on.service.webhook('ws', 'a', { id: 1 }, 's3cret')).resolves.toEqual({ runId: 'run1', status: 'RUNNING' });
    expect(on.engine.startWorkflow).toHaveBeenCalledWith('wf1', expect.objectContaining({ trigger: 'WEBHOOK', event: { id: 1 } }), expect.objectContaining({ startedBy: 'webhook' }));

    const off = makeWebhook({ isActive: false, secret: 's3cret' });
    await expect(off.service.webhook('ws', 'a', {}, 's3cret')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(off.engine.startWorkflow).not.toHaveBeenCalled();
  });
});
