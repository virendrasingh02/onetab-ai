import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MatrixSpaceService,
  powerLevelForRole,
} from './matrix-space.service.js';

const OWNER_MXID = '@onetab_owner:hs';
const ADMIN_MXID = '@onetab_admin:hs';

describe('powerLevelForRole', () => {
  it('maps workspace roles to space power levels', () => {
    expect(powerLevelForRole('OWNER' as never)).toBe(100);
    expect(powerLevelForRole('ADMIN' as never)).toBe(50);
    expect(powerLevelForRole('MEMBER' as never)).toBe(0);
    expect(powerLevelForRole('GUEST' as never)).toBe(0);
  });
});

describe('MatrixSpaceService', () => {
  let prisma: any;
  let admin: any;
  let auth: any;
  let service: MatrixSpaceService;

  beforeEach(() => {
    prisma = {
      workspace: {
        findUnique: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      channel: { findUnique: vi.fn() },
    };
    admin = {
      isEnabled: true,
      createSpace: vi.fn().mockResolvedValue('!space:hs'),
      inviteToRoom: vi.fn().mockResolvedValue(undefined),
      kickFromRoom: vi.fn().mockResolvedValue(undefined),
      setPowerLevel: vi.fn().mockResolvedValue(undefined),
      addRoomToSpace: vi.fn().mockResolvedValue(undefined),
    };
    auth = {
      ensureIdentity: vi.fn(async (userId: string) =>
        userId === 'owner' ? OWNER_MXID : userId === 'admin' ? ADMIN_MXID : `@onetab_${userId}:hs`,
      ),
    };
    service = new MatrixSpaceService(prisma, admin, auth);
  });

  describe('ensureWorkspaceSpace', () => {
    it('returns the existing space id without provisioning a second one', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'w1',
        name: 'W',
        description: null,
        ownerId: 'owner',
        status: 'ACTIVE',
        archivedAt: null,
        matrixSpaceId: '!existing:hs',
        members: [],
      });

      await expect(service.ensureWorkspaceSpace('w1')).resolves.toBe(
        '!existing:hs',
      );
      expect(admin.createSpace).not.toHaveBeenCalled();
    });

    it('refuses to provision a space for an archived workspace', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'w1',
        name: 'W',
        description: null,
        ownerId: 'owner',
        status: 'ARCHIVED',
        archivedAt: new Date(),
        matrixSpaceId: null,
        members: [],
      });

      await expect(service.ensureWorkspaceSpace('w1')).resolves.toBeNull();
      expect(admin.createSpace).not.toHaveBeenCalled();
    });

    it('creates the space and seeds every active member except the owner', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'w1',
        name: 'Acme',
        description: 'the topic',
        ownerId: 'owner',
        status: 'ACTIVE',
        archivedAt: null,
        matrixSpaceId: null,
        members: [
          { role: 'OWNER', user: { id: 'owner', matrixUserId: OWNER_MXID } },
          { role: 'ADMIN', user: { id: 'admin', matrixUserId: ADMIN_MXID } },
          { role: 'MEMBER', user: { id: 'bob', matrixUserId: '@onetab_bob:hs' } },
        ],
      });

      await expect(service.ensureWorkspaceSpace('w1')).resolves.toBe('!space:hs');

      expect(admin.createSpace).toHaveBeenCalledWith({
        name: 'Acme',
        topic: 'the topic',
        creatorMatrixId: OWNER_MXID,
      });
      expect(prisma.workspace.updateMany).toHaveBeenCalledWith({
        where: { id: 'w1', matrixSpaceId: null },
        data: { matrixSpaceId: '!space:hs' },
      });
      // Owner is already joined at PL100 — not re-invited.
      expect(admin.inviteToRoom).toHaveBeenCalledTimes(2);
      expect(admin.inviteToRoom).toHaveBeenCalledWith('!space:hs', ADMIN_MXID);
      expect(admin.inviteToRoom).toHaveBeenCalledWith('!space:hs', '@onetab_bob:hs');
      // Only the admin gets a raised power level.
      expect(admin.setPowerLevel).toHaveBeenCalledTimes(1);
      expect(admin.setPowerLevel).toHaveBeenCalledWith('!space:hs', ADMIN_MXID, 50);
    });

    it('yields to a concurrent provisioner that already claimed the slot', async () => {
      prisma.workspace.findUnique
        .mockResolvedValueOnce({
          id: 'w1',
          name: 'Acme',
          description: null,
          ownerId: 'owner',
          status: 'ACTIVE',
          archivedAt: null,
          matrixSpaceId: null,
          members: [],
        })
        .mockResolvedValueOnce({ matrixSpaceId: '!winner:hs' });
      prisma.workspace.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.ensureWorkspaceSpace('w1')).resolves.toBe('!winner:hs');
      expect(admin.inviteToRoom).not.toHaveBeenCalled();
    });
  });

  describe('nestChannelRoom', () => {
    it('does nothing until the channel has a room', async () => {
      prisma.channel.findUnique.mockResolvedValue({
        workspaceId: 'w1',
        matrixRoomId: null,
        visibility: 'PUBLIC',
      });

      await service.nestChannelRoom('c1');
      expect(admin.addRoomToSpace).not.toHaveBeenCalled();
    });

    it('nests a linked public channel room as suggested', async () => {
      prisma.channel.findUnique.mockResolvedValue({
        workspaceId: 'w1',
        matrixRoomId: '!room:hs',
        visibility: 'PUBLIC',
      });
      vi.spyOn(service, 'ensureWorkspaceSpace').mockResolvedValue('!space:hs');

      await service.nestChannelRoom('c1');
      expect(admin.addRoomToSpace).toHaveBeenCalledWith('!space:hs', '!room:hs', {
        suggested: true,
      });
    });
  });

  describe('syncSpaceMembership', () => {
    it('is a no-op when the workspace has no space yet', async () => {
      prisma.workspace.findUnique.mockResolvedValue({ matrixSpaceId: null });

      await service.syncSpaceMembership('w1', 'bob', 'join');
      expect(admin.inviteToRoom).not.toHaveBeenCalled();
      expect(admin.kickFromRoom).not.toHaveBeenCalled();
    });

    it('invites on join and kicks on leave', async () => {
      prisma.workspace.findUnique.mockResolvedValue({ matrixSpaceId: '!space:hs' });

      await service.syncSpaceMembership('w1', 'bob', 'join');
      expect(admin.inviteToRoom).toHaveBeenCalledWith('!space:hs', '@onetab_bob:hs');

      await service.syncSpaceMembership('w1', 'bob', 'leave');
      expect(admin.kickFromRoom).toHaveBeenCalledWith('!space:hs', '@onetab_bob:hs');
    });
  });
});
