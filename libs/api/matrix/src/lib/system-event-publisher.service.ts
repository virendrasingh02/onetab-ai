import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';
import {
  formatSystemEventFallbackText,
  getSystemEventCapabilities,
  type SystemEventConversationType,
  type SystemEventEntity,
  type SystemEventType,
} from '@org/types';
import { MatrixAdminService } from './matrix-admin.service.js';
import { MatrixBotMessagingService } from './matrix-bot-messaging.service.js';

/** The fixed local part every deployment's system-activity bot registers as.
 * Unlike an agent/app bot (keyed by row id), there is exactly one of these —
 * it never represents a person, so it never needs its own identity per row. */
const SYSTEM_BOT_USER_ID = 'system-events';
const SYSTEM_BOT_DISPLAY_NAME = 'OneTab AI';

/** How long a given idempotency key suppresses a repeat post for (brief §30).
 * Long enough to absorb a retried HTTP request or a duplicate event emission
 * from a double-invoked listener; short enough that a genuinely repeated
 * action (leave, then rejoin minutes later) still posts twice. */
const DEDUPE_WINDOW_MS = 30_000;

export interface PublishSystemEventInput {
  eventType: SystemEventType;
  conversationType: SystemEventConversationType;
  /**
   * The Matrix room to post into — already resolved by the caller (a
   * channel's `matrixRoomId`, an app/agent's own DM `matrixRoomId`, …), since
   * different `conversationType`s resolve a room from different tables and
   * this service has no business knowing which.
   */
  roomId: string;
  /** Our own row id for whatever `conversationType` names — a channel id, an
   * `ExternalIntegration`/`AIAgent` id for its 1:1 room. Carried in the
   * content for deep-linking; never used to resolve the room itself. */
  conversationId: string;
  /** Null for a personal (not workspace-scoped) app's own DM room. */
  workspaceId: string | null;
  conversationName?: string;
  actor: SystemEventEntity | null;
  target: SystemEventEntity | null;
  secondaryTarget?: SystemEventEntity | null;
  metadata?: Record<string, unknown>;
  /** Caller-supplied dedupe key — see `DEDUPE_WINDOW_MS`. Should encode the
   * domain fact, e.g. `channel-member:<channelId>:<userId>:add`. */
  idempotencyKey: string;
  /** Matrix user ids to highlight, so the people it's actually about get a
   * personal notification without pinging the whole room (brief §24). */
  mentionMatrixUserIds?: string[];
}

/**
 * Turns a resolved domain fact into exactly one Matrix timeline post.
 *
 * This is the single place the unified System/Activity Event architecture
 * (brief §1) touches Matrix. There is no separate `SystemEvent` table — the
 * event *is* the Matrix message, which is why persistence, ordering,
 * pagination and realtime delivery all come for free from the existing
 * bridge rather than needing new infrastructure (brief §15–17, §32).
 */
