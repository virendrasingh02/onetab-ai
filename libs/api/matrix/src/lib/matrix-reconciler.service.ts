import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@org/database';
import { MatrixAdminService } from './matrix-admin.service.js';

/** Channels reconciled per tick, so a large workspace does not stall the loop. */
const BATCH = 40;

/**
 * Converges Matrix room membership back onto our own.
 *
 * `MatrixAuthService.syncChannelMembership` mirrors a join/leave into the room
 * best-effort and, on failure, logs "reconciled later" — but nothing did the
 * reconciling (audit B8: "no scheduler, no queue"). This is that reconciler.
 *
 * Each tick, for a batch of channels that have a room:
 *   - invite every channel member whose Matrix id is missing from the room;
 *   - kick every room member who is a *known human* in this workspace but is no
 *     longer in the channel.
 *
 * Bots (agents, connected apps) never carry a `User.matrixUserId`, so they are
 * outside the "known human" set and are never kicked. No-ops entirely when
 * Matrix is not configured.
 */
@Injectable()
export class MatrixReconcilerService {
  private readonly logger = new Logger(MatrixReconcilerService.name);
  /** Rotates through channels across ticks. */
  private offset = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: MatrixAdminService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'matrix-membership-reconcile' })
  async reconcile(): Promise<void> {
    if (!this.admin.isEnabled) return;

    const channels = await this.prisma.channel.findMany({
      where: { matrixRoomId: { not: null } },
      orderBy: { createdAt: 'asc' },
      skip: this.offset,
      take: BATCH,
      select: {
        id: true,
        name: true,
        workspaceId: true,
        matrixRoomId: true,
        members: { select: { user: { select: { matrixUserId: true } } } },
      },
    });

    if (channels.length < BATCH) {
      this.offset = 0; // wrapped around
    } else {
      this.offset += BATCH;
    }

    let invited = 0;
    let kicked = 0;

    for (const channel of channels) {
      const roomId = channel.matrixRoomId;
      if (!roomId) continue;

      try {
        const roomMembers = new Set(await this.admin.getRoomMembers(roomId));
        const desired = new Set(
          channel.members
            .map((m) => m.user.matrixUserId)
            .filter((id): id is string => !!id),
        );

        for (const id of desired) {
          if (!roomMembers.has(id)) {
            await this.admin.inviteToRoom(roomId, id);
            invited++;
          }
        }

        // Only humans we know are members of this workspace are eligible to be
        // kicked — never a bot, never someone from another tenant.
        const workspaceHumans = new Set(
          (
            await this.prisma.workspaceMember.findMany({
              where: {
                workspaceId: channel.workspaceId,
                user: { matrixUserId: { not: null } },
              },
              select: { user: { select: { matrixUserId: true } } },
            })
          )
            .map((m) => m.user.matrixUserId)
            .filter((id): id is string => !!id),
        );

        for (const id of roomMembers) {
          if (workspaceHumans.has(id) && !desired.has(id)) {
            await this.admin.kickFromRoom(
              roomId,
              id,
              'Reconciled: no longer a channel member',
            );
            kicked++;
          }
        }
      } catch (err) {
        this.logger.warn(
          `Reconcile failed for channel ${channel.name} (${channel.id}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    if (invited || kicked) {
      this.logger.log(
        `Matrix membership reconcile: +${invited} invited, -${kicked} kicked across ${channels.length} channel(s).`,
      );
    }
  }
}
