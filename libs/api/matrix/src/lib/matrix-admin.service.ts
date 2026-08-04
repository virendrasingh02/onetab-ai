import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'node:crypto';
import {
  readMatrixConfig,
  toMatrixLocalpart,
  toMatrixUserId,
  type MatrixConfig,
} from './matrix.config.js';

interface RegisterResponse {
  user_id: string;
  access_token: string;
  device_id?: string;
}

/**
 * Provisions and administers Matrix identities for our users.
 *
 * Users never hold Matrix credentials of their own: they authenticate against
 * our API, and this service mints the corresponding Matrix identity. That is
 * what keeps authentication and permissions under our control while Matrix
 * carries only the messages.
 */
@Injectable()
export class MatrixAdminService {
  private readonly logger = new Logger(MatrixAdminService.name);
  private readonly config: MatrixConfig;

  constructor(configService: ConfigService) {
    // `readMatrixConfig` takes a plain record, so the relevant keys are pulled
    // off ConfigService explicitly rather than casting the service itself.
    this.config = readMatrixConfig({
      MATRIX_ENABLED: configService.get<string>('MATRIX_ENABLED'),
      MATRIX_HOMESERVER_URL: configService.get<string>('MATRIX_HOMESERVER_URL'),
      MATRIX_SERVER_NAME: configService.get<string>('MATRIX_SERVER_NAME'),
      MATRIX_REGISTRATION_SHARED_SECRET: configService.get<string>(
        'MATRIX_REGISTRATION_SHARED_SECRET',
      ),
      MATRIX_AS_TOKEN: configService.get<string>('MATRIX_AS_TOKEN'),
      MATRIX_HS_TOKEN: configService.get<string>('MATRIX_HS_TOKEN'),
    });
  }

  get isEnabled(): boolean {
    return this.config.enabled;
  }

  get serverName(): string {
    return this.config.serverName;
  }

  matrixUserIdFor(userId: string): string {
    return toMatrixUserId(toMatrixLocalpart(userId), this.config.serverName);
  }

  private assertEnabled(): MatrixConfig {
    if (!this.config.enabled) {
      throw new HttpException(
        'Matrix integration is not configured on this deployment.',
        503,
      );
    }
    return this.config;
  }

  private async request<T>(
    path: string,
    init: RequestInit & { accessToken?: string } = {},
  ): Promise<T> {
    const config = this.assertEnabled();
    const { accessToken, ...rest } = init;

    const response = await fetch(`${config.homeserverUrl}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...rest.headers,
      },
    });

    const text = await response.text();
    const body = text ? JSON.parse(text) : {};

    if (!response.ok) {
      this.logger.error(
        `Matrix ${path} -> ${response.status} ${body?.errcode ?? ''}`,
      );
      throw new HttpException(
        body?.error ?? 'The Matrix homeserver rejected the request.',
        response.status === 429 ? 429 : 502,
      );
    }

    return body as T;
  }

  /**
   * Registers a Matrix account using Synapse's shared-secret endpoint.
   *
   * The MAC is an HMAC-SHA1 over NUL-separated fields, in the exact order
   * Synapse expects — the order is part of the protocol, not a style choice.
   */
  async provisionUser(input: {
    userId: string;
    displayName: string;
  }): Promise<{ matrixUserId: string; accessToken: string }> {
    const config = this.assertEnabled();

    if (!config.registrationSharedSecret) {
      throw new HttpException(
        'MATRIX_REGISTRATION_SHARED_SECRET is not configured.',
        503,
      );
    }

    const localpart = toMatrixLocalpart(input.userId);
    const password = randomBytes(32).toString('base64url');

    const { nonce } = await this.request<{ nonce: string }>(
      '/_synapse/admin/v1/register',
      { method: 'GET' },
    );

    const mac = createHmac('sha1', config.registrationSharedSecret)
      .update(nonce)
      .update('\x00')
      .update(localpart)
      .update('\x00')
      .update(password)
      .update('\x00')
      .update('notadmin')
      .digest('hex');

    const registered = await this.request<RegisterResponse>(
      '/_synapse/admin/v1/register',
      {
        method: 'POST',
        body: JSON.stringify({
          nonce,
          username: localpart,
          password,
          displayname: input.displayName,
          admin: false,
          mac,
        }),
      },
    );

    this.logger.log(`Provisioned Matrix identity ${registered.user_id}`);

    return {
      matrixUserId: registered.user_id,
      accessToken: registered.access_token,
    };
  }

  /**
   * Mints a short-lived login token the browser exchanges for a Matrix
   * session, so the Matrix password never leaves the server.
   *
   * Requires Synapse admin rights; `MATRIX_AS_TOKEN` must belong to an admin
   * user or an application service with `login` permission.
   */
  async createLoginToken(matrixUserId: string): Promise<string> {
    const config = this.assertEnabled();

    const response = await this.request<{ access_token: string }>(
      `/_synapse/admin/v1/users/${encodeURIComponent(matrixUserId)}/login`,
      {
        method: 'POST',
        accessToken: config.asToken,
        body: JSON.stringify({ valid_until_ms: Date.now() + 60_000 }),
      },
    );

    return response.access_token;
  }

  /** Creates a Matrix room to back one of our channels. */
  async createRoom(input: {
    name: string;
    topic?: string;
    isPrivate: boolean;
    encrypted: boolean;
    creatorMatrixId: string;
  }): Promise<string> {
    const config = this.assertEnabled();

    const response = await this.request<{ room_id: string }>(
      `/_matrix/client/v3/createRoom?user_id=${encodeURIComponent(input.creatorMatrixId)}`,
      {
        method: 'POST',
        accessToken: config.asToken,
        body: JSON.stringify({
          name: input.name,
          topic: input.topic,
          preset: input.isPrivate ? 'private_chat' : 'public_chat',
          initial_state: input.encrypted
            ? [
                {
                  type: 'm.room.encryption',
                  state_key: '',
                  content: { algorithm: 'm.megolm.v1.aes-sha2' },
                },
              ]
            : [],
        }),
      },
    );

    return response.room_id;
  }

  async inviteToRoom(roomId: string, matrixUserId: string): Promise<void> {
    const config = this.assertEnabled();
    await this.request(
      `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite`,
      {
        method: 'POST',
        accessToken: config.asToken,
        body: JSON.stringify({ user_id: matrixUserId }),
      },
    );
  }

  async kickFromRoom(
    roomId: string,
    matrixUserId: string,
    reason?: string,
  ): Promise<void> {
    const config = this.assertEnabled();
    await this.request(
      `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/kick`,
      {
        method: 'POST',
        accessToken: config.asToken,
        body: JSON.stringify({ user_id: matrixUserId, reason }),
      },
    );
  }

  /** Sets a member's power level, mirroring our workspace roles into Matrix. */
  async setPowerLevel(
    roomId: string,
    matrixUserId: string,
    powerLevel: number,
  ): Promise<void> {
    const config = this.assertEnabled();
    const path = `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.power_levels/`;

    const current = await this.request<{ users?: Record<string, number> }>(
      path,
      { method: 'GET', accessToken: config.asToken },
    );

    await this.request(path, {
      method: 'PUT',
      accessToken: config.asToken,
      body: JSON.stringify({
        ...current,
        users: { ...(current.users ?? {}), [matrixUserId]: powerLevel },
      }),
    });
  }
}
