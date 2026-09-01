import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';
import type { UserPresence } from '@org/types';
import { Subject } from 'rxjs';

export interface SseMessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}

interface ConnectedClient {
  clientId: string;
  userId: string;
  workspaceId: string | null;
  subject: Subject<SseMessageEvent>;
  connectedAt: Date;
}

@Injectable()
export class RealtimeGatewayService {
  private readonly logger = new Logger(RealtimeGatewayService.name);

  // clientId -> ConnectedClient
  private readonly clients = new Map<string, ConnectedClient>();

  // userId -> Set<clientId>
  private readonly userClientMap = new Map<string, Set<string>>();

  // workspaceId -> Set<clientId>
  private readonly workspaceClientMap = new Map<string, Set<string>>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registers a newly established SSE connection.
   */
  registerClient(
    clientId: string,
    userId: string,
    workspaceId: string | null,
    subject: Subject<SseMessageEvent>,
  ): void {
    const client: ConnectedClient = {
      clientId,
      userId,
      workspaceId,
      subject,
      connectedAt: new Date(),
    };

    this.clients.set(clientId, client);

    // Map user
    let userClients = this.userClientMap.get(userId);
    if (!userClients) {
      userClients = new Set();
      this.userClientMap.set(userId, userClients);
    }
    userClients.add(clientId);

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
      `Client connected: ${clientId} (user: ${userId}, workspace: ${workspaceId})`,
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

    try {
      client.subject.complete();
    } catch {
      // Ignore
    }

    this.logger.debug(`Client disconnected: ${clientId}`);
  }

  /**
   * Dispatches an event to all connected clients authorized for a workspace.
   */
  async broadcastToWorkspace(
    workspaceId: string,
    event: { id?: string; type: string; payload: unknown; actorId?: string | null },
    excludeClientId?: string,
  ): Promise<void> {
    const payloadString = JSON.stringify({
      id: event.id ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: event.type,
      workspaceId,
      actorId: event.actorId ?? null,
      timestamp: new Date().toISOString(),
      payload: event.payload,
    });

    const sseEvent: SseMessageEvent = {
      data: payloadString,
      id: event.id,
      type: 'event',
    };

    // Get active workspace members
    const activeMembers = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, status: 'ACTIVE' },
      select: { userId: true },
    });
    const authorizedUserIds = new Set(activeMembers.map((m) => m.userId));

    for (const userId of authorizedUserIds) {
      const clientIds = this.userClientMap.get(userId);
      if (!clientIds) continue;

      for (const cid of clientIds) {
        if (cid === excludeClientId) continue;
        const client = this.clients.get(cid);
        if (client) {
          try {
            client.subject.next(sseEvent);
          } catch (err) {
            this.logger.warn(`Failed to push event to client ${cid}`, err);
          }
        }
      }
    }
  }

  /**
   * Dispatches an event directly to a single user across all their connected devices/tabs.
   */
  broadcastToUser(
    userId: string,
    event: { id?: string; type: string; payload: unknown; workspaceId?: string | null },
  ): void {
    const clientIds = this.userClientMap.get(userId);
    if (!clientIds || clientIds.size === 0) return;

    const payloadString = JSON.stringify({
      id: event.id ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: event.type,
      workspaceId: event.workspaceId ?? null,
      timestamp: new Date().toISOString(),
      payload: event.payload,
    });

    const sseEvent: SseMessageEvent = {
      data: payloadString,
      id: event.id,
      type: 'event',
    };

    for (const cid of clientIds) {
      const client = this.clients.get(cid);
      if (client) {
        try {
          client.subject.next(sseEvent);
        } catch (err) {
          this.logger.warn(`Failed to push user event to client ${cid}`, err);
        }
      }
    }
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
      // Find all user's active workspaces
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

  /**
   * Returns active connection count across the platform.
   */
  getConnectionCount(): number {
    return this.clients.size;
  }
}
