import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatMissedListener, previewOf } from './chat-missed.listener.js';
import { NotificationCenterService } from './notification-center.service.js';

const prisma = {
  notification: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  },
  workspaceMember: { findFirst: vi.fn() },
  channel: { findFirst: vi.fn() },
  channelMember: { findFirst: vi.fn() },
  notificationPreference: { findUnique: vi.fn() },
  user: { findFirst: vi.fn() },
  aIAgent: { findFirst: vi.fn() },
};
const events = { emit: vi.fn() };

const report = {
  roomId: '!room:hs',
  eventId: '$e1',
  title: 'Alice in #general',
  body: 'hello',
  senderId: 'alice',
};
const row = { id: 'n1', workspaceId: 'ws1', recipientId: 'me', createdAt: new Date() };

describe('NotificationCenterService chat rows', () => {
  let service: NotificationCenterService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.notification.findFirst.mockResolvedValue(null);
    prisma.notification.create.mockResolvedValue(row);
    prisma.notification.findUniqueOrThrow.mockResolvedValue(row);
    prisma.notification.count.mockResolvedValue(1);
    prisma.workspaceMember.findFirst.mockImplementation(({ where }) =>
      Promise.resolve({
        id: 'm',
        userId: where.userId,
        workspaceId: where.workspaceId ?? 'shared',
      }),
    );
    prisma.channel.findFirst.mockResolvedValue({
      id: 'c1',
      slug: 'general',
      workspaceId: 'ws1',
    });
    prisma.channelMember.findFirst.mockResolvedValue(null);
    prisma.notificationPreference.findUnique.mockResolvedValue(null);
    service = new NotificationCenterService(prisma as never, events as never);
  });

  it('files under the channel’s workspace, whatever the client says', async () => {
    await service.reportChatMessage('me', { ...report, workspaceId: 'other' });

    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({
      workspaceId: 'ws1',
      recipientId: 'me',
      actorId: 'alice',
      kind: 'CHAT_MESSAGE',
      deepLink: 'channels/general',
      resourceType: 'chat-room',
      resourceId: '!room:hs',
      sourceEventId: '$e1',
    });
    expect(events.emit).toHaveBeenCalledTimes(1);
  });

  it('updates the unread row and announces each new message', async () => {
    prisma.notification.findFirst.mockResolvedValue({ id: 'n1' });
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });

    await service.reportChatMessage('me', { ...report, eventId: '$e2' });

    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(prisma.notification.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 'n1', sourceEventId: { not: '$e2' } },
      data: { sourceEventId: '$e2', body: 'hello' },
    });
    expect(events.emit).toHaveBeenCalledTimes(1);
  });

  it('announces one message once, however many report it', async () => {
    prisma.notification.findFirst.mockResolvedValue({ id: 'n1' });
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });

    await service.reportChatMessage('me', report);
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('treats losing the insert race as already reported', async () => {
    prisma.notification.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.reportChatMessage('me', report)).resolves.toBeNull();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('refuses a workspace the caller is not in', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue(null);
    await expect(service.reportChatMessage('me', report)).resolves.toBeNull();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('applies that workspace’s mutes and mention levels', async () => {
    prisma.notificationPreference.findUnique.mockResolvedValue({
      mutedChannelIds: ['c1'],
      mentionsOnly: false,
    });
    await expect(
      service.reportChatMessage('me', { ...report, isMention: true }),
    ).resolves.toBeNull();

    prisma.notificationPreference.findUnique.mockResolvedValue(null);
    prisma.channelMember.findFirst.mockResolvedValue({
      isMuted: false,
      mentionsOnly: true,
    });
    await expect(service.reportChatMessage('me', report)).resolves.toBeNull();

    await service.reportChatMessage('me', { ...report, isMention: true });
    expect(prisma.notification.create.mock.calls[0][0].data.kind).toBe(
      'MENTION',
    );
  });

  it('files a DM in a workspace both people share', async () => {
    prisma.channel.findFirst.mockResolvedValue(null);
    await service.reportChatMessage('me', report);

    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({
      workspaceId: 'shared',
      deepLink: 'dms/alice',
    });
  });

  it('links a group by room and keeps the thread', async () => {
    prisma.channel.findFirst.mockResolvedValue(null);
    await service.reportChatMessage('me', {
      ...report,
      isGroup: true,
      threadRootId: '$root',
      workspaceId: 'ws1',
    });

    expect(prisma.notification.create.mock.calls[0][0].data.deepLink).toBe(
      'dms?room=!room%3Ahs&thread=%24root',
    );
  });

  it('never notifies someone about their own message', async () => {
    await expect(
      service.reportChatMessage('me', { ...report, senderId: 'me' }),
    ).resolves.toBeNull();
  });

  it('clears only the caller’s rows, in every workspace holding them', async () => {
    prisma.notification.findMany.mockResolvedValue([
      { workspaceId: 'ws1' },
      { workspaceId: 'ws2' },
    ]);
    prisma.notification.updateMany.mockResolvedValue({ count: 2 });
    prisma.notification.count.mockResolvedValue(0);

    await service.markChatRoomRead('me', '!room:hs');

    expect(prisma.notification.updateMany.mock.calls[0][0].where).toMatchObject({
      recipientId: 'me',
      resourceType: 'chat-room',
      resourceId: '!room:hs',
    });
    expect(events.emit).toHaveBeenCalledTimes(2);
  });

  it('stays quiet when there was nothing to clear', async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    await service.markChatRoomRead('me', '!room:hs');
    expect(prisma.notification.updateMany).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });
});

describe('ChatMissedListener', () => {
  const center = { reportChatMessage: vi.fn() };
  const missed = {
    recipientId: 'me',
    roomId: '!room:hs',
    eventId: '$e1',
    senderMatrixId: '@alice:hs',
    content: { msgtype: 'm.text', body: 'hello' },
    isEncrypted: false,
    isMention: false,
    isGroup: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.user.findFirst.mockResolvedValue({
      id: 'alice',
      name: 'Alice',
      displayName: null,
    });
    prisma.aIAgent.findFirst.mockResolvedValue(null);
    prisma.channel.findFirst.mockResolvedValue({ name: 'general' });
  });

  it('words a channel message like the client does', async () => {
    await new ChatMissedListener(prisma as never, center as never).onMissed(
      missed,
    );
    expect(center.reportChatMessage).toHaveBeenCalledWith(
      'me',
      expect.objectContaining({
        title: 'Alice in #general',
        body: 'hello',
        senderId: 'alice',
      }),
    );
  });

  it('never exposes an encrypted message, and strips reply quotes', () => {
    expect(previewOf({ ...missed, isEncrypted: true })).toBeNull();
    expect(
      previewOf({
        ...missed,
        content: { body: '> <@a:hs> old\n> line\n\nnew reply' },
      }),
    ).toBe('new reply');
  });
});
