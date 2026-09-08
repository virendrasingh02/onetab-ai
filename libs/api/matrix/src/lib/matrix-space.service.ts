import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { WorkspaceRole } from '@org/types';
import { MatrixAdminService } from './matrix-admin.service.js';
import { MatrixAuthService } from './matrix-auth.service.js';

/**
 * The Matrix power level that mirrors a workspace role in the workspace's
 * space room. Roles themselves stay ours — this only decides who can
 * restructure the space (raised to PL50 at creation).
 */
export function powerLevelForRole(role: WorkspaceRole): number {
  switch (role) {
    case WorkspaceRole.OWNER:
      return 100;
    case WorkspaceRole.ADMIN:
      return 50;
    default:
      // MEMBER, GUEST — present in the space, no power over it.
      return 0;
  }
}

/**
 * Mirrors a workspace into a Matrix **space** (`m.space` room).
 *
 * The workspace row stays the source of truth for name, membership and roles;
 * the space is a mirror that gives every channel room one container on the
 * homeserver. Provisioning is lazy — the space is born the first time a channel
 * in the workspace is linked to a room — and every mutation here is
 * best-effort: a homeserver hiccup is logged and left for
 * `MatrixReconcilerService.reconcileSpaces` to converge, never surfaced to the
 * caller.
 */
@Injectable()
export class MatrixSpaceService {
  private readonly logger = new Logger(MatrixSpaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: MatrixAdminService,
    private readonly auth: MatrixAuthService,
  ) {}

  /**
   * Returns the workspace's space id, creating it (and seeding it with the
   * current members) on first call. Returns `null` when Matrix is off, the
   * workspace is gone, it is archived, or the homeserver refused — the caller
   * treats every one of those as "no space yet, try again later".
   */
  async ensureWorkspaceSpace(workspaceId: string): Promise<string | null> {
    if (!this.admin.isEnabled) return null;

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        description: true,
        ownerId: true,
        status: true,
        archivedAt: true,
        matrixSpaceId: true,
        members: {
          where: { status: 'ACTIVE' },
          select: {
            role: true,
            user: { select: { id: true, matrixUserId: true } },
          },
        },
      },
    });

    if (!workspace) return null;
    if (workspace.matrixSpaceId) return workspace.matrixSpaceId;
    // A frozen workspace provisions nothing new, mirroring `linkChannelToRoom`.
    if (workspace.status === 'ARCHIVED' || workspace.archivedAt) return null;

    const ownerMatrixId = await this.auth.ensureIdentity(workspace.ownerId);
    if (!ownerMatrixId) return null;

    let spaceId: string;
    try {
      spaceId = await this.admin.createSpace({
        name: workspace.name,
        topic: workspace.description ?? undefined,
        creatorMatrixId: ownerMatrixId,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to create Matrix space for workspace ${workspaceId}: ${String(error)}`,
      );
      return null;
    }

    // Claim the slot conditionally: if a concurrent call already recorded a
    // space, that one wins and the room just made is left as a harmless orphan
    // (a rare race on a single-instance API; the reconciler never touches it).
    const claimed = await this.prisma.workspace.updateMany({
      where: { id: workspaceId, matrixSpaceId: null },
      data: { matrixSpaceId: spaceId },
    });
    if (claimed.count === 0) {
      const winner = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { matrixSpaceId: true },
      });
      return winner?.matrixSpaceId ?? null;
    }

    for (const member of workspace.members) {
      const matrixUserId =
        member.user.matrixUserId ??
        (await this.auth.ensureIdentity(member.user.id));
      if (!matrixUserId || matrixUserId === ownerMatrixId) continue;

      try {
        await this.admin.inviteToRoom(spaceId, matrixUserId);
        const powerLevel = powerLevelForRole(member.role as WorkspaceRole);
        if (powerLevel > 0) {
          await this.admin.setPowerLevel(spaceId, matrixUserId, powerLevel);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to add ${matrixUserId} to space ${spaceId}: ${String(error)}`,
        );
      }
    }

    this.logger.log(
      `Provisioned Matrix space ${spaceId} for workspace ${workspaceId}`,
    );
    return spaceId;
  }

  /**
   * Nests a channel's room under its workspace's space, provisioning the space
   * if this is the first linked channel. Called right after
   * `MatrixAuthService.linkChannelToRoom` records the room.
   */
  async nestChannelRoom(channelId: string): Promise<void> {
    if (!this.admin.isEnabled) return;

    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { workspaceId: true, matrixRoomId: true, visibility: true },
    });
    if (!channel?.matrixRoomId) return;

    const spaceId = await this.ensureWorkspaceSpace(channel.workspaceId);
    if (!spaceId) return;

    try {
      await this.admin.addRoomToSpace(spaceId, channel.matrixRoomId, {
        suggested: channel.visibility === 'PUBLIC',
      });
    } catch (error) {
      this.logger.warn(
        `Failed to nest channel ${channelId} into space ${spaceId}: ${String(error)}`,
      );
    }
  }

  /** Mirrors a workspace membership change into the space room. */
  async syncSpaceMembership(
    workspaceId: string,
    userId: string,
    action: 'join' | 'leave',
  ): Promise<void> {
    if (!this.admin.isEnabled) return;

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { matrixSpaceId: true },
    });
    // No space yet: the reconciler seeds it from the member list on its next
    // pass, so there is nothing to mirror here.
    if (!workspace?.matrixSpaceId) return;

    const matrixUserId = await this.auth.ensureIdentity(userId);
    if (!matrixUserId) return;

    try {
      if (action === 'join') {
        await this.admin.inviteToRoom(workspace.matrixSpaceId, matrixUserId);
      } else {
        await this.admin.kickFromRoom(workspace.matrixSpaceId, matrixUserId);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to mirror space ${action} for ${matrixUserId}: ${String(error)}`,
      );
    }
  }

  /** Mirrors a workspace role change into the member's space power level. */
  async syncSpacePowerLevel(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<void> {
    if (!this.admin.isEnabled) return;

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { matrixSpaceId: true },
    });
    if (!workspace?.matrixSpaceId) return;

    const matrixUserId = await this.auth.ensureIdentity(userId);
    if (!matrixUserId) return;

    try {
      await this.admin.setPowerLevel(
        workspace.matrixSpaceId,
        matrixUserId,
        powerLevelForRole(role),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to mirror space power level for ${matrixUserId}: ${String(error)}`,
      );
    }
  }
}
