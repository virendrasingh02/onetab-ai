import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SystemEventsListener } from './system-events.listener.js';

const ROOM = { roomId: '!room:hs', name: 'engineering', workspaceId: 'ws-1' };

function makePublisher() {
  return {
    resolveChannelRoom: vi.fn().mockResolvedValue(ROOM),
    resolveAppRoom: vi.fn().mockResolvedValue({ roomId: '!app-dm:hs', workspaceId: 'ws-1' }),
    resolveUser: vi.fn(async (id: string | null) =>
      id ? { kind: 'user', id, name: `User ${id}` } : null,
    ),
    resolveUserMatrixId: vi.fn().mockResolvedValue('@john:hs'),
    resolveAiEntity: vi.fn(async (id: string, entityType: 'agent' | 'coworker') => ({
      kind: entityType,
      id,
      name: `Entity ${id}`,
    })),
    resolveApp: vi.fn(async (id: string) => ({ kind: 'app', id, name: `App ${id}` })),
    publish: vi.fn().mockResolvedValue(undefined),
  };
}

describe('SystemEventsListener', () => {
  let publisher: ReturnType<typeof makePublisher>;
  let listener: SystemEventsListener;

  beforeEach(() => {
    publisher = makePublisher();
    listener = new SystemEventsListener(publisher as never);
  });

  describe('onChannelMembershipChanged (brief §6-7)', () => {
    it('posts member_joined with no actor mention when a user joins themselves', async () => {
      await listener.onChannelMembershipChanged({
        workspaceId: 'ws-1',
        actorId: 'user-1',
        channelId: 'chan-1',
        userId: 'user-1',
        action: 'join',
        role: 'MEMBER',
      });

      expect(publisher.publish).toHaveBeenCalledTimes(1);
      const call = publisher.publish.mock.calls[0][0];
      expect(call.eventType).toBe('member_joined');
      expect(call.mentionMatrixUserIds).toBeUndefined();
    });

    it('posts member_added and mentions the added user when an admin adds them', async () => {
      await listener.onChannelMembershipChanged({
        workspaceId: 'ws-1',
        actorId: 'admin-1',
        channelId: 'chan-1',
        userId: 'user-1',
        action: 'join',
        role: 'MEMBER',
      });

      const call = publisher.publish.mock.calls[0][0];
      expect(call.eventType).toBe('member_added');
      expect(call.actor).toEqual({ kind: 'user', id: 'admin-1', name: 'User admin-1' });
      expect(call.target).toEqual({ kind: 'user', id: 'user-1', name: 'User user-1' });
      expect(call.mentionMatrixUserIds).toEqual(['@john:hs']);
    });

    it('posts member_left for a self-initiated leave', async () => {
      await listener.onChannelMembershipChanged({
        workspaceId: 'ws-1',
        actorId: 'user-1',
        channelId: 'chan-1',
        userId: 'user-1',
        action: 'leave',
        role: null,
      });

      expect(publisher.publish.mock.calls[0][0].eventType).toBe('member_left');
    });

    it('posts member_removed when an admin removes someone else', async () => {
      await listener.onChannelMembershipChanged({
        workspaceId: 'ws-1',
        actorId: 'admin-1',
        channelId: 'chan-1',
        userId: 'user-1',
        action: 'leave',
        role: null,
      });

      expect(publisher.publish.mock.calls[0][0].eventType).toBe('member_removed');
    });

    it('does nothing when the channel has no room yet', async () => {
      publisher.resolveChannelRoom.mockResolvedValueOnce(null);

      await listener.onChannelMembershipChanged({
        workspaceId: 'ws-1',
        actorId: 'user-1',
        channelId: 'chan-1',
        userId: 'user-1',
        action: 'join',
        role: 'MEMBER',
      });

      expect(publisher.publish).not.toHaveBeenCalled();
    });

    it('never throws even when the publisher rejects', async () => {
      publisher.publish.mockRejectedValueOnce(new Error('boom'));

      await expect(
        listener.onChannelMembershipChanged({
          workspaceId: 'ws-1',
          actorId: 'user-1',
          channelId: 'chan-1',
          userId: 'user-1',
          action: 'join',
          role: 'MEMBER',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('AI Agent / Coworker channel links (brief §3, §5)', () => {
    it('posts agent_added on link', async () => {
      await listener.onChannelAiEntityLinked({
        workspaceId: 'ws-1',
        actorId: 'admin-1',
        channelId: 'chan-1',
        entityId: 'agent-1',
        entityType: 'agent',
      });
      expect(publisher.publish.mock.calls[0][0].eventType).toBe('agent_added');
    });

    it('posts coworker_added on link', async () => {
      await listener.onChannelAiEntityLinked({
        workspaceId: 'ws-1',
        actorId: 'admin-1',
        channelId: 'chan-1',
        entityId: 'coworker-1',
        entityType: 'coworker',
      });
      expect(publisher.publish.mock.calls[0][0].eventType).toBe('coworker_added');
    });

    it('posts agent_removed on unlink', async () => {
      await listener.onChannelAiEntityUnlinked({
        workspaceId: 'ws-1',
        actorId: 'admin-1',
        channelId: 'chan-1',
        entityId: 'agent-1',
        entityType: 'agent',
      });
      expect(publisher.publish.mock.calls[0][0].eventType).toBe('agent_removed');
    });

    it('maps isEnabled true/false to enabled/disabled per entity type', async () => {
      await listener.onChannelAiEntityEnabledChanged({
        workspaceId: 'ws-1',
        actorId: 'admin-1',
        channelId: 'chan-1',
        entityId: 'coworker-1',
        entityType: 'coworker',
        isEnabled: false,
      });
      expect(publisher.publish.mock.calls[0][0].eventType).toBe('coworker_disabled');
    });
  });

  describe('App channel links (brief §4)', () => {
    it('posts app_added on link', async () => {
      await listener.onChannelAppLinked({
        workspaceId: 'ws-1',
        actorId: 'admin-1',
        channelId: 'chan-1',
        integrationId: 'int-1',
      });
      expect(publisher.publish.mock.calls[0][0].eventType).toBe('app_added');
      expect(publisher.publish.mock.calls[0][0].target).toEqual({
        kind: 'app',
        id: 'int-1',
        name: 'App int-1',
      });
    });

    it('posts app_removed on unlink', async () => {
      await listener.onChannelAppUnlinked({
        workspaceId: 'ws-1',
        actorId: 'admin-1',
        channelId: 'chan-1',
        integrationId: 'int-1',
      });
      expect(publisher.publish.mock.calls[0][0].eventType).toBe('app_removed');
    });

    it('posts app_connected/app_disconnected into the app own DM room', async () => {
      await listener.onIntegrationConnected({
        workspaceId: 'ws-1',
        actorId: 'user-1',
        integrationId: 'int-1',
      });
      expect(publisher.publish.mock.calls[0][0]).toMatchObject({
        eventType: 'app_connected',
        conversationType: 'app',
        roomId: '!app-dm:hs',
      });

      await listener.onIntegrationDisconnected({
        workspaceId: 'ws-1',
        actorId: 'user-1',
        integrationId: 'int-1',
      });
      expect(publisher.publish.mock.calls[1][0].eventType).toBe('app_disconnected');
    });

    it('skips the integration lifecycle event when the app has no DM room yet', async () => {
      publisher.resolveAppRoom.mockResolvedValueOnce(null);

      await listener.onIntegrationConnected({
        workspaceId: 'ws-1',
        actorId: 'user-1',
        integrationId: 'int-1',
      });

      expect(publisher.publish).not.toHaveBeenCalled();
    });
  });

  describe('Channel lifecycle (brief §2)', () => {
    it('posts channel_archived / channel_unarchived', async () => {
      await listener.onChannelArchiveChanged({
        workspaceId: 'ws-1',
        actorId: 'admin-1',
        channelId: 'chan-1',
        channelName: 'engineering',
        channelSlug: 'engineering',
        archived: true,
      });
      expect(publisher.publish.mock.calls[0][0].eventType).toBe('channel_archived');

      await listener.onChannelArchiveChanged({
        workspaceId: 'ws-1',
        actorId: 'admin-1',
        channelId: 'chan-1',
        channelName: 'engineering',
        channelSlug: 'engineering',
        archived: false,
      });
      expect(publisher.publish.mock.calls[1][0].eventType).toBe('channel_unarchived');
    });

    it('posts channel_renamed only when the update actually changed the name', async () => {
      await listener.onChannelUpdated({
        workspaceId: 'ws-1',
        actorId: 'admin-1',
        channelId: 'chan-1',
        name: 'new-name',
        slug: 'new-name',
        nameChanged: true,
      });
      expect(publisher.publish).toHaveBeenCalledTimes(1);
      expect(publisher.publish.mock.calls[0][0].eventType).toBe('channel_renamed');
    });

    it('does not post anything for a topic/posting-only update', async () => {
      await listener.onChannelUpdated({
        workspaceId: 'ws-1',
        actorId: 'admin-1',
        channelId: 'chan-1',
        name: 'engineering',
        slug: 'engineering',
        nameChanged: false,
        posting: {
          mode: 'ANNOUNCEMENT',
          allowReactions: true,
          allowReplies: false,
          allowFileUploads: true,
        },
      });
      expect(publisher.publish).not.toHaveBeenCalled();
    });
  });
});
