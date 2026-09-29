import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppEvent } from '@org/api-common';
import { ChannelService } from './channel.service.js';

const CHANNEL_ROW = {
  id: 'chan-1',
  workspaceId: 'ws-1',
  name: 'engineering',
  slug: 'engineering',
  topic: null,
  description: null,
  visibility: 'PUBLIC',
  isArchived: false,
  archivedAt: null,
  mode: 'STANDARD',
  allowReactions: true,
  allowReplies: true,
  allowFileUploads: true,
  announcementPosterIds: [],
  createdById: 'admin-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeService() {
  const prisma: any = {
    channel: {
      findFirst: vi.fn().mockResolvedValue({ id: 'chan-1' }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ ...CHANNEL_ROW }),
      update: vi.fn().mockResolvedValue({ ...CHANNEL_ROW }),
    },
    channelMember: {
      findUnique: vi.fn().mockResolvedValue({ role: 'ADMIN' }),
    },
    workspaceMember: {
      findUnique: vi.fn().mockResolvedValue({ role: 'ADMIN' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  const events = { emit: vi.fn() };
  const service = new ChannelService(prisma, events as any);
  return { service, prisma, events };
}

describe('ChannelService — system/activity event emission (brief §2, §22)', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
  });

  describe('setArchived', () => {
    it('emits ChannelArchiveChanged(archived: true) after archiving succeeds', async () => {
      ctx.prisma.channel.findUniqueOrThrow.mockResolvedValue({ slug: 'engineering', name: 'engineering' });
      ctx.prisma.channel.update.mockResolvedValue({ ...CHANNEL_ROW, isArchived: true });

      await ctx.service.setArchived('ws-1', 'chan-1', 'admin-1', true);

      expect(ctx.events.emit).toHaveBeenCalledWith(
        AppEvent.ChannelArchiveChanged,
        expect.objectContaining({
          workspaceId: 'ws-1',
          actorId: 'admin-1',
          channelId: 'chan-1',
          channelName: 'engineering',
          channelSlug: 'engineering',
          archived: true,
        }),
      );
    });

    it('emits archived: false when restoring', async () => {
      ctx.prisma.channel.findUniqueOrThrow.mockResolvedValue({ slug: 'engineering', name: 'engineering' });

      await ctx.service.setArchived('ws-1', 'chan-1', 'admin-1', false);

      expect(ctx.events.emit).toHaveBeenCalledWith(
        AppEvent.ChannelArchiveChanged,
        expect.objectContaining({ archived: false }),
      );
    });

    it('never emits when the #general guard rejects the archive', async () => {
      ctx.prisma.channel.findUniqueOrThrow.mockResolvedValue({ slug: 'general', name: 'general' });

      await expect(ctx.service.setArchived('ws-1', 'chan-1', 'admin-1', true)).rejects.toThrow();
      expect(ctx.events.emit).not.toHaveBeenCalled();
    });
  });

  describe('update — nameChanged flag', () => {
    it('sets nameChanged: true only when the name actually changed', async () => {
      ctx.prisma.channel.update.mockResolvedValue({ ...CHANNEL_ROW, name: 'new-name', slug: 'new-name' });

      await ctx.service.update('ws-1', 'chan-1', 'admin-1', { name: 'new-name' });

      const [, payload] = ctx.events.emit.mock.calls[0];
      expect(payload.nameChanged).toBe(true);
      expect(payload.name).toBe('new-name');
    });

    it('sets nameChanged: false for a topic-only update, even though `name` is still populated', async () => {
      await ctx.service.update('ws-1', 'chan-1', 'admin-1', { topic: 'new topic' });

      const [, payload] = ctx.events.emit.mock.calls[0];
      expect(payload.nameChanged).toBe(false);
      expect(payload.name).toBe(CHANNEL_ROW.name);
    });
  });
});

