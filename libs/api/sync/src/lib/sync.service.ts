import { Injectable } from '@nestjs/common';
import { PrismaService } from '@org/database';
import type { SyncChangesDigest, SyncResourceChange, SyncState } from '@org/types';

/** Rows returned per category. Beyond this the client is told to full-refetch. */
const CATEGORY_CAP = 200;
/** The furthest back a `since` is honoured — older asks a full reconcile. */
const MAX_LOOKBACK_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * "What changed in this workspace since `since`" for one member.
   *
   * Returns ids + timestamps only — enough for the client to invalidate the
   * right cached queries. Every query is filtered on `workspaceId`, so this can
   * never disclose another workspace's activity; notifications are additionally
   * filtered to the calling user.
   */
  async getChanges(
    workspaceId: string,
    userId: string,
    sinceInput?: string,
  ): Promise<SyncChangesDigest> {
    const now = new Date();
    const floor = new Date(now.getTime() - MAX_LOOKBACK_MS);
    let since = sinceInput ? new Date(sinceInput) : floor;
    if (Number.isNaN(since.getTime()) || since < floor) since = floor;

    const take = CATEGORY_CAP + 1;
    const byUpdatedAt = { updatedAt: 'desc' as const };
    const rowSelect = { id: true, updatedAt: true };

    const [channels, members, notifications, tasks, projects, meetings] =
      await Promise.all([
        this.prisma.channel.findMany({
          where: { workspaceId, updatedAt: { gt: since } },
          select: rowSelect,
          orderBy: byUpdatedAt,
          take,
        }),
        this.prisma.workspaceMember.findMany({
          where: { workspaceId, updatedAt: { gt: since } },
          select: rowSelect,
          orderBy: byUpdatedAt,
          take,
        }),
        this.prisma.notification.findMany({
          where: {
            workspaceId,
            recipientId: userId,
            OR: [{ createdAt: { gt: since } }, { readAt: { gt: since } }],
          },
          select: { id: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take,
        }),
        this.prisma.task.findMany({
          where: { workspaceId, updatedAt: { gt: since } },
          select: rowSelect,
          orderBy: byUpdatedAt,
          take,
        }),
        this.prisma.project.findMany({
          where: { workspaceId, updatedAt: { gt: since } },
          select: rowSelect,
          orderBy: byUpdatedAt,
          take,
        }),
        this.prisma.meeting.findMany({
          where: { workspaceId, updatedAt: { gt: since } },
          select: rowSelect,
          orderBy: byUpdatedAt,
          take,
        }),
      ]);

    const unreadCount = await this.prisma.notification.count({
      where: { workspaceId, recipientId: userId, readAt: null },
    });

    const trim = (
      rows: Array<{ id: string; updatedAt?: Date; createdAt?: Date }>,
    ): { list: SyncResourceChange[]; capped: boolean } => {
      const capped = rows.length > CATEGORY_CAP;
      const list = rows.slice(0, CATEGORY_CAP).map((r) => ({
        id: r.id,
        updatedAt: (r.updatedAt ?? r.createdAt ?? now).toISOString(),
      }));
      return { list, capped };
    };

    const c = trim(channels);
    const m = trim(members);
    const n = trim(notifications);
    const t = trim(tasks);
    const p = trim(projects);
    const mt = trim(meetings);

    return {
      workspaceId,
      since: since.toISOString(),
      serverTime: now.toISOString(),
      hasMore:
        c.capped || m.capped || n.capped || t.capped || p.capped || mt.capped,
      changed: {
        channels: c.list,
        members: m.list,
        notifications: n.list,
        tasks: t.list,
        projects: p.list,
        meetings: mt.list,
      },
      unreadCount,
    };
  }

  /** Cheap counts-only snapshot for reconciling badges. */
  async getState(workspaceId: string, userId: string): Promise<SyncState> {
    const [unreadCount, mentionCount] = await Promise.all([
      this.prisma.notification.count({
        where: { workspaceId, recipientId: userId, readAt: null },
      }),
      this.prisma.notification.count({
        where: {
          workspaceId,
          recipientId: userId,
          readAt: null,
          kind: 'MENTION',
        },
      }),
    ]);

    return {
      workspaceId,
      serverTime: new Date().toISOString(),
      unreadCount,
      mentionCount,
    };
  }
}
