import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';

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

  constructor(private readonly prisma: PrismaService) {}

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
        await this.recordActivity(event);
        break;
      case 'm.room.redaction':
      case 'm.room.member':
      case 'm.room.encryption':
        // Membership and moderation are owned by our database; these events
        // are informational for the bridge and need no write.
        break;
      default:
        break;
    }
  }

  /**
   * Records that a channel saw activity.
   *
   * Deliberately stores no message content — Matrix owns the messages. Only
   * the pointer needed for our own "recent activity" surfaces is persisted.
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

    await this.prisma.recentActivity.create({
      data: {
        workspaceId: channel.workspaceId,
        channelId: channel.id,
        userId: user?.id,
        kind: 'MESSAGE',
        matrixEventId: event.event_id,
        occurredAt: new Date(event.origin_server_ts),
      },
    });
  }
}
