import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
      select: {
        id: true,
        name: true,
        displayName: true,
        avatarUrl: true,
        matrixUserId: true,
      },
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

    // Provisioning sets a display name but never an avatar. Push the uploaded
    // photo (if any) now, so the first message this account sends already
    // carries it. Best-effort — chat works without it.
    if (user.avatarUrl) {
      void this.admin
        .pushUserProfile({ userId: user.id, avatarUrl: user.avatarUrl })
        .catch(() => undefined);
    }

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

    /*
     * This route sits outside `/workspaces/:workspaceId`, so
     * `WorkspaceRoleGuard` never runs for it and the channel id arrives
     * unvetted. The membership test therefore has to happen here: without it
     * any signed-in account could provision — and be handed the id of — the
     * Matrix room backing any channel in any workspace, which is a chat
     * history leak dressed up as a room link.
     *
     * Private channels additionally require channel membership, mirroring
     * `findBySlug`: workspace membership alone does not open a private room.
     */
    const channel = await this.prisma.channel.findFirst({
      where: {
        id: channelId,
        workspace: {
          members: { some: { userId: creatorUserId, status: 'ACTIVE' } },
        },
        OR: [
          { visibility: 'PUBLIC' },
          { members: { some: { userId: creatorUserId } } },
        ],
      },
      select: {
        id: true,
        name: true,
        topic: true,
        visibility: true,
        matrixRoomId: true,
      },
    });

    // 404 rather than 403, so this cannot be used to probe channel ids.
    if (!channel) throw new NotFoundException('Channel not found.');

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
   * The Matrix identity of a peer the caller may open a direct message with —
   * a teammate, an AI agent, or a connected app.
   *
   * The browser needs the peer's Matrix id to open a direct message, and it
   * cannot derive one: the localpart is hashed from our user/agent/integration
   * id and the server name is deployment configuration. Provisioning happens
   * here too, so a DM to a peer who has never been opened in chat before —
   * human, agent, or app — still lands in a room they can join.
   *
   * `peerId` is dispatched by prefix: `agent-<agentId>` and `app-<integrationId>`
   * address an `AIAgent`/`ExternalIntegration` row directly (the same prefixes
   * the sidebar and `DirectMessagesView` already use to badge these peers);
   * anything else is treated as a human user id.
   *
   * Returns `null` when the peer cannot be resolved — the caller turns that
   * into a 404 rather than a 403, so this cannot be used to probe whether a
   * given id exists.
   */
  async resolvePeerIdentity(
    callerUserId: string,
    peerId: string,
  ): Promise<string | null> {
    if (!this.admin.isEnabled) return null;

    if (peerId.startsWith('agent-')) {
      return this.resolveAgentIdentity(callerUserId, peerId.slice(6));
    }
    if (peerId.startsWith('app-')) {
      return this.resolveAppIdentity(callerUserId, peerId.slice(4));
    }

    if (callerUserId === peerId) return null;

    // Both ends must be *active* members of a shared workspace — a suspended
    // member keeps their row but must not be able to resolve peers or mint
    // room links (audit S5).
    const shared = await this.prisma.workspaceMember.findFirst({
      where: {
        userId: peerId,
        status: 'ACTIVE',
        workspace: {
          members: { some: { userId: callerUserId, status: 'ACTIVE' } },
        },
      },
      select: { id: true },
    });
    if (!shared) return null;

    return this.ensureIdentity(peerId);
  }

  /**
   * The Matrix identity of an AI agent in one of the caller's workspaces.
   *
   * Keyed by the agent's own row id rather than anything derived (like its
   * name), which is what keeps two agents from ever colliding on one bot
   * identity — the same reason a human's Matrix id is derived from their user
   * id and not their display name.
   */
  private async resolveAgentIdentity(
    callerUserId: string,
    agentId: string,
  ): Promise<string | null> {
    const agent = await this.prisma.aIAgent.findFirst({
      where: {
        id: agentId,
        isActive: true,
        workspace: {
          members: { some: { userId: callerUserId, status: 'ACTIVE' } },
        },
      },
      select: { id: true, name: true, matrixUserId: true },
    });
    if (!agent) return null;
    if (agent.matrixUserId) return agent.matrixUserId;

    const { matrixUserId } = await this.admin.provisionUser({
      userId: `agent-${agent.id}`,
      displayName: agent.name,
    });

    await this.prisma.aIAgent.update({
      where: { id: agent.id },
      data: { matrixUserId },
    });

    this.logger.log(`Provisioned Matrix identity for agent ${agent.id}`);
    return matrixUserId;
  }

  /**
   * The Matrix identity of a connected app in one of the caller's workspaces.
   *
   * Keyed by the `ExternalIntegration` row id — not by provider name — so two
   * workspaces that both connect the same provider (two Gmail accounts, say)
   * never collide on the same bot identity and end up sharing a room across
   * tenants.
   */
  private async resolveAppIdentity(
    callerUserId: string,
    integrationId: string,
  ): Promise<string | null> {
    const integration = await this.prisma.externalIntegration.findFirst({
      where: {
        id: integrationId,
        status: 'CONNECTED',
        OR: [
          { userId: callerUserId },
          {
            workspace: {
              members: { some: { userId: callerUserId, status: 'ACTIVE' } },
            },
          },
        ],
      },
      select: {
        id: true,
        provider: true,
        displayName: true,
        matrixUserId: true,
      },
    });
    if (!integration) return null;
    if (integration.matrixUserId) return integration.matrixUserId;

    const { matrixUserId } = await this.admin.provisionUser({
      userId: `app-${integration.id}`,
      displayName: integration.displayName ?? integration.provider,
    });

    await this.prisma.externalIntegration.update({
      where: { id: integration.id },
      data: { matrixUserId },
    });

    this.logger.log(`Provisioned Matrix identity for app ${integration.id}`);
    return matrixUserId;
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