@Injectable()
export class SystemEventPublisherService {
  private readonly logger = new Logger(SystemEventPublisherService.name);
  private systemBotMatrixId: string | null = null;
  private systemBotProvisionPromise: Promise<string | null> | null = null;
  private readonly recentlyPosted = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: MatrixAdminService,
    private readonly messaging: MatrixBotMessagingService,
  ) {}

  // --- entity resolution (brief §19–20: IDs are truth, names are a snapshot) -

  async resolveUser(userId: string | null): Promise<SystemEventEntity | null> {
    if (!userId) return null;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, displayName: true, avatarUrl: true },
    });
    if (!user) {
      return { kind: 'user', id: userId, name: 'Deleted user', isDeleted: true };
    }
    return {
      kind: 'user',
      id: user.id,
      name: user.displayName || user.name,
      avatarUrl: user.avatarUrl ?? undefined,
    };
  }

  async resolveAiEntity(
    entityId: string,
    entityType: 'agent' | 'coworker',
  ): Promise<SystemEventEntity> {
    const entity = await this.prisma.aIAgent.findUnique({
      where: { id: entityId },
      select: { id: true, name: true, avatarUrl: true, isActive: true },
    });
    if (!entity) {
      return {
        kind: entityType,
        id: entityId,
        name: entityType === 'coworker' ? 'Deleted AI Coworker' : 'Deleted AI Agent',
        isDeleted: true,
      };
    }
    return {
      kind: entityType,
      id: entity.id,
      name: entity.name,
      avatarUrl: entity.avatarUrl ?? undefined,
      isDeleted: !entity.isActive,
    };
  }

  async resolveApp(integrationId: string): Promise<SystemEventEntity> {
    const integration = await this.prisma.externalIntegration.findUnique({
      where: { id: integrationId },
      select: { id: true, displayName: true, provider: true, status: true },
    });
    if (!integration) {
      return { kind: 'app', id: integrationId, name: 'Deleted app', isDeleted: true };
    }
    return {
      kind: 'app',
      id: integration.id,
      name: integration.displayName || integration.provider,
      provider: integration.provider,
      isDeleted: integration.status === 'DISCONNECTED',
    };
  }

  /**
   * A channel's Matrix room, name and workspace in one query — every channel
   * listener branch needs exactly this before it can call {@link publish}.
   * Null when the channel is gone or has no room yet (nothing lazily
   * provisioned it) — callers treat that as "nothing to post into".
   */
  async resolveChannelRoom(
    channelId: string,
  ): Promise<{ roomId: string; name: string; workspaceId: string } | null> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { matrixRoomId: true, name: true, workspaceId: true },
    });
    if (!channel?.matrixRoomId) return null;
    return { roomId: channel.matrixRoomId, name: channel.name, workspaceId: channel.workspaceId };
  }

  /**
   * A connected app's own 1:1 room (`ExternalIntegration.matrixRoomId`),
   * provisioned lazily the first time a human opens a DM with it. Null when
   * nobody has opened that DM yet — there is nothing to post a
   * connect/disconnect event into, which is an acceptable gap (brief §4):
   * the fact is still in `IntegrationAuditLog`, just not in a chat timeline.
   */
  async resolveAppRoom(
    integrationId: string,
  ): Promise<{ roomId: string; workspaceId: string | null } | null> {
    const integration = await this.prisma.externalIntegration.findUnique({
      where: { id: integrationId },
      select: { matrixRoomId: true, workspaceId: true },
    });
    if (!integration?.matrixRoomId) return null;
    return { roomId: integration.matrixRoomId, workspaceId: integration.workspaceId };
  }

  /** A user's own Matrix id, for `mentionMatrixUserIds` — null if never
   * bridged (they've never opened chat) or the user no longer exists. */
  async resolveUserMatrixId(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { matrixUserId: true },
    });
    return user?.matrixUserId ?? null;
  }

  // --- bot identity ----------------------------------------------------------

  /** Lazily provisions (once per process) and returns the system bot's Matrix
   * user id, or null when Matrix isn't configured — every call site treats
   * that as "nothing to post", never as an error, matching how the rest of
   * this bridge degrades when disabled. */
  private async ensureSystemBot(): Promise<string | null> {
    if (!this.admin.isEnabled) return null;
    if (this.systemBotMatrixId) return this.systemBotMatrixId;

    // Concurrent callers share one in-flight provision rather than each
    // firing their own upsert at the homeserver.
    if (!this.systemBotProvisionPromise) {
      this.systemBotProvisionPromise = this.admin
        .provisionUser({ userId: SYSTEM_BOT_USER_ID, displayName: SYSTEM_BOT_DISPLAY_NAME })
        .then(({ matrixUserId }) => {
          this.systemBotMatrixId = matrixUserId;
          return matrixUserId;
        })
        .catch((error) => {
          this.logger.warn(`Failed to provision the system-events bot: ${String(error)}`);
          return null;
        })
        .finally(() => {
          this.systemBotProvisionPromise = null;
        });
    }
    return this.systemBotProvisionPromise;
  }

  // --- publishing --------------------------------------------------------------

  /**
   * Posts one system/activity event into a channel's room. No-ops (logged at
   * debug) when: Matrix is disabled, the channel has no room yet (nothing has
   * lazily provisioned one), or the same `idempotencyKey` posted within the
   * dedupe window — never throws, since a failed mirror must never fail the
   * HTTP request whose success it's reporting.
   */
  async publish(input: PublishSystemEventInput): Promise<void> {
    if (this.isDuplicate(input.idempotencyKey)) {
      this.logger.debug(`Suppressed duplicate system event: ${input.idempotencyKey}`);
      return;
    }

    try {
      const systemBotId = await this.ensureSystemBot();
      if (!systemBotId) return;

      try {
        await this.admin.joinRoomAs(systemBotId, input.roomId);
      } catch {
        // Already joined — expected on every post after the first.
      }

      const capabilities = getSystemEventCapabilities(input.eventType);
      const content = {
        type: 'mie.system_event' as const,
        version: 'v1',
        eventType: input.eventType,
        conversationType: input.conversationType,
        conversationId: input.conversationId,
        conversationName: input.conversationName,
        workspaceId: input.workspaceId ?? undefined,
        actor: input.actor,
        target: input.target,
        secondaryTarget: input.secondaryTarget ?? undefined,
        metadata: input.metadata,
        occurredAt: Date.now(),
        idempotencyKey: input.idempotencyKey,
        capabilities,
      };

      await this.messaging.sendStructured(input.roomId, systemBotId, content, {
        fallbackBody: formatSystemEventFallbackText(content),
        mentionUserIds: input.mentionMatrixUserIds,
      });

      this.markPosted(input.idempotencyKey);
    } catch (error) {
      this.logger.warn(
        `Failed to publish system event "${input.eventType}" for room ${input.roomId}: ${String(error)}`,
      );
    }
  }

  private isDuplicate(key: string): boolean {
    this.pruneExpired();
    const postedAt = this.recentlyPosted.get(key);
    return postedAt !== undefined && Date.now() - postedAt < DEDUPE_WINDOW_MS;
  }

  private markPosted(key: string): void {
    this.recentlyPosted.set(key, Date.now());
  }

  private pruneExpired(): void {
    const cutoff = Date.now() - DEDUPE_WINDOW_MS;
    for (const [key, postedAt] of this.recentlyPosted) {
      if (postedAt < cutoff) this.recentlyPosted.delete(key);
    }
  }
}
