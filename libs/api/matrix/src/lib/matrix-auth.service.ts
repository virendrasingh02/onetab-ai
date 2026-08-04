import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { MatrixAdminService } from './matrix-admin.service.js';

/**
 * Bridges our authentication onto Matrix.
 *
 * The contract: a user proves who they are to *us*, and we hand back a
 * short-lived Matrix login token. Matrix is never an identity provider here —
 * it is a message transport that happens to need an account.
 */
@Injectable()
export class MatrixAuthService {
  private readonly logger = new Logger(MatrixAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: MatrixAdminService,
  ) {}

  /**
   * Returns the user's Matrix identity, provisioning it on first use.
   *
   * Provisioning is lazy rather than part of registration so that enabling the
   * bridge later does not require a backfill migration over existing users.
   */
  async ensureIdentity(userId: string): Promise<string | null> {
    if (!this.admin.isEnabled) return null;

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, name: true, displayName: true, matrixUserId: true },
    });

    if (user.matrixUserId) return user.matrixUserId;

    const { matrixUserId } = await this.admin.provisionUser({
      userId: user.id,
      displayName: user.displayName ?? user.name,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { matrixUserId },
    });

    return matrixUserId;
  }

  /**
   * Issues the credentials the browser needs to open its own Matrix session.
   *
   * The token is valid for about a minute and is exchanged immediately by the
   * client, so it is never at rest anywhere sensitive.
   */
  async issueClientCredentials(userId: string): Promise<{
    homeserverUrl: string;
    matrixUserId: string;
    loginToken: string;
  } | null> {
    if (!this.admin.isEnabled) return null;

    const matrixUserId = await this.ensureIdentity(userId);
    if (!matrixUserId) return null;

    const loginToken = await this.admin.createLoginToken(matrixUserId);

    return {
      homeserverUrl: this.admin.serverName
        ? `https://${this.admin.serverName}`
        : '',
      matrixUserId,
      loginToken,
    };
  }

  /**
   * Creates the Matrix room backing a channel and records the link.
   *
   * The channel remains the source of truth for name, membership and
   * permissions; the room is an implementation detail we can recreate.
   */
  async linkChannelToRoom(
    channelId: string,
    creatorUserId: string,
  ): Promise<string | null> {
    if (!this.admin.isEnabled) return null;

    const channel = await this.prisma.channel.findUniqueOrThrow({
      where: { id: channelId },
      select: {
        id: true,
        name: true,
        topic: true,
        visibility: true,
        matrixRoomId: true,
      },
    });

    if (channel.matrixRoomId) return channel.matrixRoomId;

    const creatorMatrixId = await this.ensureIdentity(creatorUserId);
    if (!creatorMatrixId) return null;

    const roomId = await this.admin.createRoom({
      name: channel.name,
      topic: channel.topic ?? undefined,
      isPrivate: channel.visibility === 'PRIVATE',
      // Private channels are encrypted; public ones are not, so history stays
      // searchable and joinable for anyone in the workspace.
      encrypted: channel.visibility === 'PRIVATE',
      creatorMatrixId,
    });

    await this.prisma.channel.update({
      where: { id: channelId },
      data: { matrixRoomId: roomId },
    });

    this.logger.log(`Linked channel ${channel.name} to room ${roomId}`);
    return roomId;
  }

  /** Mirrors a channel membership change into the Matrix room. */
  async syncChannelMembership(
    channelId: string,
    userId: string,
    action: 'join' | 'leave',
  ): Promise<void> {
    if (!this.admin.isEnabled) return;

    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { matrixRoomId: true },
    });
    if (!channel?.matrixRoomId) return;

    const matrixUserId = await this.ensureIdentity(userId);
    if (!matrixUserId) return;

    try {
      if (action === 'join') {
        await this.admin.inviteToRoom(channel.matrixRoomId, matrixUserId);
      } else {
        await this.admin.kickFromRoom(channel.matrixRoomId, matrixUserId);
      }
    } catch (error) {
      // Membership in our database is authoritative. A failed mirror is
      // logged and reconciled later rather than failing the user's action.
      this.logger.warn(
        `Failed to mirror ${action} for ${matrixUserId}: ${String(error)}`,
      );
    }
  }
}
