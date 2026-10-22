import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@org/api-cache';
import { PrismaService } from '@org/database';
import type { UserPresence } from '@org/types';
import { Subject } from 'rxjs';
import { generateId } from '@org/utils';
import {
  PendingDeliveryService,
  type DeliveryStatus,
  type PendingDelivery,
} from './pending-delivery.service.js';

export interface SseMessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}

/**
 * The socket under one SSE connection, so the gateway can see a client that
 * is not draining its stream and cut it loose before its write buffer eats
 * the node's memory.
 */
export interface ClientTransport {
  bufferedBytes(): number;
  close(): void;
}

interface ConnectedClient {
  clientId: string;
  userId: string;
  workspaceId: string | null;
  subject: Subject<SseMessageEvent>;
  connectedAt: Date;
  transport?: ClientTransport;
}

type UserEvent = {
  id?: string;
  type: string;
  payload: unknown;
  workspaceId?: string | null;
  /** Set on reliable (deliver-then-delete) events; the client must ack. */
  requiresAck?: boolean;
};

interface RedisWorkspaceBroadcastPayload {
  nodeId: string;
  workspaceId: string;
  event: { id?: string; type: string; payload: unknown; actorId?: string | null };
  excludeClientId?: string;
}

interface RedisUserBroadcastPayload {
  nodeId: string;
  userId: string;
  event: UserEvent;
}

export interface RealtimeLimits {
  /** Live SSE connections this node accepts before answering 503. */
  maxConnections: number;
  /** Per user; the oldest of a user's connections is dropped beyond this. */
  maxConnectionsPerUser: number;
  /** Unflushed bytes on a socket before the client counts as stalled. */
  maxBufferedBytes: number;
  /** How often pending deliveries of locally connected users are retried. */
  deliverySweepMs: number;
  /** Users processed concurrently per sweep chunk. */
  deliverySweepConcurrency: number;
}

export const DEFAULT_REALTIME_LIMITS: RealtimeLimits = {
  maxConnections: 20_000,
  maxConnectionsPerUser: 12,
  maxBufferedBytes: 2 * 1024 * 1024,
  deliverySweepMs: 5_000,
  deliverySweepConcurrency: 50,
};

