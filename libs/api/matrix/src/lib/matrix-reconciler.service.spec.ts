import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MatrixReconcilerService } from './matrix-reconciler.service.js';

describe('MatrixReconcilerService.reconcileSpaces', () => {
  let prisma: any;
  let admin: any;
  let space: any;
  let service: MatrixReconcilerService;

  beforeEach(() => {
    prisma = {
      workspace: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'w1',
            name: 'Acme',
            matrixSpaceId: '!space:hs',
            members: [
              { role: 'OWNER', user: { matrixUserId: '@o:hs' } },
              { role: 'ADMIN', user: { matrixUserId: '@a:hs' } },
              { role: 'MEMBER', user: { matrixUserId: '@b:hs' } },
            ],
            channels: [{ matrixRoomId: '!room:hs' }],
          },
        ]),
      },
      workspaceMember: {
        findMany: vi.fn().mockResolvedValue([
          { user: { matrixUserId: '@o:hs' } },
          { user: { matrixUserId: '@a:hs' } },
          { user: { matrixUserId: '@b:hs' } },
          { user: { matrixUserId: '@ghost:hs' } },
        ]),
      },
    };
    admin = {
      isEnabled: true,
      getRoomMembers: vi
        .fn()
        .mockResolvedValue(['@o:hs', '@b:hs', '@ghost:hs', '@onetab_agent-x:hs']),
      inviteToRoom: vi.fn().mockResolvedValue(undefined),
      kickFromRoom: vi.fn().mockResolvedValue(undefined),
      setPowerLevel: vi.fn().mockResolvedValue(undefined),
      setPowerLevels: vi.fn().mockResolvedValue(undefined),
      getPowerLevels: vi
        .fn()
        .mockResolvedValue({ '@o:hs': 100, '@a:hs': 0, '@b:hs': 0 }),
      listSpaceChildren: vi.fn().mockResolvedValue([]),
      addRoomToSpace: vi.fn().mockResolvedValue(undefined),
    };
    space = { ensureWorkspaceSpace: vi.fn() };
    service = new MatrixReconcilerService(prisma, admin, space);
  });

  it('invites active members missing from the space at their role power level', async () => {
    await service.reconcileSpaces();

    expect(admin.inviteToRoom).toHaveBeenCalledWith('!space:hs', '@a:hs');
    expect(admin.setPowerLevel).toHaveBeenCalledWith('!space:hs', '@a:hs', 50);
    // Owner and Bob are already in the room.
    expect(admin.inviteToRoom).toHaveBeenCalledTimes(1);
  });

  it('kicks a known human who is no longer a member but never a bot', async () => {
    await service.reconcileSpaces();

    expect(admin.kickFromRoom).toHaveBeenCalledTimes(1);
    expect(admin.kickFromRoom).toHaveBeenCalledWith(
      '!space:hs',
      '@ghost:hs',
      expect.any(String),
    );
  });

  it('nests a linked channel room not already under the space', async () => {
    await service.reconcileSpaces();

    expect(admin.addRoomToSpace).toHaveBeenCalledWith('!space:hs', '!room:hs');
  });

  it('corrects power-level drift in a single call', async () => {
    await service.reconcileSpaces();

    expect(admin.setPowerLevels).toHaveBeenCalledWith('!space:hs', {
      '@a:hs': 50,
    });
  });

  it('provisions a space for a workspace that has a linked room but none yet', async () => {
    prisma.workspace.findMany.mockResolvedValue([
      {
        id: 'w2',
        name: 'NoSpace',
        matrixSpaceId: null,
        members: [],
        channels: [{ matrixRoomId: '!room2:hs' }],
      },
    ]);
    prisma.workspaceMember.findMany.mockResolvedValue([]);
    space.ensureWorkspaceSpace.mockResolvedValue('!fresh:hs');

    await service.reconcileSpaces();

    expect(space.ensureWorkspaceSpace).toHaveBeenCalledWith('w2');
    expect(admin.addRoomToSpace).toHaveBeenCalledWith('!fresh:hs', '!room2:hs');
  });

  it('does nothing when Matrix is disabled', async () => {
    admin.isEnabled = false;

    await service.reconcileSpaces();

    expect(prisma.workspace.findMany).not.toHaveBeenCalled();
  });
});
