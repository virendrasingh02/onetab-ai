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
