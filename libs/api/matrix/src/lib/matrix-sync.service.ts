import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvent, resolveTextMentions } from '@org/api-common';
import { PrismaService } from '@org/database';
import { MatrixAdminService } from './matrix-admin.service.js';
import { MatrixInboundRouterService } from './matrix-inbound-router.service.js';

/**
 * One transaction from the homeserver's application-service push.
 *
 * Synapse pushes events to us rather than us polling `/sync`: a bridge that
 * polls needs a long-lived client per server, whereas a push endpoint scales
 * with the API and survives restarts without replaying history.
 */
export interface AppserviceTransaction {
  events: MatrixTimelineEvent[];
}

export interface MatrixTimelineEvent {
  type: string;
  room_id: string;
  event_id: string;
  sender: string;
  origin_server_ts: number;
  content: Record<string, unknown>;
  state_key?: string;
  unsigned?: { redacted_because?: unknown };
}

@Injectable()
export class MatrixSyncService {
  private readonly logger = new Logger(MatrixSyncService.name);
  /** Transaction ids already applied, for idempotency. */
  private readonly processedTransactions = new Set<string>();
  /** Matches the Matrix user id of a bot identity we provisioned (agent/app),
   *  regardless of which side of `agent-`/`app-` it is or what the localpart
   *  suffix is — see `toMatrixLocalpart`/`MatrixAuthService.resolveAgentIdentity`. */
  private static readonly BOT_INVITE_PATTERN = /^@onetab_(agent|app)-/;

  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: MatrixAdminService,
    private readonly router: MatrixInboundRouterService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Applies a transaction.
   *
   * The homeserver retries a transaction until it receives a 200, so this must
   * be idempotent: the same `txnId` arriving twice must not double-count
   * activity.
   */
  async handleTransaction(
    txnId: string,
    transaction: AppserviceTransaction,
  ): Promise<void> {
    if (this.processedTransactions.has(txnId)) {
      this.logger.debug(`Skipping duplicate transaction ${txnId}`);
      return;
    }

    for (const event of transaction.events) {
      try {
        await this.handleEvent(event);
      } catch (error) {
        // One malformed event must not cause the whole transaction to be
        // retried forever; log and continue.
        this.logger.error(
          `Failed to handle ${event.type} ${event.event_id}: ${String(error)}`,
        );
      }
    }

    this.processedTransactions.add(txnId);
    // Bounded memory: the homeserver only ever retries the newest transaction.
    if (this.processedTransactions.size > 1000) {
      const oldest = this.processedTransactions.values().next().value;
      if (oldest) this.processedTransactions.delete(oldest);
    }
  }

  private async handleEvent(event: MatrixTimelineEvent): Promise<void> {
    switch (event.type) {
      case 'm.room.message':
        // Channel activity bookkeeping and agent/app inbound routing are
        // independent: a message either lands in a `Channel` room (recorded
        // here) or an agent/app DM room (claimed by a registered handler,
        // e.g. `AgentMatrixBridgeService`) — never both, but neither knows
        // about the other, so both always get a look.
        await this.recordActivity(event);
        await this.router.dispatch(event);
        break;
      case 'm.room.member':
        await this.handleMembership(event);
        break;
      case 'm.room.redaction':
      case 'm.room.encryption':
        // Moderation is owned by our database; these events are informational
        // for the bridge and need no write.
        break;
      default:
        break;
    }
  }

  /**
   * Handles an inbound `m.room.member` event.
   *
   * Two jobs:
   *
   * 1. **Bot auto-join.** A human joins their DM from their own browser
   *    session; a bot (agent, app) has none, so nothing would ever accept its
   *    invite otherwise — and Matrix requires a *joined* member to send events
   *    at all, while `getOrCreateDirectMessage` only recognises a room as
   *    existing once both sides have joined, so a bot stuck on `invite` would
   *    get a fresh duplicate room on every visit.
   *
   * 2. **Human membership convergence.** A join / leave / kick / ban performed
   *    on the Matrix side (Synapse admin, a fallback Element client) for a room
   *    we recognise — a channel room or a workspace space room — is mirrored
   *    back into `ChannelMember` / `WorkspaceMember`. Our database stays
   *    authoritative for roles and permissions; only the fact of membership
   *    crosses back. DMs and group rooms are untouched — their membership is
   *    already Matrix-native.
   */
  private async handleMembership(event: MatrixTimelineEvent): Promise<void> {
    const membership = event.content['membership'];
    const subject = event.state_key;
    if (!subject) return;

    if (
      membership === 'invite' &&
      MatrixSyncService.BOT_INVITE_PATTERN.test(subject)
    ) {
      try {
        await this.admin.joinRoomAs(subject, event.room_id);
      } catch (error) {
        this.logger.error(
          `Failed to auto-join bot ${subject} into ${event.room_id}: ${String(error)}`,
        );
      }
      return;
    }

    // `invite` for a human is not yet membership, so it is ignored. Our own
    // outbound mirror also emits these events; the upserts / deletes below are
    // idempotent, so the echo is a harmless no-op and needs no dedupe.
    if (membership !== 'join' && membership !== 'leave' && membership !== 'ban') {
      return;
    }

    await this.ingestHumanMembership(
      event.room_id,
      subject,
      membership as 'join' | 'leave' | 'ban',
    );
  }

