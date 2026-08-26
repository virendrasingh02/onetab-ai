import { Injectable, Logger } from '@nestjs/common';
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
   * Auto-joins a bot identity (agent, app) the moment it is invited.
   *
   * A human joins their DM from their own browser session; a bot has none, so
   * nothing would ever accept its invite otherwise — and Matrix requires a
   * *joined* member to send events at all, while `getOrCreateDirectMessage`
   * only recognises a room as already existing once both sides have joined
   * it, so a bot stuck on `invite` would get a fresh duplicate room on every
   * visit. Membership for everyone else stays owned by our database, same as
   * the sibling events this handler ignores.
   */
  private async handleMembership(event: MatrixTimelineEvent): Promise<void> {
    if (event.content['membership'] !== 'invite') return;

    const invitee = event.state_key;
    if (!invitee || !MatrixSyncService.BOT_INVITE_PATTERN.test(invitee)) {
      return;
    }

    try {
      await this.admin.joinRoomAs(invitee, event.room_id);
    } catch (error) {
      this.logger.error(
        `Failed to auto-join bot ${invitee} into ${event.room_id}: ${String(error)}`,
      );
    }
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
      select: { id: true, workspaceId: true },
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

    const matched = new Set<string>();
    const haystack = body.toLowerCase();

    for (const { user } of members) {
      if (user.matrixUserId && matrixUserIds.includes(user.matrixUserId)) {
        matched.add(user.id);
        continue;
      }

      for (const name of [user.displayName, user.name]) {
        if (!name) continue;
        if (haystack.includes(`@${name.toLowerCase()}`)) {
          matched.add(user.id);
          break;
        }
      }
    }

    return [...matched];
  }
}