function readLimit(
  config: ConfigService | undefined,
  key: string,
  fallback: number,
): number {
  const raw = config?.get<string | number>(key) ?? process.env[key];
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

@Injectable()
export class RealtimeGatewayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeGatewayService.name);
  private readonly nodeId = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

  // clientId -> ConnectedClient
  private readonly clients = new Map<string, ConnectedClient>();

  // userId -> Set<clientId>
  private readonly userClientMap = new Map<string, Set<string>>();

  // workspaceId -> Set<clientId>
  private readonly workspaceClientMap = new Map<string, Set<string>>();

  /**
   * A short, in-memory replay buffer of the events most recently broadcast to
   * each workspace, so a client that reconnects after a blip can ask for
   * "everything since <lastEventId>" and not silently miss updates. Populated on
   * every node (local originator *and* Redis fan-out), bounded per workspace and
   * by age. Best-effort — a cold node or an old cursor just means the client
   * falls back to its incremental catch-up fetch.
   */
  private readonly recentEvents = new Map<
    string,
    Array<{ id: string; at: number; data: string }>
  >();
  private static readonly REPLAY_MAX_PER_WORKSPACE = 300;
  private static readonly REPLAY_MAX_AGE_MS = 5 * 60_000;

  private keepAliveTimer: NodeJS.Timeout | null = null;
  private deliverySweepTimer: NodeJS.Timeout | null = null;
  private sweepInFlight = false;

  /**
   * Locally connected users that still have unacked reliable deliveries, so
   * the retry sweep only touches them instead of every connected user.
   */
  private readonly usersWithPending = new Set<string>();

  readonly limits: RealtimeLimits;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @Optional() private readonly deliveries?: PendingDeliveryService,
    @Optional() config?: ConfigService,
  ) {
    const d = DEFAULT_REALTIME_LIMITS;
    this.limits = {
      maxConnections: readLimit(config, 'REALTIME_MAX_CONNECTIONS', d.maxConnections),
      maxConnectionsPerUser: readLimit(
        config,
        'REALTIME_MAX_CONNECTIONS_PER_USER',
        d.maxConnectionsPerUser,
      ),
      maxBufferedBytes: readLimit(
        config,
        'REALTIME_MAX_BUFFERED_BYTES',
        d.maxBufferedBytes,
      ),
      deliverySweepMs: readLimit(
        config,
        'REALTIME_DELIVERY_SWEEP_MS',
        d.deliverySweepMs,
      ),
      deliverySweepConcurrency: d.deliverySweepConcurrency,
    };
  }

  async onModuleInit(): Promise<void> {
    // 1. Subscribe to Redis cluster channels for cross-instance broadcasts
    await this.cache.subscribe('realtime:workspace', (msg) => {
      try {
        const data: RedisWorkspaceBroadcastPayload = JSON.parse(msg);
        if (data.nodeId !== this.nodeId) {
          // A rejected dispatch here (e.g. a DB blip on the membership read)
          // must not become an unhandled rejection — that would take down
          // every connection on this node, not just this one broadcast.
          this.dispatchLocalWorkspaceBroadcast(
            data.workspaceId,
            data.event,
            data.excludeClientId,
          ).catch((err) =>
            this.logger.error('Error dispatching Redis workspace broadcast', err),
          );
        }
      } catch (err) {
        this.logger.error('Error handling Redis workspace broadcast', err);
      }
    });

    await this.cache.subscribe('realtime:user', (msg) => {
      try {
        const data: RedisUserBroadcastPayload = JSON.parse(msg);
        if (data.nodeId !== this.nodeId) {
          this.dispatchLocalUserBroadcast(data.userId, data.event);
        }
      } catch (err) {
        this.logger.error('Error handling Redis user broadcast', err);
      }
    });

    // 2. Start SSE keep-alive heartbeat ping every 25 seconds
    this.keepAliveTimer = setInterval(() => {
      this.sendKeepAlivePing();
    }, 25_000);
    this.keepAliveTimer.unref?.();

    // 3. Retry unacked reliable deliveries for users connected to this node
    if (this.deliveries) {
      this.deliverySweepTimer = setInterval(() => {
        void this.sweepPendingDeliveries();
      }, this.limits.deliverySweepMs);
      this.deliverySweepTimer.unref?.();
    }

    this.logger.log(`RealtimeGatewayService initialized on cluster node [${this.nodeId}]`);
  }

  onModuleDestroy(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    if (this.deliverySweepTimer) {
      clearInterval(this.deliverySweepTimer);
      this.deliverySweepTimer = null;
    }

    // Drain and complete all active SSE subjects cleanly
    for (const [clientId, client] of this.clients.entries()) {
      try {
        client.subject.complete();
      } catch {
        // Ignore
      }
      this.clients.delete(clientId);
    }
    this.userClientMap.clear();
    this.workspaceClientMap.clear();
    this.usersWithPending.clear();
  }

  /**
   * Throws 503 when this node is at its connection limit, so the client backs
   * off (its reconnect has exponential backoff) instead of the node degrading
   * for everyone already connected.
   */
  assertCapacity(): void {
    if (this.clients.size >= this.limits.maxConnections) {
      throw new ServiceUnavailableException(
        'Realtime is at capacity on this node; retry shortly.',
      );
    }
  }

  /**
   * Registers a newly established SSE connection. A user over their
   * per-user cap loses their *oldest* connection (typically a leaked or
   * backgrounded tab) — other users are never affected.
   */
  registerClient(
    clientId: string,
    userId: string,
    workspaceId: string | null,
    subject: Subject<SseMessageEvent>,
    transport?: ClientTransport,
  ): void {
    const client: ConnectedClient = {
      clientId,
      userId,
      workspaceId,
      subject,
      connectedAt: new Date(),
      transport,
    };

    this.clients.set(clientId, client);

    // Map user
    let userClients = this.userClientMap.get(userId);
    if (!userClients) {
      userClients = new Set();
      this.userClientMap.set(userId, userClients);
    }
    userClients.add(clientId);

    while (userClients.size > this.limits.maxConnectionsPerUser) {
      // Sets iterate in insertion order: the first entry is the oldest.
      const oldest = userClients.values().next().value as string;
      this.logger.debug(
        `Evicting oldest connection ${oldest} of user ${userId} (per-user cap)`,
      );
      this.dropClient(oldest);
    }

    // Map workspace if specified
    if (workspaceId) {
      let wsClients = this.workspaceClientMap.get(workspaceId);
      if (!wsClients) {
        wsClients = new Set();
        this.workspaceClientMap.set(workspaceId, wsClients);
      }
      wsClients.add(clientId);
    }

    this.logger.debug(
      `Client connected: ${clientId} (user: ${userId}, workspace: ${workspaceId}, total local: ${this.clients.size})`,
    );
  }

  /**
   * Unregisters an SSE connection upon client termination.
   */
  unregisterClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    this.clients.delete(clientId);

    const userClients = this.userClientMap.get(client.userId);
    if (userClients) {
      userClients.delete(clientId);
      if (userClients.size === 0) {
        this.userClientMap.delete(client.userId);
      }
    }

    if (client.workspaceId) {
      const wsClients = this.workspaceClientMap.get(client.workspaceId);
      if (wsClients) {
        wsClients.delete(clientId);
        if (wsClients.size === 0) {
          this.workspaceClientMap.delete(client.workspaceId);
        }
      }
    }

    // Nothing left here to retry to; the pending entries stay in the shared
    // store for whichever node the user reconnects to.
    if (!this.userClientMap.has(client.userId)) {
      this.usersWithPending.delete(client.userId);
    }

    try {
      client.subject.complete();
    } catch {
      // Ignore
    }

    this.logger.debug(`Client disconnected: ${clientId} (remaining local: ${this.clients.size})`);
  }

  /** Unregisters and closes the underlying socket (eviction, stall). */
  private dropClient(clientId: string): void {
    const transport = this.clients.get(clientId)?.transport;
    this.unregisterClient(clientId);
    try {
      transport?.close();
    } catch {
      // Socket already gone
    }
  }

  /**
   * Pushes one frame to one connection. A stalled consumer (its socket write
   * buffer past the limit) is disconnected instead — it reconnects and
   * recovers through replay / pending delivery, and its backlog never grows
   * the node's memory or delays anyone else. Returns whether it was sent.
   */
  private pushToClient(client: ConnectedClient, event: SseMessageEvent): boolean {
    try {
      const buffered = client.transport?.bufferedBytes() ?? 0;
      if (buffered > this.limits.maxBufferedBytes) {
        this.logger.warn(
          `Dropping stalled realtime client ${client.clientId} (user ${client.userId}, ${buffered} bytes unflushed)`,
        );
        this.dropClient(client.clientId);
        return false;
      }
      client.subject.next(event);
      return true;
    } catch (err) {
      this.logger.warn(`Failed to push event to client ${client.clientId}`, err);
      return false;
    }
  }

  /**
   * Dispatches an event to all connected clients authorized for a workspace across all cluster instances.
   */
  async broadcastToWorkspace(
    workspaceId: string,
    event: { id?: string; type: string; payload: unknown; actorId?: string | null },
    excludeClientId?: string,
  ): Promise<void> {
    // Mint the id once, before fan-out, so every node frames and records the
    // same event under the same id — otherwise a client reconnecting to a
    // different node presents a cursor that node never saw and gets the
    // whole replay buffer again, under ids it cannot de-duplicate.
    event = { ...event, id: event.id ?? generateId('evt') };

    // 1. Dispatch locally on this API node
    await this.dispatchLocalWorkspaceBroadcast(workspaceId, event, excludeClientId);

    // 2. Publish to Redis Pub/Sub so other API instances receive it
    const redisPayload: RedisWorkspaceBroadcastPayload = {
      nodeId: this.nodeId,
      workspaceId,
      event,
      excludeClientId,
    };
    await this.cache.publish('realtime:workspace', redisPayload);
  }

  private async dispatchLocalWorkspaceBroadcast(
    workspaceId: string,
    event: { id?: string; type: string; payload: unknown; actorId?: string | null },
    excludeClientId?: string,
  ): Promise<void> {
    const eventId =
      event.id ?? generateId('evt');
    const payloadString = JSON.stringify({
      id: eventId,
      type: event.type,
      workspaceId,
      actorId: event.actorId ?? null,
      timestamp: new Date().toISOString(),
      payload: event.payload,
    });

    // Record it for reconnect replay before the early-return below, so the
    // buffer is complete even on a node with no local subscribers right now.
    this.recordRecentEvent(workspaceId, eventId, payloadString);

    const sseEvent: SseMessageEvent = {
      data: payloadString,
      id: eventId,
      type: 'event',
    };

    // Fast path: Check if we have any active local subscribers for this workspace
    if (this.clients.size === 0) return;

    // Get active workspace members
    const activeMembers = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, status: 'ACTIVE' },
      select: { userId: true },
    });
    const authorizedUserIds = new Set(activeMembers.map((m) => m.userId));

    for (const userId of authorizedUserIds) {
      const clientIds = this.userClientMap.get(userId);
      if (!clientIds) continue;

      for (const cid of Array.from(clientIds)) {
        if (cid === excludeClientId) continue;
        const client = this.clients.get(cid);
        if (client) this.pushToClient(client, sseEvent);
      }
    }
  }

  /**
   * Dispatches an event directly to a single user across all their connected
   * devices/tabs on any node. Best-effort: a user who is offline right now
   * never sees it. Use `deliverToUser` for events that must not be lost.
   */
  broadcastToUser(userId: string, event: UserEvent): void {
    event = { ...event, id: event.id ?? generateId('evt') };

    // 1. Dispatch locally
    this.dispatchLocalUserBroadcast(userId, event);

    // 2. Publish to Redis Pub/Sub
    const redisPayload: RedisUserBroadcastPayload = {
      nodeId: this.nodeId,
      userId,
      event,
    };
    this.cache
      .publish('realtime:user', redisPayload)
      .catch((err) => this.logger.warn('Redis user broadcast publish failed', err));
  }

  /**
   * Reliable (deliver-then-delete) user event: parked in the shared pending
   * store *first*, then pushed to any live connection. It stays pending until
   * the client acks it (`POST /realtime/ack`), is retried with bounded
   * exponential backoff while the user is connected, is flushed on their next
   * connection if they are offline, and expires per the retention policy.
   * `event.id` doubles as the idempotency key: re-delivering the same id
   * updates one pending entry, and the client de-duplicates by id.
   */
  async deliverToUser(
    userId: string,
    event: Omit<UserEvent, 'requiresAck'>,
  ): Promise<{ id: string; status: DeliveryStatus }> {
    const id = event.id ?? generateId('dlv');
    const stamped: UserEvent = { ...event, id, requiresAck: true };

    if (!this.deliveries) {
      this.broadcastToUser(userId, stamped);
      return { id, status: 'pending' };
    }

    const status = await this.deliveries.enqueue({
      id,
      userId,
      workspaceId: stamped.workspaceId ?? null,
      type: stamped.type,
      data: this.frameUserEvent(stamped),
    });
    if (status === 'failed') return { id, status };

    this.broadcastToUser(userId, stamped);
    return { id, status };
  }

  private frameUserEvent(event: UserEvent): string {
    return JSON.stringify({
      id: event.id,
      type: event.type,
      workspaceId: event.workspaceId ?? null,
      timestamp: new Date().toISOString(),
      payload: event.payload,
      ...(event.requiresAck ? { requiresAck: true } : {}),
    });
  }

  private dispatchLocalUserBroadcast(userId: string, event: UserEvent): void {
    const clientIds = this.userClientMap.get(userId);
    if (!clientIds || clientIds.size === 0) return;

    const id = event.id ?? generateId('evt');
    const sseEvent: SseMessageEvent = {
      data: this.frameUserEvent({ ...event, id }),
      id,
      type: 'event',
    };

    let sent = false;
    for (const cid of Array.from(clientIds)) {
      const client = this.clients.get(cid);
      if (client && this.pushToClient(client, sseEvent)) sent = true;
    }

    if (event.requiresAck && this.deliveries) {
      // Track for retry until acked, and count this push as an attempt.
      this.usersWithPending.add(userId);
      if (sent) void this.recordAttemptById(userId, id);
    }
  }

  private async recordAttemptById(userId: string, id: string): Promise<void> {
    const deliveries = this.deliveries;
    if (!deliveries) return;
    try {
      const { due } = await deliveries.collectDue(userId, {
        includeNotDue: true,
      });
      const entry = due.find((d) => d.id === id);
      if (entry) await deliveries.recordAttempt(entry);
    } catch (err) {
      this.logger.warn(`Could not record delivery attempt for user ${userId}`, err);
    }
  }

  /**
   * Sends every still-pending delivery of the connection's user to that one
   * fresh connection (it has seen none of them) — the recovery path after an
   * offline period or a reconnect. Errors are contained to this user.
   */
  async flushPendingToClient(clientId: string): Promise<number> {
    const client = this.clients.get(clientId);
    if (!client || !this.deliveries) return 0;
    try {
      const { due } = await this.deliveries.collectDue(client.userId, {
        includeNotDue: true,
      });
      let sent = 0;
      for (const entry of due) {
        // The connection may have closed while we were reading the store.
        if (!this.clients.has(clientId)) break;
        if (this.pushToClient(client, this.pendingFrame(entry))) {
          sent++;
          await this.deliveries.recordAttempt(entry);
        }
      }
      if (due.length > 0 && this.userClientMap.has(client.userId)) {
        this.usersWithPending.add(client.userId);
      }
      return sent;
    } catch (err) {
      this.logger.warn(`Pending delivery flush failed for user ${client.userId}`, err);
      return 0;
    }
  }

  private pendingFrame(entry: PendingDelivery): SseMessageEvent {
    return { data: entry.data, id: entry.id, type: 'event' };
  }

  /**
   * One retry pass over locally connected users with unacked deliveries.
   * Users are processed in bounded chunks and each in isolation: one user's
   * store error or stalled socket never stops the others' retries.
   */
  async sweepPendingDeliveries(now = Date.now()): Promise<void> {
    if (!this.deliveries || this.sweepInFlight) return;
    this.sweepInFlight = true;
    try {
      const users = Array.from(this.usersWithPending);
      const chunk = this.limits.deliverySweepConcurrency;
      for (let i = 0; i < users.length; i += chunk) {
        await Promise.allSettled(
          users.slice(i, i + chunk).map((userId) => this.retryUser(userId, now)),
        );
      }
    } finally {
      this.sweepInFlight = false;
    }
  }

  private async retryUser(userId: string, now: number): Promise<void> {
    const deliveries = this.deliveries;
    const clientIds = this.userClientMap.get(userId);
    if (!deliveries || !clientIds || clientIds.size === 0) {
      this.usersWithPending.delete(userId);
      return;
    }
    try {
      const { due, remaining } = await deliveries.collectDue(userId, { now });
      if (remaining === 0) {
        this.usersWithPending.delete(userId);
        return;
      }
      for (const entry of due) {
        let sent = false;
        for (const cid of Array.from(clientIds)) {
          const client = this.clients.get(cid);
          if (client && this.pushToClient(client, this.pendingFrame(entry))) {
            sent = true;
          }
        }
        if (sent) await deliveries.recordAttempt(entry, now);
      }
    } catch (err) {
      this.logger.warn(`Pending delivery retry failed for user ${userId}`, err);
    }
  }

  /** Whether the retry sweep is tracking this user (tests / diagnostics). */
  hasPendingTracked(userId: string): boolean {
    return this.usersWithPending.has(userId);
  }

  /**
   * Broadcasts presence update to members of given workspaces.
   */
  async broadcastPresence(
    presence: UserPresence,
    targetWorkspaceIds?: string[],
  ): Promise<void> {
    const wsIds =
      targetWorkspaceIds && targetWorkspaceIds.length > 0
        ? targetWorkspaceIds
        : presence.workspaceId
        ? [presence.workspaceId]
        : [];

    if (wsIds.length === 0) {
      const memberships = await this.prisma.workspaceMember.findMany({
        where: { userId: presence.userId, status: 'ACTIVE' },
        select: { workspaceId: true },
      });
      for (const m of memberships) {
        wsIds.push(m.workspaceId);
      }
    }

    const uniqueWorkspaces = Array.from(new Set(wsIds));
    for (const wsId of uniqueWorkspaces) {
      await this.broadcastToWorkspace(wsId, {
        type: 'presence.updated',
        payload: presence,
        actorId: presence.userId,
      });
    }
  }

  private sendKeepAlivePing(): void {
    if (this.clients.size === 0) return;

    const pingEvent: SseMessageEvent = {
      type: 'ping',
      data: JSON.stringify({ ping: true, timestamp: Date.now() }),
    };

    // Snapshot: a stalled client is dropped (and removed from the map) mid-loop.
    for (const client of Array.from(this.clients.values())) {
      this.pushToClient(client, pingEvent);
    }
  }

  /**
   * Returns active connection count on this node.
   */
  getConnectionCount(): number {
    return this.clients.size;
  }

  // --- reconnect replay ------------------------------------------------

  private recordRecentEvent(
    workspaceId: string,
    id: string,
    data: string,
  ): void {
    let buffer = this.recentEvents.get(workspaceId);
    if (!buffer) {
      buffer = [];
      this.recentEvents.set(workspaceId, buffer);
    }
    buffer.push({ id, at: Date.now(), data });

    const cutoff = Date.now() - RealtimeGatewayService.REPLAY_MAX_AGE_MS;
    while (
      buffer.length > 0 &&
      (buffer.length > RealtimeGatewayService.REPLAY_MAX_PER_WORKSPACE ||
        buffer[0].at < cutoff)
    ) {
      buffer.shift();
    }
  }

  /**
   * The events broadcast to `workspaceId` after the one with id `lastEventId`.
   * If the cursor is unknown (too old, or this node never saw it) the whole
   * current buffer is returned — the client de-duplicates by event id, so a
   * small over-send is harmless.
   */
  getReplaySince(
    workspaceId: string,
    lastEventId: string | null,
  ): SseMessageEvent[] {
    const buffer = this.recentEvents.get(workspaceId);
    if (!buffer || buffer.length === 0) return [];

    let startIndex = 0;
    if (lastEventId) {
      const found = buffer.findIndex((e) => e.id === lastEventId);
      startIndex = found >= 0 ? found + 1 : 0;
    }
    return buffer
      .slice(startIndex)
      .map((e) => ({ data: e.data, id: e.id, type: 'event' }));
  }
}