  /**
   * Converges one Matrix-side human membership transition into our tables.
   *
   * - **Channel room:** `join` upserts a `ChannelMember` (role MEMBER); a
   *   `leave` / `ban` deletes it.
   * - **Space room:** `join` only lifts a prior SUSPENDED back to ACTIVE — a
   *   workspace membership is never *created* from a Matrix join, because that
   *   must go through an invitation (plan limits, role). `leave` / `ban`
   *   SUSPENDs the member (reversible; a delete would cascade ~45 relations),
   *   and never the workspace owner.
   * - Any other room (DM, group, untracked): ignored.
   */
  private async ingestHumanMembership(
    roomId: string,
    matrixUserId: string,
    membership: 'join' | 'leave' | 'ban',
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { matrixUserId },
      select: { id: true },
    });
    if (!user) return;

    const channel = await this.prisma.channel.findFirst({
      where: { matrixRoomId: roomId },
      select: { id: true },
    });
    if (channel) {
      if (membership === 'join') {
        await this.prisma.channelMember.upsert({
          where: {
            channelId_userId: { channelId: channel.id, userId: user.id },
          },
          create: { channelId: channel.id, userId: user.id, role: 'MEMBER' },
          update: {},
        });
      } else {
        await this.prisma.channelMember.deleteMany({
          where: { channelId: channel.id, userId: user.id },
        });
      }
      return;
    }

    const workspace = await this.prisma.workspace.findFirst({
      where: { matrixSpaceId: roomId },
      select: { id: true, ownerId: true },
    });
    if (!workspace) return;

    if (membership === 'join') {
      await this.prisma.workspaceMember.updateMany({
        where: {
          workspaceId: workspace.id,
          userId: user.id,
          status: 'SUSPENDED',
        },
        data: { status: 'ACTIVE' },
      });
      return;
    }

    if (user.id === workspace.ownerId) return;
    await this.prisma.workspaceMember.updateMany({
      where: { workspaceId: workspace.id, userId: user.id, status: 'ACTIVE' },
      data: { status: 'SUSPENDED' },
    });
  }

  /**
   * Records that a channel saw activity.
   *
   * Deliberately stores no message content — Matrix owns the messages. Only
   * the pointer needed for our own "recent activity" surfaces is persisted,
   * plus the ids of anyone the message named so the sidebar can tell a mention
   * apart from ordinary traffic.
   */
  private async recordActivity(event: MatrixTimelineEvent): Promise<void> {
    const channel = await this.prisma.channel.findFirst({
      where: { matrixRoomId: event.room_id },
      select: { id: true, workspaceId: true, name: true, slug: true },
    });
    if (!channel) return;

    const user = await this.prisma.user.findFirst({
      where: { matrixUserId: event.sender },
      select: { id: true },
    });

    const mentionedUserIds = await this.resolveMentions(
      event,
      channel.workspaceId,
    );

    await this.prisma.recentActivity.create({
      data: {
        workspaceId: channel.workspaceId,
        channelId: channel.id,
        userId: user?.id,
        kind: 'MESSAGE',
        matrixEventId: event.event_id,
        mentionedUserIds,
        occurredAt: new Date(event.origin_server_ts),
      },
    });

    // A named person gets a bell-menu notification, not just a sidebar dot.
    // The activity row above already carries the ids for the dot; this adds the
    // per-recipient, read-tracked row. Still no message content leaves Matrix.
    const targets = mentionedUserIds.filter((id) => id !== user?.id);
    if (targets.length > 0) {
      this.events.emit(AppEvent.MentionCreated, {
        workspaceId: channel.workspaceId,
        actorId: user?.id ?? null,
        mentionedUserIds: targets,
        contextType: 'channel',
        contextId: channel.id,
        contextLabel: `#${channel.slug || channel.name}`,
        deepLink: `c/${channel.slug}`,
      });
    }
  }

  /**
   * The workspace members a message named.
   *
   * Two sources, because our composer and other Matrix clients disagree:
   * `m.mentions.user_ids` is the spec'd intentional-mentions field and is
   * authoritative when present, while our own composer sends plain `@Display
   * Name` text. Names are matched against workspace members only, so an
   * `@someone` from another workspace cannot light up a dot here.
   *
   * The body is read but never stored — this returns ids, nothing else.
   */
  private async resolveMentions(
    event: MatrixTimelineEvent,
    workspaceId: string,
  ): Promise<string[]> {
    const mentions = event.content['m.mentions'] as
      | { user_ids?: unknown }
      | undefined;
    const matrixUserIds = Array.isArray(mentions?.user_ids)
      ? mentions.user_ids.filter((id): id is string => typeof id === 'string')
      : [];

    const body = typeof event.content['body'] === 'string' ? event.content['body'] : '';
    // Cheap gate: no `@` and no explicit mention block means nothing to resolve,
    // which is the common case and must not cost a query.
    if (!matrixUserIds.length && !body.includes('@')) return [];

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: {
        user: {
          select: {
            id: true,
            name: true,
            displayName: true,
            matrixUserId: true,
          },
        },
      },
    });
    const users = members.map((m) => m.user);

    // Plain `@Display Name` text — the same matcher task-comment mentions use.
    const matched = new Set<string>(resolveTextMentions(body, users));

    // Plus `m.mentions.user_ids`, the spec'd intentional-mentions field, which
    // is authoritative when a Matrix client sends it.
    for (const user of users) {
      if (user.matrixUserId && matrixUserIds.includes(user.matrixUserId)) {
        matched.add(user.id);
      }
    }

    return [...matched];
  }
}
