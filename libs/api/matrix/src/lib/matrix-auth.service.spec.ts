import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MatrixAuthService } from './matrix-auth.service.js';

describe('MatrixAuthService channel membership mirror', () => {
  let prisma: any;
  let admin: any;
  let service: MatrixAuthService;

  beforeEach(() => {
    prisma = {
      channel: {
        findUnique: vi.fn().mockResolvedValue({ matrixRoomId: '!room:hs' }),
      },
      channelMember: { findUnique: vi.fn() },
      user: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'u1',
          name: 'Amara',
          matrixUserId: '@u1:hs',
        }),
      },
    };
    admin = {
      isEnabled: true,
      ensureJoined: vi.fn().mockResolvedValue(undefined),
      inviteToRoom: vi.fn().mockResolvedValue(undefined),
      kickFromRoom: vi.fn().mockResolvedValue(undefined),
    };
    service = new MatrixAuthService(prisma, admin);
  });

  it('joins (not merely invites) a user added to a channel', async () => {
    await service.syncChannelMembership('c1', 'u1', 'join');

    expect(admin.ensureJoined).toHaveBeenCalledWith('!room:hs', '@u1:hs');
    expect(admin.inviteToRoom).not.toHaveBeenCalled();
  });

  it('kicks a user removed from a channel', async () => {
    await service.syncChannelMembership('c1', 'u1', 'leave');

    expect(admin.kickFromRoom).toHaveBeenCalledWith('!room:hs', '@u1:hs');
  });

  it('self-heals a Postgres channel member into the room', async () => {
    prisma.channelMember.findUnique.mockResolvedValue({
      channel: { matrixRoomId: '!room:hs' },
    });

    await expect(service.ensureChannelRoomJoined('c1', 'u1')).resolves.toBe(true);
    expect(admin.ensureJoined).toHaveBeenCalledWith('!room:hs', '@u1:hs');
  });

  it('refuses to join someone who is not a channel member', async () => {
    prisma.channelMember.findUnique.mockResolvedValue(null);

    await expect(service.ensureChannelRoomJoined('c1', 'u1')).resolves.toBe(false);
    expect(admin.ensureJoined).not.toHaveBeenCalled();
  });
});
