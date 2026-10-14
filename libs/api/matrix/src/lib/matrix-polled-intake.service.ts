import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
import { MatrixAdminService } from './matrix-admin.service.js';
import { MatrixSyncService } from './matrix-sync.service.js';

const POLL_INTERVAL_MS = 2_000;
/** A bot that joins a room late gets that room's recent history in its first
 *  sync; anything older than this is not a message to answer. */
const MAX_EVENT_AGE_MS = 2 * 60_000;
const SEEN_LIMIT = 5_000;

/**
 * Inbound events for deployments without an appservice registration.
 *
 * With an appservice, Synapse pushes every event touching a bot to
 * `/matrix/transactions` and `MatrixSyncService` routes it (agent replies,
 * bot auto-join). With admin credentials only (the dev setup) nothing is ever
 * pushed, so agents and coworkers never saw a message and never answered.
 * This pulls the same events with a `/sync` per bot identity and feeds them
 * through the very same `MatrixSyncService.handleTransaction` path — so there
 * is exactly one place that decides what an event means.
 */
@Injectable()
export class MatrixPolledIntakeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatrixPolledIntakeService.name);
  private readonly cursors = new Map<string, string>();
  private readonly seen = new Set<string>();
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private txn = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: MatrixAdminService,
    private readonly sync: MatrixSyncService,
  ) {}

  onModuleInit(): void {
    if (!this.admin.needsPolledIntake) return;
    this.logger.log(
      'No Matrix appservice configured: polling bot identities for inbound messages.',
    );
    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const bots = await this.prisma.aIAgent.findMany({
        where: { isActive: true, matrixUserId: { not: null } },
        select: { matrixUserId: true },
      });
      await Promise.all(
        bots.map((bot) => this.pollBot(bot.matrixUserId as string)),
      );
    } catch (error) {
      this.logger.warn(`Matrix intake poll failed: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }

  private async pollBot(botId: string): Promise<void> {
    try {
      const since = this.cursors.get(botId);
      const result = await this.admin.syncAs(botId, since);
      this.cursors.set(botId, result.nextBatch);

      // Nothing accepts a bot's invite for it, and its DM only counts as a
      // 1:1 once it has joined.
      for (const roomId of result.invitedRoomIds) {
        await this.admin.joinRoomAs(botId, roomId).catch((error) => {
          this.logger.error(
            `Failed to auto-join ${botId} into ${roomId}: ${String(error)}`,
          );
        });
      }

      if (!since) return;
      const cutoff = Date.now() - MAX_EVENT_AGE_MS;
      // Several bots in one room all see the same event; handle it once.
      const fresh = result.events.filter((event) => {
        if (event.sender === botId) return false;
        if (event.origin_server_ts < cutoff) return false;
        if (this.seen.has(event.event_id)) return false;
        this.seen.add(event.event_id);
        return true;
      });
      if (this.seen.size > SEEN_LIMIT) {
        for (const id of [...this.seen].slice(0, SEEN_LIMIT / 2)) {
          this.seen.delete(id);
        }
      }
      if (fresh.length > 0) {
        await this.sync.handleTransaction(`poll-${botId}-${this.txn++}`, {
          events: fresh,
        });
      }
    } catch (error) {
      this.logger.warn(`Matrix intake poll for ${botId} failed: ${String(error)}`);
    }
  }
}
