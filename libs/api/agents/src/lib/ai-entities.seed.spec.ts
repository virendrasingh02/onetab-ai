import { describe, expect, it, vi } from 'vitest';
import { AIEntitiesService } from './ai-entities.service.js';

/** An avatar someone picked — seeding must never replace it. */
const CHOSEN = 'icon:brain:rose';

const ASSISTANT_ROW = { id: 'a', name: 'Assistant', avatarUrl: CHOSEN, permissions: { allowActions: [] }, configuration: { coworkerType: 'assistant' } };

/** The four business defaults added in the coworker roster pass, already seeded. */
const UPGRADED = ['ledger', 'shipper', 'ada', 'relay'].map((k) => ({ id: k, name: k, avatarUrl: CHOSEN, permissions: { allowActions: [] }, configuration: { coworkerType: k } }));

function setup(rows: Array<{ id: string; name: string; avatarUrl?: string | null; permissions: unknown; configuration: unknown }>) {
  const aIAgent = {
    findMany: vi.fn().mockResolvedValue(rows),
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
  };
  const tx = { aIAgent, $executeRaw: vi.fn().mockResolvedValue(1) };
  const prisma: any = {
    aIAgent,
    $transaction: vi.fn().mockImplementation((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { service: new AIEntitiesService(prisma), prisma, aIAgent, tx };
}

describe('AIEntitiesService.initializeDefaultCoworkers', () => {
  it('seeds every default coworker with its write grants, under the workspace lock', async () => {
    const { service, aIAgent, tx } = setup([]);
    await service.initializeDefaultCoworkers('ws-1');
    expect(tx.$executeRaw).toHaveBeenCalled();
    const created = aIAgent.create.mock.calls.map(([arg]: [any]) => arg.data);
    expect(created.map((d: any) => d.name)).toEqual(['Assistant', 'Scheduler', 'Tracker', 'Ledger', 'Shipper', 'Ada', 'Relay']);
    expect(created[0].configuration).toEqual(expect.objectContaining({ coworkerType: 'assistant' }));
    expect(created[1].permissions.allowActions).toContain('create_reminder');
    expect(created[2].permissions.allowActions).toContain('create_monitor');
    expect(created[2].configuration).toEqual(expect.objectContaining({ coworkerType: 'tracker', monitors: [] }));
  });

  it('does nothing — and opens no transaction — when the workspace is up to date', async () => {
    const { service, prisma } = setup([
      ASSISTANT_ROW,
      { id: 's', name: 'Scheduler', avatarUrl: CHOSEN, permissions: { allowActions: [] }, configuration: { coworkerType: 'scheduler' } },
      { id: 't', name: 'Tracker', avatarUrl: CHOSEN, permissions: { allowActions: ['notify_user'] }, configuration: { coworkerType: 'tracker' } },
      ...UPGRADED,
    ]);
    await service.initializeDefaultCoworkers('ws-1');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('grants an old default its writes, keeping its other permissions', async () => {
    const { service, aIAgent } = setup([
      ASSISTANT_ROW,
      { id: 's', name: 'Scheduler', avatarUrl: CHOSEN, permissions: { knowledgeAccess: true }, configuration: { coworkerType: 'scheduler' } },
      { id: 't', name: 'Tracker', avatarUrl: CHOSEN, permissions: { allowActions: [] }, configuration: { coworkerType: 'tracker' } },
      ...UPGRADED,
    ]);
    await service.initializeDefaultCoworkers('ws-1');
    expect(aIAgent.update).toHaveBeenCalledTimes(1);
    expect(aIAgent.update.mock.calls[0][0]).toEqual({
      where: { id: 's' },
      data: { permissions: expect.objectContaining({ knowledgeAccess: true, allowActions: expect.arrayContaining(['create_reminder']) }) },
    });
    expect(aIAgent.create).not.toHaveBeenCalled();
  });

  it('does not re-create a default someone renamed', async () => {
    const { service, aIAgent } = setup([
      ASSISTANT_ROW,
      { id: 's', name: 'Launch Planner', avatarUrl: CHOSEN, permissions: { allowActions: [] }, configuration: { coworkerType: 'scheduler' } },
    ]);
    await service.initializeDefaultCoworkers('ws-1');
    expect(aIAgent.create.mock.calls.map(([arg]: [any]) => arg.data.name)).toEqual(['Tracker', 'Ledger', 'Shipper', 'Ada', 'Relay']);
  });

  it('adopts an existing Finance coworker as Ledger instead of creating a duplicate', async () => {
    const { service, aIAgent } = setup([
      ASSISTANT_ROW,
      { id: 's', name: 'Scheduler', avatarUrl: CHOSEN, permissions: { allowActions: [] }, configuration: { coworkerType: 'scheduler' } },
      { id: 't', name: 'Tracker', avatarUrl: CHOSEN, permissions: { allowActions: [] }, configuration: { coworkerType: 'tracker' } },
      { id: 'f', name: 'Money Bot', avatarUrl: CHOSEN, permissions: { allowActions: ['notify_user'] }, configuration: { coworkerType: 'finance', capabilities: ['x'] } },
    ]);
    await service.initializeDefaultCoworkers('ws-1');
    expect(aIAgent.update).toHaveBeenCalledWith({
      where: { id: 'f' },
      data: { configuration: { coworkerType: 'ledger', adoptedFrom: 'finance', capabilities: ['x'] } },
    });
    const created = aIAgent.create.mock.calls.map(([arg]: [any]) => arg.data.name);
    expect(created).not.toContain('Ledger');
    expect(created).toEqual(['Shipper', 'Ada', 'Relay']);
  });

  it('gives each new default its own identity', async () => {
    const { service, aIAgent } = setup([]);
    await service.initializeDefaultCoworkers('ws-1');
    const avatars = aIAgent.create.mock.calls.map(([arg]: [any]) => arg.data.avatarUrl);
    expect(avatars[0]).toBe('icon:sparkles:indigo');
    expect(new Set(avatars).size).toBe(avatars.length);
  });

  it('moves defaults still on the old shared look to their identity, and leaves chosen ones alone', async () => {
    const { service, aIAgent } = setup([
      { ...ASSISTANT_ROW, avatarUrl: 'icon:bot' },
      { id: 's', name: 'Scheduler', avatarUrl: null, permissions: { allowActions: [] }, configuration: { coworkerType: 'scheduler' } },
      { id: 't', name: 'Tracker', avatarUrl: 'https://x.test/me.png', permissions: { allowActions: [] }, configuration: { coworkerType: 'tracker' } },
      ...UPGRADED,
    ]);
    await service.initializeDefaultCoworkers('ws-1');
    expect(aIAgent.update.mock.calls.map(([arg]: [any]) => arg)).toEqual([
      { where: { id: 'a' }, data: { avatarUrl: 'icon:sparkles:indigo' } },
      { where: { id: 's' }, data: { avatarUrl: 'icon:workflow:sky' } },
    ]);
  });
});
