import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppEvent } from '@org/api-common';
import { PrismaService } from '@org/database';
import {
  pickActiveScheduledStatus,
  scheduledStatusWindowEnd,
  type ScheduledStatusRule,
} from '@org/types';

/**
 * Applies the winning scheduled status onto each user, once a minute (brief §9).
 *
 * Deterministic and idempotent: {@link pickActiveScheduledStatus} decides the
 * active entry (priority ↓, then updatedAt ↓, then id ↑), and this only writes
 * when the applied entry actually changed. A status the user set *by hand*
 * (`scheduledStatusAppliedId` null, not expired) is never overwritten — a
 * scheduled entry takes over only once that manual status clears or lapses.
 * This same pass finally makes manual-status expiry real (it was a read-time
 * mask before).
 */
@Injectable()
export class ScheduledStatusApplierService {
  private readonly logger = new Logger(ScheduledStatusApplierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'scheduled-status-applier' })
  async apply(): Promise<void> {
    const now = new Date();
    await this.applyScheduled(now);
    await this.clearExpiredManual(now);
  }

  private async applyScheduled(now: Date): Promise<void> {
    const rows = await this.prisma.scheduledStatus.findMany({
      where: { isEnabled: true },
      select: {
        id: true,
        userId: true,
        priority: true,
        recurrence: true,
        startAt: true,
        endAt: true,
        startMinute: true,
        endMinute: true,
        daysOfWeek: true,
        activeFrom: true,
        activeUntil: true,
        timezone: true,
        updatedAt: true,
        statusText: true,
        statusEmoji: true,
        presence: true,
        user: {
          select: {
            timezone: true,
            statusText: true,
            statusExpiresAt: true,
            scheduledStatusAppliedId: true,
          },
        },
      },
    });

    const byUser = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byUser.get(row.userId) ?? [];
      list.push(row);
      byUser.set(row.userId, list);
    }

    let applied = 0;
    let cleared = 0;

    for (const [userId, userRows] of byUser) {
      const user = userRows[0].user;
      const rules: ScheduledStatusRule[] = userRows.map((r) => ({
        id: r.id,
        isEnabled: true,
        priority: r.priority,
        recurrence: r.recurrence as ScheduledStatusRule['recurrence'],
        startAt: r.startAt?.toISOString() ?? null,
        endAt: r.endAt?.toISOString() ?? null,
        startMinute: r.startMinute,
        endMinute: r.endMinute,
        daysOfWeek: r.daysOfWeek,
        activeFrom: r.activeFrom?.toISOString() ?? null,
        activeUntil: r.activeUntil?.toISOString() ?? null,
        timezone: r.timezone || user.timezone || 'UTC',
        updatedAt: r.updatedAt.toISOString(),
      }));

      const active = pickActiveScheduledStatus(rules, now);
      const appliedId = user.scheduledStatusAppliedId;

      const manualLive =
        appliedId == null &&
        user.statusText != null &&
        (user.statusExpiresAt == null || user.statusExpiresAt > now);

      if (active) {
        if (active.id === appliedId) continue; // already applied
        if (manualLive) continue; // a hand-set status wins for now

        const chosen = userRows.find((r) => r.id === active.id);
        if (!chosen) continue;

        await this.prisma.user.update({
          where: { id: userId },
          data: {
            statusText: chosen.statusText,
            statusEmoji: chosen.statusEmoji ?? null,
            statusExpiresAt: scheduledStatusWindowEnd(active, now),
            scheduledStatusAppliedId: active.id,
            ...(chosen.presence ? { presence: chosen.presence } : {}),
          },
        });
        applied++;
        await this.broadcast(userId, {
          statusText: chosen.statusText,
          statusEmoji: chosen.statusEmoji ?? null,
          presence: chosen.presence ?? null,
          source: 'schedule',
        });
      } else if (appliedId != null) {
        // The scheduled window closed and nothing else is active — clear it.
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            statusText: null,
            statusEmoji: null,
            statusExpiresAt: null,
            scheduledStatusAppliedId: null,
          },
        });
        cleared++;
        await this.broadcast(userId, {
          statusText: null,
          statusEmoji: null,
          presence: null,
          source: 'schedule-cleared',
        });
      }
    }

    if (applied || cleared) {
      this.logger.log(
        `Scheduled status: applied ${applied}, cleared ${cleared}.`,
      );
    }
  }

  /** Clear a lapsed *manual* status — this used to only be masked at read time. */
  private async clearExpiredManual(now: Date): Promise<void> {
    const expired = await this.prisma.user.findMany({
      where: {
        scheduledStatusAppliedId: null,
        statusText: { not: null },
        statusExpiresAt: { not: null, lte: now },
      },
      select: { id: true },
      take: 500,
    });
    if (expired.length === 0) return;

    await this.prisma.user.updateMany({
      where: { id: { in: expired.map((u) => u.id) } },
      data: { statusText: null, statusEmoji: null, statusExpiresAt: null },
    });

    for (const u of expired) {
      await this.broadcast(u.id, {
        statusText: null,
        statusEmoji: null,
        presence: null,
        source: 'expiry',
      });
    }
    this.logger.log(`Cleared ${expired.length} lapsed manual status(es).`);
  }

  private async broadcast(
    userId: string,
    payload: {
      statusText: string | null;
      statusEmoji: string | null;
      presence: string | null;
      source: 'schedule' | 'schedule-cleared' | 'expiry';
    },
  ): Promise<void> {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { workspaceId: true },
    });
    const workspaceIds = memberships.map((m) => m.workspaceId);

    this.events.emit(AppEvent.UserStatusChanged, {
      workspaceId: workspaceIds[0] ?? '',
      actorId: null,
      userId,
      workspaceIds,
      ...payload,
    });
  }
}
