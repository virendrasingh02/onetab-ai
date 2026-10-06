import { describe, expect, it, vi } from 'vitest';
import { CanvasAgentRunService, canvasSchedule } from './canvas-agent-run.service.js';
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
    const res = await service.setActive('ws', 'a', true);
    expect(res).toEqual({ active: true, schedule: { cron: '0 9 * * 1', timezone: 'Asia/Kolkata' } });
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