describe('ChannelService — channel settings', () => {
  let ctx: ReturnType<typeof makeService>;

  /** Sets the caller's channel and workspace roles for `viewerRoles`. */
  const asViewer = (
    channelRole: 'ADMIN' | 'MEMBER' | null,
    workspaceRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST',
  ) => {
    ctx.prisma.channelMember.findUnique.mockResolvedValue(
      channelRole ? { role: channelRole } : null,
    );
    ctx.prisma.workspaceMember.findUnique.mockResolvedValue({
      role: workspaceRole,
    });
  };

  beforeEach(() => {
    ctx = makeService();
    ctx.prisma.channel.delete = vi.fn().mockResolvedValue({});
  });

  describe('setVisibility', () => {
    it('lets a channel admin make a public channel private, and announces it', async () => {
      asViewer('ADMIN', 'MEMBER');
      ctx.prisma.channel.findUniqueOrThrow.mockResolvedValue({
        visibility: 'PUBLIC',
        slug: 'engineering',
      });
      ctx.prisma.channel.update.mockResolvedValue({
        ...CHANNEL_ROW,
        visibility: 'PRIVATE',
      });

      await ctx.service.setVisibility('ws-1', 'chan-1', 'user-1', 'PRIVATE');

      expect(ctx.prisma.channel.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { visibility: 'PRIVATE' } }),
      );
      expect(ctx.events.emit).toHaveBeenCalledWith(
        AppEvent.ChannelUpdated,
        expect.objectContaining({ visibility: 'PRIVATE', nameChanged: false }),
      );
    });

    it('refuses private → public for a channel admin who is not a workspace admin', async () => {
      asViewer('ADMIN', 'MEMBER');

      await expect(
        ctx.service.setVisibility('ws-1', 'chan-1', 'user-1', 'PUBLIC'),
      ).rejects.toThrow(/workspace admins and owners/);
      expect(ctx.prisma.channel.update).not.toHaveBeenCalled();
    });

    it('allows private → public for a workspace owner', async () => {
      asViewer(null, 'OWNER');
      ctx.prisma.channel.findUniqueOrThrow.mockResolvedValue({
        visibility: 'PRIVATE',
        slug: 'secret',
      });

      await ctx.service.setVisibility('ws-1', 'chan-1', 'owner-1', 'PUBLIC');

      expect(ctx.prisma.channel.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { visibility: 'PUBLIC' } }),
      );
    });

    it('keeps #general public', async () => {
      asViewer('ADMIN', 'ADMIN');
      ctx.prisma.channel.findUniqueOrThrow.mockResolvedValue({
        visibility: 'PUBLIC',
        slug: 'general',
      });

      await expect(
        ctx.service.setVisibility('ws-1', 'chan-1', 'user-1', 'PRIVATE'),
      ).rejects.toThrow(/#general/);
    });
  });

  describe('setTabs', () => {
    it('lets any channel member reorder tabs under the EVERYONE policy, storing a normalized layout', async () => {
      asViewer('MEMBER', 'MEMBER');
      ctx.prisma.channel.findUniqueOrThrow.mockResolvedValue({
        tabManagePolicy: 'EVERYONE',
      });

      await ctx.service.setTabs('ws-1', 'chan-1', 'user-1', {
        order: ['pins'],
        hidden: ['bookmarks'],
      });

      expect(ctx.prisma.channel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            tabOrder: ['pins', 'files-media', 'bookmarks'],
            hiddenTabs: ['bookmarks'],
          },
        }),
      );
    });

    it('refuses a plain member under the MANAGERS policy', async () => {
      asViewer('MEMBER', 'MEMBER');
      ctx.prisma.channel.findUniqueOrThrow.mockResolvedValue({
        tabManagePolicy: 'MANAGERS',
      });

      await expect(
        ctx.service.setTabs('ws-1', 'chan-1', 'user-1', {
          order: [],
          hidden: [],
        }),
      ).rejects.toThrow(/channel managers/);
    });

    it('refuses someone outside the channel even under EVERYONE', async () => {
      asViewer(null, 'MEMBER');
      ctx.prisma.channel.findUniqueOrThrow.mockResolvedValue({
        tabManagePolicy: 'EVERYONE',
      });

      await expect(
        ctx.service.setTabs('ws-1', 'chan-1', 'user-1', {
          order: [],
          hidden: [],
        }),
      ).rejects.toThrow();
    });
  });

  describe('remove', () => {
    it('refuses a channel admin who is not a workspace admin', async () => {
      asViewer('ADMIN', 'MEMBER');

      await expect(ctx.service.remove('ws-1', 'chan-1', 'user-1')).rejects.toThrow(
        /workspace admins and owners/,
      );
      expect(ctx.prisma.channel.delete).not.toHaveBeenCalled();
    });

    it('deletes for a workspace admin and hands the room and members to listeners', async () => {
      asViewer(null, 'ADMIN');
      ctx.prisma.channel.findUniqueOrThrow.mockResolvedValue({
        name: 'engineering',
        slug: 'engineering',
        matrixRoomId: '!room:hs',
        members: [{ userId: 'u1' }, { userId: 'u2' }],
      });

      await ctx.service.remove('ws-1', 'chan-1', 'admin-1');

      expect(ctx.prisma.channel.delete).toHaveBeenCalledWith({
        where: { id: 'chan-1' },
      });
      expect(ctx.events.emit).toHaveBeenCalledWith(AppEvent.ChannelDeleted, {
        workspaceId: 'ws-1',
        actorId: 'admin-1',
        channelId: 'chan-1',
        channelName: 'engineering',
        matrixRoomId: '!room:hs',
        memberIds: ['u1', 'u2'],
      });
    });

    it('never deletes #general', async () => {
      asViewer(null, 'OWNER');
      ctx.prisma.channel.findUniqueOrThrow.mockResolvedValue({
        name: 'general',
        slug: 'general',
        matrixRoomId: null,
        members: [],
      });

      await expect(ctx.service.remove('ws-1', 'chan-1', 'owner-1')).rejects.toThrow(
        /#general/,
      );
      expect(ctx.prisma.channel.delete).not.toHaveBeenCalled();
    });
  });

  describe('update — huddles and tab policy', () => {
    it('persists huddlesEnabled and tabManagePolicy', async () => {
      await ctx.service.update('ws-1', 'chan-1', 'admin-1', {
        huddlesEnabled: false,
        tabManagePolicy: 'MANAGERS',
      });

      expect(ctx.prisma.channel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            huddlesEnabled: false,
            tabManagePolicy: 'MANAGERS',
          }),
        }),
      );
    });
  });
});
