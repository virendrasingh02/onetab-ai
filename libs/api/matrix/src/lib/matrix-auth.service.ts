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

  /** The Matrix id already recorded for a user, without provisioning one. */
  async getIdentity(userId: string): Promise<string | null> {
    if (!this.admin.isEnabled) return null;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { matrixUserId: true },
    });

    return user?.matrixUserId ?? null;
  }

  /**
   * Issues the credentials the browser needs to drive its own Matrix session.
   *
   * The access token is minted by the bridge on the user's behalf — they never
   * see a Matrix password. `deviceId` is empty when the homeserver issued a
   * session without one, which is the signal that this session cannot do
   * end-to-end encryption. The browser persists the whole thing, so this runs
   * once per browser rather than once per page load.
   */
  async issueClientCredentials(userId: string): Promise<{
    homeserverUrl: string;
    matrixUserId: string;
    accessToken: string;
    deviceId: string;
  } | null> {
    if (!this.admin.isEnabled) return null;

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true, displayName: true },
    });

    const matrixUserId = await this.ensureIdentity(userId);
    if (!matrixUserId) return null;

    const session = await this.admin.createUserSession(
      matrixUserId,
      user.displayName ?? user.name,
    );

    return {
      // The configured URL, not one derived from the server name: those are
      // different things. `MATRIX_SERVER_NAME` is the Matrix identity that
      // appears in user and room ids, while the client needs a dialable
      // address — locally `http://localhost:8008`, which no amount of
      // string-building from `localhost` will produce.
      homeserverUrl: this.admin.homeserverUrl,
      matrixUserId: session.matrixUserId,
      accessToken: session.accessToken,
      deviceId: session.deviceId,
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

  /**
   * The Matrix identity of someone the caller shares a workspace with.
   *
   * The browser needs the peer's Matrix id to open a direct message, and it
   * cannot derive one: the localpart is hashed from our user id and the server
   * name is deployment configuration. Provisioning happens here too, so a DM to
   * someone who has never opened chat still lands in a room they can join.
   *
   * Returns `null` when the two do not share a workspace — the caller turns
   * that into a 404 rather than a 403, so this cannot be used to probe whether
   * a given user id exists.
   */
  async resolvePeerIdentity(
    callerUserId: string,
    peerUserId: string,
  ): Promise<string | null> {
    if (!this.admin.isEnabled || callerUserId === peerUserId) return null;

    const shared = await this.prisma.workspaceMember.findFirst({
      where: {
        userId: peerUserId,
        workspace: { members: { some: { userId: callerUserId } } },
      },
      select: { id: true },
    });
    if (!shared) return null;

    return this.ensureIdentity(peerUserId);
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
