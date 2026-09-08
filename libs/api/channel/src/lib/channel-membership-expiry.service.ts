import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppEvent } from '@org/api-common';
import { PrismaService } from '@org/database';

/** Rows removed per tick, so a spike of expiries never stalls the loop. */
const BATCH = 200;

/**
 * Removes temporary channel memberships once their window closes (brief §8).
 *
 * Server-side expiry, not a client timer: this is what actually makes an
 * expired member lose access. For each swept row it emits
 * `ChannelMembershipChanged` (leave) — the Matrix bridge listener kicks them
 * from the room — and `ChannelAccessExpired` — the notifications listener tells
 * them their access ended. Deleting the row is enough for our own auth, which
 * re-checks `ChannelMember` on every request.
 */
@Injectable()
export class ChannelMembershipExpiryService {
  private readonly logger = new Logger(ChannelMembershipExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'channel-membership-expiry' })
  async sweep(): Promise<void> {
    const now = new Date();

    const expired = await this.prisma.channelMember.findMany({
      where: {
        membershipType: 'TEMPORARY',
        expiresAt: { not: null, lte: now },
      },
      take: BATCH,
      select: {
        id: true,
        userId: true,
        channel: {
          select: { id: true, name: true, slug: true, workspaceId: true },
        },
      },
    });

    if (expired.length === 0) return;

    await this.prisma.channelMember.deleteMany({
      where: { id: { in: expired.map((m) => m.id) } },
    });

    for (const m of expired) {
      this.events.emit(AppEvent.ChannelMembershipChanged, {
        workspaceId: m.channel.workspaceId,
        actorId: m.userId,
        channelId: m.channel.id,
        userId: m.userId,
        action: 'leave',
        role: null,
      });
      this.events.emit(AppEvent.ChannelAccessExpired, {
        workspaceId: m.channel.workspaceId,
        actorId: null,
        channelId: m.channel.id,
        channelName: m.channel.name,
        channelSlug: m.channel.slug,
        userId: m.userId,
      });
    }

    this.logger.log(
      `Swept ${expired.length} expired temporary channel membership(s).`,
    );
  }
}
