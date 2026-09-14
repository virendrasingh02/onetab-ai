import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SystemEventPublisherService } from './system-event-publisher.service.js';

function makeService() {
  const prisma: any = {
    user: { findUnique: vi.fn() },
    aIAgent: { findUnique: vi.fn() },
    externalIntegration: { findUnique: vi.fn() },
    channel: { findUnique: vi.fn() },
  };
  const admin: any = {
    isEnabled: true,
    provisionUser: vi.fn().mockResolvedValue({ matrixUserId: '@onetab_system-events:hs' }),
    joinRoomAs: vi.fn().mockResolvedValue(undefined),
  };
  const messaging: any = {
    sendStructured: vi.fn().mockResolvedValue('$event:hs'),
  };
  const service = new SystemEventPublisherService(prisma, admin, messaging);
  return { service, prisma, admin, messaging };
}

describe('SystemEventPublisherService', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
  });

  describe('publish', () => {
    const basePublishInput = {
      eventType: 'member_added' as const,
      conversationType: 'channel' as const,
      roomId: '!room:hs',
      conversationId: 'chan-1',
      workspaceId: 'ws-1',
      conversationName: 'engineering',
      actor: { kind: 'user' as const, id: 'admin-1', name: 'VR' },
      target: { kind: 'user' as const, id: 'user-1', name: 'John' },
      idempotencyKey: 'channel-member:chan-1:user-1:join:admin-1',
    };

    it('provisions the system bot, joins the room, and posts the structured event', async () => {
      const { service, admin, messaging } = ctx;

      await service.publish(basePublishInput);

      expect(admin.provisionUser).toHaveBeenCalledWith({
        userId: 'system-events',
        displayName: expect.any(String),
      });
      expect(admin.joinRoomAs).toHaveBeenCalledWith('@onetab_system-events:hs', '!room:hs');
      expect(messaging.sendStructured).toHaveBeenCalledTimes(1);

      const [roomId, senderId, content, options] = messaging.sendStructured.mock.calls[0];
      expect(roomId).toBe('!room:hs');
      expect(senderId).toBe('@onetab_system-events:hs');
      expect(content).toMatchObject({
        type: 'mie.system_event',
        eventType: 'member_added',
        conversationId: 'chan-1',
        actor: basePublishInput.actor,
        target: basePublishInput.target,
      });
      expect(options.fallbackBody).toContain('John');
      expect(options.fallbackBody).toContain('VR');
    });

    it('only provisions the system bot once across multiple publishes', async () => {
      const { service, admin } = ctx;

      await service.publish({ ...basePublishInput, idempotencyKey: 'key-1' });
      await service.publish({ ...basePublishInput, idempotencyKey: 'key-2' });

      expect(admin.provisionUser).toHaveBeenCalledTimes(1);
    });

    it('suppresses a duplicate post with the same idempotency key (brief §30)', async () => {
      const { service, messaging } = ctx;

      await service.publish(basePublishInput);
      await service.publish(basePublishInput);

      expect(messaging.sendStructured).toHaveBeenCalledTimes(1);
    });

    it('still posts a genuinely repeated action once its own key differs', async () => {
      const { service, messaging } = ctx;

      await service.publish({ ...basePublishInput, idempotencyKey: 'key-1' });
      await service.publish({ ...basePublishInput, idempotencyKey: 'key-2' });

      expect(messaging.sendStructured).toHaveBeenCalledTimes(2);
    });

    it('forwards mentionMatrixUserIds so the affected person gets a personal notification', async () => {
      const { service, messaging } = ctx;

      await service.publish({ ...basePublishInput, mentionMatrixUserIds: ['@john:hs'] });

      const [, , , options] = messaging.sendStructured.mock.calls[0];
      expect(options.mentionUserIds).toEqual(['@john:hs']);
    });

    it('does nothing when Matrix is disabled', async () => {
      const { service, admin, messaging } = ctx;
      admin.isEnabled = false;

      await service.publish(basePublishInput);

      expect(admin.provisionUser).not.toHaveBeenCalled();
      expect(messaging.sendStructured).not.toHaveBeenCalled();
    });

    it('never throws when the homeserver call fails — a failed mirror must not fail the caller', async () => {
      const { service, messaging } = ctx;
      messaging.sendStructured.mockRejectedValueOnce(new Error('homeserver down'));

      await expect(service.publish(basePublishInput)).resolves.toBeUndefined();
    });
  });

  describe('resolveChannelRoom', () => {
    it('returns null when the channel has no room yet', async () => {
      const { service, prisma } = ctx;
      prisma.channel.findUnique.mockResolvedValue({ matrixRoomId: null, name: 'x', workspaceId: 'ws' });

      await expect(service.resolveChannelRoom('chan-1')).resolves.toBeNull();
    });

    it('returns the room, name and workspace when provisioned', async () => {
      const { service, prisma } = ctx;
      prisma.channel.findUnique.mockResolvedValue({
        matrixRoomId: '!room:hs',
        name: 'engineering',
        workspaceId: 'ws-1',
      });

      await expect(service.resolveChannelRoom('chan-1')).resolves.toEqual({
        roomId: '!room:hs',
        name: 'engineering',
        workspaceId: 'ws-1',
      });
    });
  });

  describe('entity resolution (brief §19-20: historical events survive deletion)', () => {
    it('resolveUser falls back to a deleted-user snapshot when the row is gone', async () => {
      const { service, prisma } = ctx;
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.resolveUser('gone')).resolves.toEqual({
        kind: 'user',
        id: 'gone',
        name: 'Deleted user',
        isDeleted: true,
      });
    });

    it('resolveUser returns null for a null (system-initiated) actor', async () => {
      const { service } = ctx;
      await expect(service.resolveUser(null)).resolves.toBeNull();
    });

    it('resolveAiEntity marks an inactive agent as deleted without breaking rendering', async () => {
      const { service, prisma } = ctx;
      prisma.aIAgent.findUnique.mockResolvedValue({
        id: 'agent-1',
        name: 'Research Agent',
        avatarUrl: null,
        isActive: false,
      });

      await expect(service.resolveAiEntity('agent-1', 'agent')).resolves.toEqual({
        kind: 'agent',
        id: 'agent-1',
        name: 'Research Agent',
        avatarUrl: undefined,
        isDeleted: true,
      });
    });

    it('resolveAiEntity falls back to a deleted snapshot when the row no longer exists', async () => {
      const { service, prisma } = ctx;
      prisma.aIAgent.findUnique.mockResolvedValue(null);

      await expect(service.resolveAiEntity('gone', 'coworker')).resolves.toEqual({
        kind: 'coworker',
        id: 'gone',
        name: 'Deleted AI Coworker',
        isDeleted: true,
      });
    });

    it('resolveApp uses the display name, falling back to the provider key', async () => {
      const { service, prisma } = ctx;
      prisma.externalIntegration.findUnique.mockResolvedValue({
        id: 'int-1',
        displayName: null,
        provider: 'google-calendar',
        status: 'CONNECTED',
      });

      await expect(service.resolveApp('int-1')).resolves.toEqual({
        kind: 'app',
        id: 'int-1',
        name: 'google-calendar',
        provider: 'google-calendar',
        isDeleted: false,
      });
    });
  });
});
