import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvent, type ChatMessageMissedEvent } from '@org/api-common';
import { PrismaService } from '@org/database';
import { MatrixAdminService } from './matrix-admin.service.js';

const POLL_INTERVAL_MS = 5_000;
/** Bounds the load one tick puts on the homeserver. */
const MAX_CONCURRENT_SYNCS = 5;
const MAX_TRACKED_ROOMS = 5_000;
/**
 * A live client refreshes `lastSeenAt` every minute. `presence` alone is not
 * enough: a crash, restart or sign-in can leave it "online" with nobody there,
 * and that person would silently get no push until the ghost sweep ran.
 */
const LIVE_SEEN_WINDOW_MS = 150_000;

type SyncResult = Awaited<ReturnType<MatrixAdminService['syncAs']>>;
type SyncedEvent = SyncResult['events'][number];

/** Rooms the user muted: `setRoomMuted` writes an override rule named after the room. */
export function mutedRoomIds(
  pushRules: Record<string, unknown> | undefined,
): Set<string> {
  const global = pushRules?.['global'] as
    | { override?: Array<{ rule_id?: string; enabled?: boolean }> }
    | undefined;
  return new Set(
    (global?.override ?? [])
      .filter((rule) => rule.rule_id?.startsWith('!') && rule.enabled !== false)
      .map((rule) => rule.rule_id as string),
  );
}

export function hasLiveClient(
  user: { presence: string; lastSeenAt: Date | null },
  now = Date.now(),
): boolean {
  return (
    user.presence !== 'OFFLINE' &&
    !!user.lastSeenAt &&
    now - user.lastSeenAt.getTime() < LIVE_SEEN_WINDOW_MS
  );
}

/** Edits, redactions and system rows are not something anyone sent you. */
export function isNotifiable(event: SyncedEvent & { unsigned?: unknown }): boolean {
  const { content } = event;
  if ((event.unsigned as { redacted_because?: unknown })?.redacted_because) {
    return false;
  }
  if (event.type === 'm.room.encrypted') return true;
  if (typeof content['body'] !== 'string') return false;

  const relation = content['m.relates_to'] as { rel_type?: string } | undefined;
  if (relation?.rel_type === 'm.replace') return false;

  const structured = (content['mie_event'] ?? content['structuredEvent']) as
    | { type?: string }
    | undefined;
  return (
    structured?.type !== 'mie.system_event' &&
    content['msgtype'] !== 'mie.system_event'
  );
}

export function mentions(content: Record<string, unknown>, userId: string): boolean {
  const named = content['m.mentions'] as
    | { user_ids?: string[]; room?: boolean }
    | undefined;
  return !!named?.room || !!named?.user_ids?.includes(userId);
}

/**
 * Chat for people with no client open.
 *
 * A client notifies its own user, so when every client is closed nothing would
 * reach their phone, and the homeserver may have no route to this API at all
 * (the local Synapse does not). So this watches the accounts that have a phone
 * registered, with the same `syncAs` the bots use, and hands each message to the
 * notification centre as an event. It keeps every cursor moving but only acts
 * while the user is offline: an open client knows what they are looking at, and
 * this cannot. Reports overlap around that switch, which the centre dedupes.
 *
 * Runs from the moment it boots: a message sent while the API is down is missed.
 */
@Injectable()
export class MatrixOfflineChatIntakeService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MatrixOfflineChatIntakeService.name);
  private readonly cursors = new Map<string, string>();
  private readonly muted = new Map<string, Set<string>>();
  private readonly groupRooms = new Map<string, boolean>();
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: MatrixAdminService,
    private readonly events: EventEmitter2,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (this.config.get<string>('PUSH_DELIVERY_DISABLED') === 'true') return;
    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const users = await this.prisma.user.findMany({
        where: {
          matrixUserId: { not: null },
          pushRegistrations: {
            some: { revokedAt: null, pushKey: { startsWith: 'Expo' } },
          },
        },
        select: {
          id: true,
          matrixUserId: true,
          presence: true,
          lastSeenAt: true,
        },
      });

      for (let i = 0; i < users.length; i += MAX_CONCURRENT_SYNCS) {
        await Promise.all(
          users.slice(i, i + MAX_CONCURRENT_SYNCS).map((user) =>
            this.pollUser(
              user.id,
              user.matrixUserId as string,
              !hasLiveClient(user),
            ),
          ),
        );
      }
    } catch (error) {
      this.logger.warn(`Offline chat poll failed: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }

  private async pollUser(
    userId: string,
    matrixUserId: string,
    offline: boolean,
  ): Promise<void> {
    try {
      const since = this.cursors.get(matrixUserId);
      const result = await this.admin.syncAs(matrixUserId, since, {
        person: true,
      });
      this.cursors.set(matrixUserId, result.nextBatch);
      if (result.pushRules) {
        this.muted.set(matrixUserId, mutedRoomIds(result.pushRules));
      }
      if (!since || !offline) return;

      const muted = this.muted.get(matrixUserId);
      for (const event of result.events) {
        if (event.sender === matrixUserId) continue;
        if (muted?.has(event.room_id) || !isNotifiable(event)) continue;

        const missed: ChatMessageMissedEvent = {
          recipientId: userId,
          roomId: event.room_id,
          eventId: event.event_id,
          senderMatrixId: event.sender,
          content: event.content,
          isEncrypted: event.type === 'm.room.encrypted',
          isMention: mentions(event.content, matrixUserId),
          isGroup: await this.isGroup(event.room_id),
        };
        this.events.emit(AppEvent.ChatMessageMissed, missed);
      }
    } catch (error) {
      this.logger.warn(
        `Offline chat poll for ${matrixUserId} failed: ${String(error)}`,
      );
    }
  }

  private async isGroup(roomId: string): Promise<boolean> {
    const known = this.groupRooms.get(roomId);
    if (known !== undefined) return known;

    const members = await this.admin.getRoomMembers(roomId).catch(() => []);
    const group = members.length > 2;
    if (this.groupRooms.size >= MAX_TRACKED_ROOMS) this.groupRooms.clear();
    this.groupRooms.set(roomId, group);
    return group;
  }
}
