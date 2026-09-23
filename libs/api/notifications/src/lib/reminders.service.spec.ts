import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RemindersService } from './reminders.service.js';

describe('RemindersService', () => {
  let prisma: any;
  let center: { create: ReturnType<typeof vi.fn> };
  let service: RemindersService;

  const row = (overrides: Record<string, unknown> = {}) => ({
    id: 'rem_1',
    workspaceId: 'ws_1',
    userId: 'u_1',
    roomId: '!room:hs',
    eventId: '$evt',
    deepLink: 'c/general?msg=%24evt',
    snippet: 'Ship the release',
    remindAt: new Date(Date.now() - 1000),
    firedAt: null,
    createdAt: new Date(),
    ...overrides,
  });

  const input = (remindAt: Date) => ({
    roomId: '!room:hs',
    eventId: '$evt',
    remindAt: remindAt.toISOString(),
    deepLink: 'c/general?msg=%24evt',
    snippet: 'Ship the release',
  });

  beforeEach(() => {
    prisma = {
      messageReminder: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => row(data)),
        update: vi.fn().mockImplementation(({ data }) => row(data)),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      workspaceMember: { count: vi.fn().mockResolvedValue(1) },
    };
    center = { create: vi.fn().mockResolvedValue({ id: 'n_1' }) };
    service = new RemindersService(prisma, center as never);
  });

  it('creates a reminder for a future time', async () => {
    const at = new Date(Date.now() + 3_600_000);
    const reminder = await service.create('ws_1', 'u_1', input(at));

    expect(prisma.messageReminder.create).toHaveBeenCalled();
    expect(reminder.remindAt).toBe(at.toISOString());
  });

  it('reschedules instead of stacking a second reminder on the same message', async () => {
    prisma.messageReminder.findFirst.mockResolvedValue({ id: 'rem_1' });

    await service.create('ws_1', 'u_1', input(new Date(Date.now() + 60_000 * 20)));

    expect(prisma.messageReminder.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rem_1' } }),
    );
    expect(prisma.messageReminder.create).not.toHaveBeenCalled();
  });

  it('rejects times in the past and more than a year out', async () => {
    await expect(
      service.create('ws_1', 'u_1', input(new Date(Date.now() - 10 * 60_000))),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.create('ws_1', 'u_1', input(new Date(Date.now() + 400 * 86_400_000))),
    ).rejects.toThrow(BadRequestException);
  });

  it('fires a due reminder once, as a notification that opens the message', async () => {
    prisma.messageReminder.findMany.mockResolvedValue([row()]);

    await service.sweep();

    expect(prisma.messageReminder.updateMany).toHaveBeenCalledWith({
      where: { id: 'rem_1', firedAt: null },
      data: { firedAt: expect.any(Date) },
    });
    expect(center.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'u_1',
        kind: 'MESSAGE_REMINDER',
        deepLink: 'c/general?msg=%24evt',
        resourceId: 'rem_1',
      }),
    );
  });

  it('skips a reminder another instance already claimed', async () => {
    prisma.messageReminder.findMany.mockResolvedValue([row()]);
    prisma.messageReminder.updateMany.mockResolvedValue({ count: 0 });

    await service.sweep();

    expect(center.create).not.toHaveBeenCalled();
  });

  it('drops the reminder of someone who left the workspace', async () => {
    prisma.messageReminder.findMany.mockResolvedValue([row()]);
    prisma.workspaceMember.count.mockResolvedValue(0);

    await service.sweep();

    expect(center.create).not.toHaveBeenCalled();
  });
});
