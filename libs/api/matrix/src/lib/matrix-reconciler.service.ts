import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@org/database';
import { WorkspaceRole } from '@org/types';
import { MatrixAdminService } from './matrix-admin.service.js';
import { MatrixAuthService } from './matrix-auth.service.js';
import {
  MatrixSpaceService,
  powerLevelForRole,
} from './matrix-space.service.js';

/** Channels reconciled per tick, so a large workspace does not stall the loop. */
const BATCH = 40;

/** Users whose Matrix profile is checked for backfill per tick. */
const PROFILE_BATCH = 20;

/** Workspaces whose space is reconciled per tick — heavier than a channel
 *  (member + hierarchy + power-level passes), so a smaller batch. */
const SPACE_BATCH = 20;

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
  /** Rotates through users across profile-backfill ticks. */
  private profileOffset = 0;
  /** Rotates through workspaces across space-reconcile ticks. */
  private spaceOffset = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: MatrixAdminService,
    private readonly space: MatrixSpaceService,
    private readonly auth: MatrixAuthService,
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
        mode: true,
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

        // Converge the announcement-mode posting policy onto the room's power
        // levels — the backstop for a missed `channel.updated` event (§3).
        // Only announcement channels need it: a STANDARD channel's
        // `events_default` is 0 by default and nothing else raises it, so
        // re-checking every room every tick would be pure Synapse traffic.
        if (channel.mode === 'ANNOUNCEMENT') {
          await this.auth.applyChannelPostingPolicy(channel.id);
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

  /**
   * Converges each workspace's Matrix **space** with our own model.
   *
   * Per tick, for a batch of workspaces that already have a space — or have a
   * linked channel room but no space yet (existing tenants, seeded here on the
   * first pass):
   *   - invite every ACTIVE member missing from the space, at the power level
   *     their workspace role maps to;
   *   - kick every space member who is a known human in this workspace but no
   *     longer an ACTIVE member (covers SUSPENDED and removed alike);
   *   - nest every linked, unarchived channel room under the space;
   *   - fix power-level drift for members whose role changed while they stayed.
   *
   * Bots never carry a `User.matrixUserId`, so they are outside the "known
   * human" set and never kicked — same rule as `reconcile()`.
   */
  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'matrix-space-reconcile' })
  async reconcileSpaces(): Promise<void> {
    if (!this.admin.isEnabled) return;

    const workspaces = await this.prisma.workspace.findMany({
      where: {
        OR: [
          { matrixSpaceId: { not: null } },
          { channels: { some: { matrixRoomId: { not: null } } } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      skip: this.spaceOffset,
      take: SPACE_BATCH,
      select: {
        id: true,
        name: true,
        matrixSpaceId: true,
        members: {
          where: { status: 'ACTIVE' },
          select: {
            role: true,
            user: { select: { matrixUserId: true } },
          },
        },
        channels: {
          where: { matrixRoomId: { not: null }, isArchived: false },
          select: { matrixRoomId: true },
        },
      },
    });

    if (workspaces.length < SPACE_BATCH) {
      this.spaceOffset = 0;
    } else {
      this.spaceOffset += SPACE_BATCH;
    }

    let invited = 0;
    let kicked = 0;
    let nested = 0;

    for (const workspace of workspaces) {
      try {
        const spaceId =
          workspace.matrixSpaceId ??
          (await this.space.ensureWorkspaceSpace(workspace.id));
        if (!spaceId) continue;

        const roomMembers = new Set(await this.admin.getRoomMembers(spaceId));

        // Desired: ACTIVE members with a Matrix identity → target power level.
        const desired = new Map<string, number>();
        for (const member of workspace.members) {
          if (member.user.matrixUserId) {
            desired.set(
              member.user.matrixUserId,
              powerLevelForRole(member.role as WorkspaceRole),
            );
          }
        }

        for (const [matrixUserId, powerLevel] of desired) {
          if (!roomMembers.has(matrixUserId)) {
            await this.admin.inviteToRoom(spaceId, matrixUserId);
            invited++;
            if (powerLevel > 0) {
              await this.admin.setPowerLevel(spaceId, matrixUserId, powerLevel);
            }
          }
        }

        // Every human this workspace has ever known a Matrix id for — the only
        // ids eligible to be kicked (never a bot, never another tenant).
        const workspaceHumans = new Set(
          (
            await this.prisma.workspaceMember.findMany({
              where: {
                workspaceId: workspace.id,
                user: { matrixUserId: { not: null } },
              },
              select: { user: { select: { matrixUserId: true } } },
            })
          )
            .map((m) => m.user.matrixUserId)
            .filter((id): id is string => !!id),
        );

        for (const matrixUserId of roomMembers) {
          if (workspaceHumans.has(matrixUserId) && !desired.has(matrixUserId)) {
            await this.admin.kickFromRoom(
              spaceId,
              matrixUserId,
              'Reconciled: no longer an active workspace member',
            );
            kicked++;
          }
        }

        // Nest any linked channel room not already under the space.
        const children = new Set(await this.admin.listSpaceChildren(spaceId));
        for (const channel of workspace.channels) {
          if (channel.matrixRoomId && !children.has(channel.matrixRoomId)) {
            await this.admin.addRoomToSpace(spaceId, channel.matrixRoomId);
            nested++;
          }
        }

        // Fix power-level drift in one PUT, only when something is off.
        const currentLevels = await this.admin.getPowerLevels(spaceId);
        const corrections: Record<string, number> = {};
        for (const [matrixUserId, powerLevel] of desired) {
          if ((currentLevels[matrixUserId] ?? 0) !== powerLevel) {
            corrections[matrixUserId] = powerLevel;
          }
        }
        if (Object.keys(corrections).length > 0) {
          await this.admin.setPowerLevels(spaceId, corrections);
        }
      } catch (err) {
        this.logger.warn(
          `Space reconcile failed for workspace ${workspace.name} (${workspace.id}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    if (invited || kicked || nested) {
      this.logger.log(
        `Matrix space reconcile: +${invited} invited, -${kicked} kicked, +${nested} room(s) nested across ${workspaces.length} workspace(s).`,
      );
    }
  }

  /**
   * Backfills Matrix profiles for accounts that set a photo before the profile
   * sync existed.
   *
   * `UserService.updateProfile` and `MatrixAuthService.ensureIdentity` keep new
   * changes in step going forward; this loop is the one-time catch-up. It skips
   * anyone whose Matrix profile already carries an avatar, so it converges and
   * then does nothing — and it never overwrites a photo the user changed after
   * the first sync.
   */
  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'matrix-profile-backfill' })
  async backfillProfiles(): Promise<void> {
    if (!this.admin.isEnabled) return;

    const candidates = await this.prisma.user.findMany({
      where: { matrixUserId: { not: null }, avatarUrl: { not: null } },
      orderBy: { createdAt: 'asc' },
      skip: this.profileOffset,
      take: PROFILE_BATCH,
      select: { id: true },
    });

    if (candidates.length < PROFILE_BATCH) {
      this.profileOffset = 0;
    } else {
      this.profileOffset += PROFILE_BATCH;
    }

    let synced = 0;

    for (const { id } of candidates) {
      try {
        if (await this.admin.getUserAvatarMxc(id)) continue;

        const user = await this.prisma.user.findUnique({
          where: { id },
          select: { name: true, displayName: true, avatarUrl: true },
        });
        if (!user?.avatarUrl) continue;

        await this.admin.pushUserProfile({
          userId: id,
          displayName: user.displayName ?? user.name,
          avatarUrl: user.avatarUrl,
        });
        synced++;
      } catch (err) {
        this.logger.warn(
          `Profile backfill failed for user ${id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    if (synced) {
      this.logger.log(`Matrix profile backfill: synced ${synced} user(s).`);
    }
  }
}
