import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MatrixSyncService } from './matrix-sync.service.js';

let txn = 0;
function memberEvent(
  roomId: string,
  stateKey: string,
  membership: string,
  sender = '@onetab_mod:hs',
) {
  return {
    events: [
      {
        type: 'm.room.member',
        room_id: roomId,
        event_id: `$evt${txn}`,
        sender,
        origin_server_ts: Date.now(),
        content: { membership },
        state_key: stateKey,
      },
    ],
  };
}

describe('MatrixSyncService — inbound membership convergence', () => {
  let prisma: any;
  let admin: any;
  let router: any;
  let events: any;
  let service: MatrixSyncService;

  beforeEach(() => {
    txn = 0;
    prisma = {
      user: { findFirst: vi.fn() },
      channel: { findFirst: vi.fn().mockResolvedValue(null) },
      workspace: { findFirst: vi.fn().mockResolvedValue(null) },
      channelMember: {
        upsert: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      workspaceMember: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    admin = { joinRoomAs: vi.fn().mockResolvedValue(undefined) };
    router = { dispatch: vi.fn() };
    events = { emit: vi.fn() };
    service = new MatrixSyncService(prisma, admin, router, events);
  });

  it('deletes the ChannelMember on an inbound channel leave', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u1' });
    prisma.channel.findFirst.mockResolvedValue({ id: 'c1' });

    await service.handleTransaction(
      `t${++txn}`,
      memberEvent('!room:hs', '@onetab_u1:hs', 'leave'),
    );

    expect(prisma.channelMember.deleteMany).toHaveBeenCalledWith({
      where: { channelId: 'c1', userId: 'u1' },
    });
  });

  it('upserts the ChannelMember on an inbound channel join', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u1' });
    prisma.channel.findFirst.mockResolvedValue({ id: 'c1' });

    await service.handleTransaction(
      `t${++txn}`,
      memberEvent('!room:hs', '@onetab_u1:hs', 'join'),
    );

    expect(prisma.channelMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { channelId_userId: { channelId: 'c1', userId: 'u1' } },
        create: { channelId: 'c1', userId: 'u1', role: 'MEMBER' },
      }),
    );
  });

  it('suspends — never deletes — a non-owner on an inbound space leave', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u1' });
    prisma.workspace.findFirst.mockResolvedValue({ id: 'w1', ownerId: 'owner' });

    await service.handleTransaction(
      `t${++txn}`,
      memberEvent('!space:hs', '@onetab_u1:hs', 'leave'),
    );

    expect(prisma.workspaceMember.updateMany).toHaveBeenCalledWith({
      where: { workspaceId: 'w1', userId: 'u1', status: 'ACTIVE' },
      data: { status: 'SUSPENDED' },
    });
  });

  it('never suspends the workspace owner', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'owner' });
    prisma.workspace.findFirst.mockResolvedValue({ id: 'w1', ownerId: 'owner' });

    await service.handleTransaction(
      `t${++txn}`,
      memberEvent('!space:hs', '@onetab_owner:hs', 'leave'),
    );

    expect(prisma.workspaceMember.updateMany).not.toHaveBeenCalled();
  });

  it('only un-suspends on an inbound space join, never creates a membership', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u1' });
    prisma.workspace.findFirst.mockResolvedValue({ id: 'w1', ownerId: 'owner' });

    await service.handleTransaction(
      `t${++txn}`,
      memberEvent('!space:hs', '@onetab_u1:hs', 'join'),
    );

    expect(prisma.workspaceMember.updateMany).toHaveBeenCalledWith({
      where: { workspaceId: 'w1', userId: 'u1', status: 'SUSPENDED' },
      data: { status: 'ACTIVE' },
    });
  });

  it('ignores a membership event for a room we do not track', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u1' });

    await service.handleTransaction(
      `t${++txn}`,
      memberEvent('!dm:hs', '@onetab_u1:hs', 'leave'),
    );

    expect(prisma.channelMember.deleteMany).not.toHaveBeenCalled();
    expect(prisma.workspaceMember.updateMany).not.toHaveBeenCalled();
  });

  it('ignores a membership event for an unknown Matrix identity', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await service.handleTransaction(
      `t${++txn}`,
      memberEvent('!room:hs', '@stranger:hs', 'leave'),
    );

    expect(prisma.channel.findFirst).not.toHaveBeenCalled();
  });

  it('still auto-joins a bot identity on invite (regression)', async () => {
    await service.handleTransaction(
      `t${++txn}`,
      memberEvent('!dm:hs', '@onetab_agent-a1:hs', 'invite'),
    );

    expect(admin.joinRoomAs).toHaveBeenCalledWith('@onetab_agent-a1:hs', '!dm:hs');
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });
});
