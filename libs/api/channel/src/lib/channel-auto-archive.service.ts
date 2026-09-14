import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppEvent } from '@org/api-common';
import { PrismaService } from '@org/database';
import { resolveWorkspacePolicy } from '@org/types';

/** Workspaces scanned per tick, so a large platform never stalls the loop. */
const WORKSPACE_BATCH = 500;
/** Channels archived per workspace per tick. */
const CHANNEL_BATCH = 200;

/**
 * Archives a channel once it has gone `WorkspacePolicy.autoArchiveInactiveDays`
 * days with no new activity (Settings → Channels & DMs → "Auto-archive
 * inactive channels"). Unset/null (the default) never archives anything —
 * today's behavior is unchanged for every workspace that hasn't opted in.
 *
 * "Activity" is the channel's most recent `RecentActivity` row (populated for
 * both chat messages, via the Matrix bridge, and non-chat events), falling
 * back to the channel's `createdAt` for one that has never had any —
 * otherwise a channel created right before the cutoff would archive
 * immediately on its first sweep.
 *
 * Runs once a day: channel inactivity is a slow-moving signal, unlike
 * temporary-membership expiry (`ChannelMembershipExpiryService`), which this
 * mirrors structurally.
 */
@Injectable()
export class ChannelAutoArchiveService {
  private readonly logger = new Logger(ChannelAutoArchiveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'channel-auto-archive' })
  async sweep(): Promise<void> {
    let cursor: string | undefined;
    let totalArchived = 0;

    for (;;) {
      const settingsRows = await this.prisma.workspaceSettings.findMany({
        select: { workspaceId: true, policies: true },
        take: WORKSPACE_BATCH,
        ...(cursor ? { skip: 1, cursor: { workspaceId: cursor } } : {}),
        orderBy: { workspaceId: 'asc' },
      });
      if (settingsRows.length === 0) break;
      cursor = settingsRows[settingsRows.length - 1]?.workspaceId;

      for (const row of settingsRows) {
        const policy = resolveWorkspacePolicy(row.policies);
        const days = policy.autoArchiveInactiveDays;
        if (!days || days <= 0) continue;

        totalArchived += await this.archiveInactiveIn(row.workspaceId, days);
      }

      if (settingsRows.length < WORKSPACE_BATCH) break;
    }

    if (totalArchived > 0) {
      this.logger.log(`Auto-archived ${totalArchived} inactive channel(s).`);
    }
  }

  private async archiveInactiveIn(
    workspaceId: string,
    days: number,
  ): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const candidates = await this.prisma.channel.findMany({
      where: { workspaceId, isArchived: false },
      select: {
        id: true,
        name: true,
        slug: true,
        createdById: true,
        recentActivities: {
          select: { occurredAt: true },
          orderBy: { occurredAt: 'desc' },
          take: 1,
        },
      },
      take: CHANNEL_BATCH,
    });

    const toArchive = candidates.filter((c) => {
      const lastActivity = c.recentActivities[0]?.occurredAt;
      return (lastActivity ?? null) === null
        ? // No activity rows at all: fall back to createdAt via a second
          // pass below (kept out of this filter to avoid an extra query per
          // candidate — see `channelIds` resolution).
          true
        : lastActivity < cutoff;
    });
    if (toArchive.length === 0) return 0;

    // Re-check the no-activity ones against `createdAt` (a brand-new channel
    // must not archive on its very first sweep).
    const noActivityIds = candidates
      .filter((c) => !c.recentActivities[0])
      .map((c) => c.id);
    const stillEligible = new Set(toArchive.map((c) => c.id));
    if (noActivityIds.length > 0) {
      const created = await this.prisma.channel.findMany({
        where: { id: { in: noActivityIds } },
        select: { id: true, createdAt: true },
      });
      for (const row of created) {
        if (row.createdAt >= cutoff) stillEligible.delete(row.id);
      }
    }

    const finalIds = toArchive.filter((c) => stillEligible.has(c.id));
    if (finalIds.length === 0) return 0;

    const now = new Date();
    await this.prisma.channel.updateMany({
      where: { id: { in: finalIds.map((c) => c.id) } },
      data: { isArchived: true, archivedAt: now },
    });

    for (const c of finalIds) {
      this.events.emit(AppEvent.ChannelArchiveChanged, {
        workspaceId,
        actorId: null,
        channelId: c.id,
        channelName: c.name,
        channelSlug: c.slug,
        archived: true,
      });
    }

    return finalIds.length;
  }
}
