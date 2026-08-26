import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrentUser, Public } from '@org/api-common';
import { MatrixAdminService } from './matrix-admin.service.js';
import { MatrixAuthService } from './matrix-auth.service.js';
import {
  MatrixSyncService,
  type AppserviceTransaction,
} from './matrix-sync.service.js';
import { NotificationBridgeService } from './notification-bridge.service.js';

@Controller({ path: 'matrix', version: '1' })
export class MatrixController {
  constructor(
    private readonly auth: MatrixAuthService,
    private readonly admin: MatrixAdminService,
  ) {}

  /**
   * Tells the client whether chat is available before it tries to connect.
   *
   * `homeserverUrl` and `matrixUserId` are here so that a browser holding a
   * stored Matrix session can resume it without calling `POST /session` —
   * every one of those creates a device on the homeserver.
   */
  @Get('config')
  async config(@CurrentUser('id') userId: string) {
    if (!this.admin.isEnabled) {
      return {
        enabled: false,
        encryption: false,
        serverName: null,
        homeserverUrl: null,
        matrixUserId: null,
      };
    }

    return {
      enabled: true,
      encryption: this.admin.isEncrypted,
      serverName: this.admin.serverName,
      homeserverUrl: this.admin.homeserverUrl,
      matrixUserId: await this.auth.getIdentity(userId),
    };
  }

  /**
   * Exchanges our session for Matrix credentials.
   *
   * This is the only way the browser obtains a Matrix session — it never sees
   * a Matrix password.
   */
  @Post('session')
  @HttpCode(HttpStatus.OK)
  async createSession(@CurrentUser('id') userId: string) {
    const credentials = await this.auth.issueClientCredentials(userId);
    if (!credentials) {
      throw new ServiceUnavailableException(
        'Matrix integration is not configured on this deployment.',
      );
    }
    return credentials;
  }

  /** Creates (or returns) the Matrix room backing a channel. */
  @Post('channels/:channelId/room')
  @HttpCode(HttpStatus.OK)
  async linkChannel(
    @Param('channelId') channelId: string,
    @CurrentUser('id') userId: string,
  ) {
    const roomId = await this.auth.linkChannelToRoom(channelId, userId);
    if (!roomId) {
      throw new ServiceUnavailableException('Matrix is not configured.');
    }
    return { roomId };
  }

  /**
   * The Matrix identity of a DM peer, so the browser can open a room with
   * them — a teammate, an AI agent (`agent-<id>`), or a connected app
   * (`app-<id>`); see `MatrixAuthService.resolvePeerIdentity` for the prefix
   * dispatch.
   *
   * The room itself is created client-side — `getOrCreateDirectMessage` reuses
   * an existing one and records `m.direct` so both ends group the conversation
   * — but the identity mapping is ours, and provisioning the peer's account is
   * something only the admin credentials can do.
   */
  @Get('users/:userId/identity')
  async peerIdentity(
    @Param('userId') peerUserId: string,
    @CurrentUser('id') userId: string,
  ) {
    if (!this.admin.isEnabled) {
      throw new ServiceUnavailableException('Matrix is not configured.');
    }

    const matrixUserId = await this.auth.resolvePeerIdentity(
      userId,
      peerUserId,
    );
    if (!matrixUserId) {
      throw new NotFoundException('No such conversation peer in your workspaces.');
    }

    return { matrixUserId };
  }
}

/**
 * Application-service endpoints called by the homeserver.
 *
 * These are `@Public()` because the caller is Synapse, not a user — they are
 * authenticated by the `hs_token` instead, which is compared in constant time.
 */
@Controller({ path: 'matrix/appservice', version: '1' })
export class MatrixAppserviceController {
  constructor(
    private readonly sync: MatrixSyncService,
    private readonly notifications: NotificationBridgeService,
    private readonly config: ConfigService,
  ) {}

  private assertHomeserver(authorization?: string): void {
    const expected = this.config.get<string>('MATRIX_HS_TOKEN');
    const provided = authorization?.replace(/^Bearer\s+/i, '');

    if (!expected || !provided || provided !== expected) {
      throw new ForbiddenException('Invalid homeserver token.');
    }
  }

  /**
   * Receives a batch of events.
   *
   * Must return 200 even for events we ignore: any other status makes Synapse
   * retry the transaction indefinitely and stall the bridge.
   */
  @Public()
  @Put('transactions/:txnId')
  @HttpCode(HttpStatus.OK)
  async transaction(
    @Param('txnId') txnId: string,
    @Body() body: AppserviceTransaction,
    @Headers('authorization') authorization?: string,
  ) {
    this.assertHomeserver(authorization);
    await this.sync.handleTransaction(txnId, body);
    return {};
  }

  /** Push gateway endpoint — turns Matrix pushes into our notifications. */
  @Public()
  @Post('notify')
  @HttpCode(HttpStatus.OK)
  async notify(
    @Body() body: { notification?: Record<string, unknown> },
    @Headers('authorization') authorization?: string,
  ) {
    this.assertHomeserver(authorization);
    const rejected = await this.notifications.handlePush(body.notification);
    // The push gateway contract: report pushkeys that are no longer valid so
    // the homeserver stops sending to them.
    return { rejected };
  }
}
