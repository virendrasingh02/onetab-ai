import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SafetyService } from './safety.service.js';

function build() {
  const prisma = {
    user: { findUnique: vi.fn() },
    workspaceMember: { findFirst: vi.fn().mockResolvedValue(null) },
    contentReport: {
      upsert: vi.fn().mockResolvedValue({ id: 'r1', status: 'OPEN' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    userBlock: {
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const matrix = { setIgnoredUsers: vi.fn().mockResolvedValue(true) };
  return {
    prisma,
    matrix,
    service: new SafetyService(prisma as never, matrix as never),
  };
}

const report = {
  targetType: 'MESSAGE' as const,
  targetId: '$event',
  reason: 'HARASSMENT' as const,
};

describe('SafetyService reports', () => {
  it('maps a Matrix author to a platform user', async () => {
    const t = build();
    t.prisma.user.findUnique.mockResolvedValue({ id: 'bad' });

    await t.service.createReport('me', {
      ...report,
      targetMatrixUserId: '@bad:hs',
    });

    const args = t.prisma.contentReport.upsert.mock.calls[0]?.[0];
    expect(args.create.targetUserId).toBe('bad');
    expect(args.where.reporterId_targetType_targetId).toEqual({
      reporterId: 'me',
      targetType: 'MESSAGE',
      targetId: '$event',
    });
  });

  it('does not record a workspace the reporter is not in', async () => {
    const t = build();

    await t.service.createReport('me', { ...report, workspaceId: 'other' });

    const args = t.prisma.contentReport.upsert.mock.calls[0]?.[0];
    expect(args.create.workspaceId).toBeNull();
  });

  it('stamps who closed a report, and 404s an unknown one', async () => {
    const t = build();

    await t.service.resolveReport('r1', 'op', { status: 'ACTIONED' });
    const data = t.prisma.contentReport.updateMany.mock.calls[0]?.[0].data;
    expect(data.resolvedById).toBe('op');
    expect(data.resolvedAt).toBeInstanceOf(Date);

    t.prisma.contentReport.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      t.service.resolveReport('nope', 'op', { status: 'DISMISSED' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('SafetyService blocks', () => {
  const blocker = {
    matrixUserId: '@me:hs',
    blocksMade: [
      { blocked: { matrixUserId: '@bad:hs' } },
      { blocked: { matrixUserId: null } },
    ],
  };

  it('refuses to block yourself', async () => {
    const t = build();

    await expect(t.service.block('me', { userId: 'me' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('404s someone who does not exist', async () => {
    const t = build();
    t.prisma.user.findUnique.mockResolvedValue(null);

    await expect(t.service.block('me', { userId: 'ghost' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('writes the whole block list to the homeserver', async () => {
    const t = build();
    t.prisma.user.findUnique
      .mockResolvedValueOnce({ id: 'bad' })
      .mockResolvedValueOnce(blocker);

    const result = await t.service.block('me', { userId: 'bad' });

    expect(t.matrix.setIgnoredUsers).toHaveBeenCalledWith('@me:hs', [
      '@bad:hs',
    ]);
    expect(result).toEqual({ blocked: true, chatEnforced: true });
  });

  it('keeps the block when the homeserver is unreachable, and says so', async () => {
    const t = build();
    t.prisma.user.findUnique
      .mockResolvedValueOnce({ id: 'bad' })
      .mockResolvedValueOnce(blocker);
    t.matrix.setIgnoredUsers.mockRejectedValue(new Error('down'));

    const result = await t.service.block('me', { userId: 'bad' });

    expect(t.prisma.userBlock.upsert).toHaveBeenCalled();
    expect(result.chatEnforced).toBe(false);
  });
});
