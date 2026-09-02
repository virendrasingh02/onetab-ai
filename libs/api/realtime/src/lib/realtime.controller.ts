import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Sse,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  CurrentUser,
  Public,
  type AuthenticatedUser,
} from '@org/api-common';
import { PrismaService } from '@org/database';
import type { UserPresence } from '@org/types';
import type { Request } from 'express';
import {
  finalize,
  interval,
  map,
  merge,
  Observable,
  Subject,
} from 'rxjs';
import { PresenceService } from './presence.service.js';
import {
  RealtimeGatewayService,
  type SseMessageEvent,
} from './realtime-gateway.service.js';

interface StreamQuery {
  token?: string;
  workspaceId?: string;
}

export interface MessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}

@Controller()
export class RealtimeController {
  constructor(
    private readonly gateway: RealtimeGatewayService,
    private readonly presence: PresenceService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Main Server-Sent Events stream for real-time updates and presence.
   *
   * Accepts authentication either via Bearer header or `?token=` query param
   * (to support native browser EventSource API).
   */
  @Public()
  @Sse('realtime/stream')
  async stream(
    @Query() query: StreamQuery,
    @Headers('authorization') authHeader: string | undefined,
    @Req() _req: Request,
  ): Promise<Observable<MessageEvent>> {
    let token = query.token;
    if (!token && authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    if (!token) {
      throw new UnauthorizedException('Authentication token is required.');
    }

    let payload: { sub: string; email: string };
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token.');
    }

    const userId = payload.sub;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new UnauthorizedException('The account no longer exists.');
    }

    const requestedWorkspaceId = query.workspaceId || null;

    // Verify workspace membership if specified
    if (requestedWorkspaceId) {
      const membership = await this.prisma.workspaceMember.findFirst({
        where: {
          userId,
          workspaceId: requestedWorkspaceId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      if (!membership) {
        throw new UnauthorizedException(
          'Not authorized for the requested workspace.',
        );
      }
    }

    const clientId = `rt-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const eventSubject = new Subject<SseMessageEvent>();

    // Register with gateway & presence services
    this.gateway.registerClient(
      clientId,
      userId,
      requestedWorkspaceId,
      eventSubject,
    );
    await this.presence.recordConnection(
      clientId,
      userId,
      requestedWorkspaceId,
    );

    // Initial connected event
    setTimeout(() => {
      eventSubject.next({
        type: 'event',
        data: JSON.stringify({
          id: `init-${Date.now()}`,
          type: 'connected',
          timestamp: new Date().toISOString(),
          workspaceId: requestedWorkspaceId,
          payload: {
            clientId,
            userId,
            workspaceId: requestedWorkspaceId,
            serverTime: Date.now(),
          },
        }),
      });
    }, 10);

    // Keepalive ping every 20 seconds
    const keepalive$ = interval(20_000).pipe(
      map((): SseMessageEvent => ({
        type: 'heartbeat',
        data: JSON.stringify({
          timestamp: new Date().toISOString(),
          serverTime: Date.now(),
        }),
      })),
    );

    const mergedStream$ = merge(eventSubject.asObservable(), keepalive$).pipe(
      finalize(async () => {
        this.gateway.unregisterClient(clientId);
        await this.presence.removeConnection(clientId);
      }),
    );

    return mergedStream$;
  }

  /**
   * Heartbeat / activity ping from active clients.
   */
  @Post('realtime/heartbeat')
  async heartbeat(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      status?: 'online' | 'away' | 'busy' | 'offline';
      workspaceId?: string | null;
      statusText?: string | null;
      statusEmoji?: string | null;
    },
  ): Promise<{ ok: boolean; presence: UserPresence }> {
    const presence = await this.presence.recordHeartbeat(
      user.id,
      body.workspaceId,
      body.status,
      body.statusText,
      body.statusEmoji,
    );
    return { ok: true, presence };
  }

  /**
   * Sets explicit presence state for the current user.
   */
  @Patch('realtime/presence')
  async setPresence(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      presence: 'online' | 'away' | 'busy' | 'offline';
      workspaceId?: string | null;
    },
  ): Promise<{ ok: boolean; presence: UserPresence }> {
    const presence = await this.presence.setExplicitPresence(
      user.id,
      body.presence,
      body.workspaceId,
    );
    return { ok: true, presence };
  }

  /**
   * Snapshot of active and recent member presence in a workspace.
   */
  @Get('workspaces/:workspaceId/presence')
  async getWorkspacePresence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
  ): Promise<{ presence: UserPresence[] }> {
    // Verify membership
    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        userId: user.id,
        workspaceId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    if (!membership) {
      throw new NotFoundException('Workspace not found or access denied.');
    }

    const presence = await this.presence.getWorkspacePresence(workspaceId);
    return { presence };
  }
}
