import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'node:crypto';
import {
  deriveUserPassword,
  readMatrixConfig,
  toMatrixLocalpart,
  toMatrixUserId,
  usesAdminCredentials,
  type MatrixConfig,
} from './matrix.config.js';

interface RegisterResponse {
  user_id: string;
  access_token: string;
  device_id?: string;
}

interface LoginResponse {
  user_id: string;
  access_token: string;
  device_id?: string;
}

/** A Matrix session the browser can drive directly. */
export interface MatrixUserSession {
  matrixUserId: string;
  accessToken: string;
  deviceId: string;
}

/**
 * A homeserver rejection, with the Matrix error code preserved.
 *
 * Nest sees an ordinary `HttpException`; the retry paths in this file need the
 * `errcode` to tell "your token died" apart from "no".
 */
export class MatrixRequestError extends HttpException {
  constructor(
    message: string,
    status: number,
    readonly errcode: string | undefined,
    readonly upstreamStatus: number,
  ) {
    super(message, status);
  }
}

/** The homeserver device the bridge itself logs in as. */
const BRIDGE_DEVICE_ID = 'ONETAB_AI_BRIDGE';

const MAX_RATE_LIMIT_RETRIES = 3;
/** Long enough for Synapse's login bucket to refill, short of a dead request. */
const MAX_RATE_LIMIT_WAIT_MS = 8_000;

/** A cropped avatar is a small square; anything much bigger is not one, and is
 *  not worth pushing through the homeserver media repo. */
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/**
 * Decodes a `data:` URL into bytes and a MIME type, or `null` for any other
 * shape. Only `image/*` payloads are accepted — the one caller is avatar sync.
 */
function parseImageDataUrl(
  value: string,
): { mimeType: string; bytes: Uint8Array } | null {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(value);
  if (!match) return null;
  const [, mimeType, isBase64, data] = match;
  if (!mimeType.startsWith('image/')) return null;
  const bytes = isBase64
    ? Buffer.from(data, 'base64')
    : Buffer.from(decodeURIComponent(data), 'utf8');
  return { mimeType, bytes: new Uint8Array(bytes) };
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
  /** Cached admin session, refreshed lazily when the homeserver rejects it. */
  private adminToken: string | null = null;
  private adminLogin: Promise<string> | null = null;
  /**
   * Room creator by room id. Without an appservice the bridge acts *as* the
   * creator to invite and kick, and that mapping never changes for a room.
   */
  private readonly roomCreators = new Map<string, string>();

  constructor(configService: ConfigService) {
    // `readMatrixConfig` takes a plain record, so the relevant keys are pulled
    // off ConfigService explicitly rather than casting the service itself.
    this.config = this.readConfig(configService);
    // A configured token is used as-is, and only replaced if the homeserver
    // says it is dead.
    this.adminToken = this.config.adminToken ?? null;
  }

  private readConfig(configService: ConfigService): MatrixConfig {
    return readMatrixConfig({
      MATRIX_ENABLED: configService.get<string>('MATRIX_ENABLED'),
      MATRIX_HOMESERVER_URL: configService.get<string>('MATRIX_HOMESERVER_URL'),
      MATRIX_HOMESERVER: configService.get<string>('MATRIX_HOMESERVER'),
      MATRIX_SERVER_NAME: configService.get<string>('MATRIX_SERVER_NAME'),
      MATRIX_USERNAME: configService.get<string>('MATRIX_USERNAME'),
      MATRIX_PASSWORD: configService.get<string>('MATRIX_PASSWORD'),
      MATRIX_ADMIN_TOKEN: configService.get<string>('MATRIX_ADMIN_TOKEN'),
      MATRIX_REGISTRATION_SHARED_SECRET: configService.get<string>(
        'MATRIX_REGISTRATION_SHARED_SECRET',
      ),
      MATRIX_AS_TOKEN: configService.get<string>('MATRIX_AS_TOKEN'),
      MATRIX_HS_TOKEN: configService.get<string>('MATRIX_HS_TOKEN'),
      MATRIX_USER_PASSWORD_SECRET: configService.get<string>(
        'MATRIX_USER_PASSWORD_SECRET',
      ),
      MATRIX_ENCRYPTION: configService.get<string>('MATRIX_ENCRYPTION'),
    });
  }

  get isEnabled(): boolean {
    return this.config.enabled;
  }

  /** Whether this deployment encrypts private rooms. */
  get isEncrypted(): boolean {
    return this.config.enabled && this.config.encryption;
  }

  get serverName(): string {
    return this.config.serverName;
  }

  /**
   * The homeserver's base URL, as the browser should dial it.
   *
   * Exposed because it cannot be derived from `serverName`: the server name is
   * a Matrix identity (`localhost`, `matrix.onetab.ai`) while this is a
   * transport address that carries a scheme and, in development, a port.
   */
  get homeserverUrl(): string {
    return this.config.homeserverUrl;
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
    attempt = 0,
  ): Promise<T> {
    const config = this.assertEnabled();
    const { accessToken, ...rest } = init;

    let response: Response;
    try {
      response = await fetch(`${config.homeserverUrl}${path}`, {
        ...rest,
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...rest.headers,
        },
      });
    } catch (error) {
      this.logger.error(
        `Matrix connection failed at ${config.homeserverUrl}${path}: ${String(error)}`,
      );
      throw new HttpException(
        `Unable to reach Matrix homeserver at ${config.homeserverUrl}. Ensure infrastructure containers are running (npm run infra:start).`,
        503,
      );
    }

    const text = await response.text();
    const body = text ? JSON.parse(text) : {};

    if (!response.ok) {
      // Synapse rate-limits logins per source address, and every bridged
      // user's login arrives from this one process — so a workspace signing in
      // together trips the limiter. It tells us exactly how long to wait.
      if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
        const waitMs = Math.min(
          Number(body?.retry_after_ms) || 1_000,
          MAX_RATE_LIMIT_WAIT_MS,
        );
        this.logger.warn(
          `Matrix rate-limited ${path}; retrying in ${waitMs}ms.`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        return this.request<T>(path, init, attempt + 1);
      }

      this.logger.error(
        `Matrix ${path} -> ${response.status} ${body?.errcode ?? ''}`,
      );
      throw new MatrixRequestError(
        body?.error ?? 'The Matrix homeserver rejected the request.',
        response.status === 429 ? 429 : 502,
        body?.errcode,
        response.status,
      );
    }

    return body as T;
  }

  // --- privileged access ---------------------------------------------------

  private get isAdminMode(): boolean {
    return usesAdminCredentials(this.config);
  }

  private get canLoginAsAdmin(): boolean {
    return Boolean(this.config.adminUsername && this.config.adminPassword);
  }

  /** Logs the bridge in as the configured server admin. */
  private async loginAsAdmin(): Promise<string> {
    const config = this.assertEnabled();

    if (!this.canLoginAsAdmin) {
      throw new HttpException(
        'The Matrix admin token was rejected and there is no MATRIX_USERNAME / MATRIX_PASSWORD to sign in with.',
        503,
      );
    }

    const response = await this.request<LoginResponse>(
      '/_matrix/client/v3/login',
      {
        method: 'POST',
        body: JSON.stringify({
          type: 'm.login.password',
          identifier: { type: 'm.id.user', user: config.adminUsername },
          password: config.adminPassword,
          // A fixed device keeps repeated API restarts from littering the
          // admin account with sessions. Two API instances would evict each
          // other's token, which `withPrivileged` recovers from.
          device_id: BRIDGE_DEVICE_ID,
          initial_device_display_name: 'OneTab AI bridge',
        }),
      },
    );

    this.logger.log(`Signed in to Matrix as ${response.user_id}`);
    return response.access_token;
  }

  /**
   * The token used for privileged calls: the appservice token when one is
   * configured, otherwise a cached admin session.
   */
  private async privilegedToken(): Promise<string | undefined> {
    if (!this.isAdminMode) return this.config.asToken;
    if (this.adminToken) return this.adminToken;

    this.adminLogin ??= this.loginAsAdmin()
      .then((token) => {
        this.adminToken = token;
        return token;
      })
      .finally(() => {
        this.adminLogin = null;
      });

    return this.adminLogin;
  }

  /**
   * Runs a privileged call, re-authenticating once if the token has died.
   *
   * Synapse access tokens outlive a process, so the cached one is usually
   * fine — but an admin password change, a manual logout or a second API
   * instance taking the shared device will invalidate it, and that should cost
   * one retry rather than every request until a restart.
   */
  private async withPrivileged<T>(
    call: (accessToken: string | undefined) => Promise<T>,
  ): Promise<T> {
    try {
      return await call(await this.privilegedToken());
    } catch (error) {
      const expired =
        error instanceof MatrixRequestError &&
        (error.errcode === 'M_UNKNOWN_TOKEN' ||
          error.errcode === 'M_MISSING_TOKEN');

      if (!expired || !this.isAdminMode || !this.canLoginAsAdmin) throw error;

      this.adminToken = null;
      return call(await this.privilegedToken());
    }
  }

  /**
   * An access token that acts as `matrixUserId`.
   *
   * The Synapse admin "login as user" API returns a token that is not bound to
   * a device, which is exactly right for the server-side calls below — room
   * creation, invites — and exactly wrong for the browser, which needs a
   * device for end-to-end encryption. `createUserSession` handles that case.
   */
  private async actAs(
    matrixUserId: string,
    options: { expiresInMs?: number } = {},
  ): Promise<string> {
    const response = await this.withPrivileged((accessToken) =>
      this.request<{ access_token: string }>(
        `/_synapse/admin/v1/users/${encodeURIComponent(matrixUserId)}/login`,
        {
          method: 'POST',
          accessToken,
          // Omitting `valid_until_ms` asks Synapse for a token that does not
          // expire, which is what a browser session needs. Tokens the bridge
          // uses for one call get a minute.
          body: JSON.stringify(
            options.expiresInMs
              ? { valid_until_ms: Date.now() + options.expiresInMs }
              : {},
          ),
        },
      ),
    );

    return response.access_token;
  }

  /**
   * A token with power in the room.
   *
   * An appservice can masquerade as anyone, so it needs nothing. Otherwise the
   * bridge borrows the room's creator, who holds PL100 in every room we make.
   */
  private async roomActorToken(roomId: string): Promise<string | undefined> {
    if (!this.isAdminMode) return this.config.asToken;

    let creator = this.roomCreators.get(roomId);

    if (!creator) {
      const room = await this.withPrivileged((accessToken) =>
        this.request<{ creator?: string }>(
          `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}`,
          { accessToken },
        ),
      );

      if (!room.creator) {
        throw new HttpException(
          `Matrix room ${roomId} has no known creator to act as.`,
          502,
        );
      }

      creator = room.creator;
      this.roomCreators.set(roomId, creator);
    }

    return this.actAs(creator, { expiresInMs: 60_000 });
  }

  /**
   * Creates the Matrix account backing one of our users.
   *
   * With admin credentials this is a single idempotent upsert; otherwise it
   * falls back to Synapse's shared-secret registration endpoint.
   */
  async provisionUser(input: {
    userId: string;
    displayName: string;
  }): Promise<{ matrixUserId: string }> {
    const config = this.assertEnabled();
    const localpart = toMatrixLocalpart(input.userId);

    if (this.isAdminMode) {
      const matrixUserId = toMatrixUserId(localpart, config.serverName);

      await this.withPrivileged((accessToken) =>
        this.request(
          `/_synapse/admin/v2/users/${encodeURIComponent(matrixUserId)}`,
          {
            method: 'PUT',
            accessToken,
            body: JSON.stringify({
              password: deriveUserPassword(
                config.userPasswordSecret,
                matrixUserId,
              ),
              displayname: input.displayName,
              admin: false,
              deactivated: false,
              // Provisioning must never sign the person out of a browser they
              // already have open.
              logout_devices: false,
            }),
          },
        ),
      );

      this.logger.log(`Provisioned Matrix identity ${matrixUserId}`);
      return { matrixUserId };
    }

    return this.registerWithSharedSecret(localpart, input.displayName);
  }

  /**
   * Registers a Matrix account using Synapse's shared-secret endpoint.
   *
   * The MAC is an HMAC-SHA1 over NUL-separated fields, in the exact order
   * Synapse expects — the order is part of the protocol, not a style choice.
   */
  private async registerWithSharedSecret(
    localpart: string,
    displayName: string,
  ): Promise<{ matrixUserId: string }> {
    const config = this.assertEnabled();

    if (!config.registrationSharedSecret) {
      throw new HttpException(
        'MATRIX_REGISTRATION_SHARED_SECRET is not configured.',
        503,
      );
    }

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
          displayname: displayName,
          admin: false,
          mac,
        }),
      },
    );

    this.logger.log(`Provisioned Matrix identity ${registered.user_id}`);

    return { matrixUserId: registered.user_id };
  }

  /**
   * Mirrors a bridged user's display name and avatar into their Matrix profile.
   *
   * Chat reads the sender's name and photo straight from Matrix, so without
   * this a person who renamed themselves or uploaded a photo in their OneTab
   * profile still shows a raw handle and an empty avatar in every conversation
   * — while every other surface shows the real thing.
   *
   * Best-effort by contract: the callers (a profile save, a provisioning step,
   * the reconciler) must never fail because the homeserver hiccuped, so each
   * branch swallows its own error to a warning.
   *
   * `avatarUrl`:
   *   - `undefined` — leave the Matrix avatar as it is.
   *   - `null` / `''` — clear it.
   *   - a `data:` URL — decode and upload the bytes to the media repo, then
   *     point the profile at the resulting `mxc://`. That is what the profile
   *     cropper produces and the only shape accepted: fetching an arbitrary
   *     user-supplied `http(s)` URL from the server would be an SSRF hole, so
   *     those are ignored here (the web UI still renders them in an `<img>`).
   */
  async pushUserProfile(input: {
    userId: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  }): Promise<void> {
    if (!this.config.enabled) return;

    const matrixUserId = this.matrixUserIdFor(input.userId);

    if (input.displayName) {
      await this.setProfileField(matrixUserId, 'displayname', {
        displayname: input.displayName,
      }).catch((error) =>
        this.logger.warn(
          `Failed to sync Matrix display name for ${matrixUserId}: ${String(error)}`,
        ),
      );
    }

    if (input.avatarUrl !== undefined) {
      try {
        const mxc = input.avatarUrl
          ? await this.uploadAvatarAs(matrixUserId, input.avatarUrl)
          : '';
        if (mxc !== null) {
          await this.setProfileField(matrixUserId, 'avatar_url', {
            avatar_url: mxc,
          });
        }
      } catch (error) {
        this.logger.warn(
          `Failed to sync Matrix avatar for ${matrixUserId}: ${String(error)}`,
        );
      }
    }
  }

  /**
   * The `mxc://` avatar currently on a bridged user's Matrix profile, or `''`
   * when it has none. Lets the reconciler tell "never synced" apart from
   * "already has a photo" without a schema change.
   */
  async getUserAvatarMxc(userId: string): Promise<string> {
    if (!this.config.enabled) return '';
    const matrixUserId = this.matrixUserIdFor(userId);
    try {
      const profile = await this.request<{ avatar_url?: string }>(
        `/_matrix/client/v3/profile/${encodeURIComponent(matrixUserId)}/avatar_url`,
        { method: 'GET' },
      );
      return profile.avatar_url ?? '';
    } catch {
      return '';
    }
  }

  /** `PUT`s one field of a bridged user's Matrix profile, as that user. */
  private async setProfileField(
    matrixUserId: string,
    field: 'displayname' | 'avatar_url',
    body: Record<string, string>,
  ): Promise<void> {
    const base = `/_matrix/client/v3/profile/${encodeURIComponent(matrixUserId)}/${field}`;
    const accessToken = this.isAdminMode
      ? await this.actAs(matrixUserId, { expiresInMs: 60_000 })
      : this.config.asToken;
    const path = this.isAdminMode
      ? base
      : `${base}?user_id=${encodeURIComponent(matrixUserId)}`;

    await this.request(path, {
      method: 'PUT',
      accessToken,
      body: JSON.stringify(body),
    });
  }

  /**
   * Uploads the bytes behind a `data:` URL to the media repo as `matrixUserId`
   * and returns the `mxc://` URI. Returns `null` for any other URL shape or an
   * oversized payload, which tells the caller to leave the avatar untouched.
   */
  private async uploadAvatarAs(
    matrixUserId: string,
    avatarUrl: string,
  ): Promise<string | null> {
    const parsed = parseImageDataUrl(avatarUrl);
    if (!parsed) return null;
    if (parsed.bytes.byteLength > MAX_AVATAR_BYTES) {
      this.logger.warn(
        `Matrix avatar for ${matrixUserId} is ${parsed.bytes.byteLength} bytes; skipping upload.`,
      );
      return null;
    }

    const accessToken = this.isAdminMode
      ? await this.actAs(matrixUserId, { expiresInMs: 60_000 })
      : this.config.asToken;
    const base = '/_matrix/media/v3/upload?filename=avatar';
    const path = this.isAdminMode
      ? base
      : `${base}&user_id=${encodeURIComponent(matrixUserId)}`;

    const response = await this.request<{ content_uri?: string }>(path, {
      method: 'POST',
      accessToken,
      headers: { 'Content-Type': parsed.mimeType },
      body: parsed.bytes,
    });

    return response.content_uri ?? null;
  }

  /**
   * Opens a Matrix session for a bridged user, for the browser to take over.
   *
   * Two ways to get one, and which is available decides whether the browser
   * can do end-to-end encryption:
   *
   * - `POST /login` with the derived password returns a *device-bound* token,
   *   the only kind that can upload encryption keys. It is also the only kind
   *   Synapse rate-limits, per source address — and every user's login leaves
   *   from this one process.
   * - The admin "login as user" API returns a token with no device. It syncs
   *   and sends fine, cannot touch crypto, and has no rate limit.
   *
   * So encrypted deployments log in, and unencrypted ones puppet. A login the
   * homeserver refuses is repaired first — a drifted password and an account
   * this homeserver has never heard of both come back as 403 — and a login it
   * rate-limits falls back to a puppet token rather than leaving the person
   * without chat.
   */
  async createUserSession(
    matrixUserId: string,
    displayName?: string,
  ): Promise<MatrixUserSession> {
    const config = this.assertEnabled();

    if (!config.encryption || !this.isAdminMode) {
      return this.puppetSession(matrixUserId);
    }

    const password = deriveUserPassword(
      config.userPasswordSecret,
      matrixUserId,
    );

    try {
      return await this.loginAsUser(matrixUserId, password);
    } catch (error) {
      if (!(error instanceof MatrixRequestError)) throw error;

      if (error.upstreamStatus === 403) {
        this.logger.warn(
          `Matrix login for ${matrixUserId} was refused; repairing the account.`,
        );
        await this.resetUserPassword(matrixUserId, password, displayName);
        return this.loginAsUser(matrixUserId, password);
      }

      if (error.upstreamStatus === 429) {
        this.logger.warn(
          `Matrix rate-limited the login for ${matrixUserId}; falling back to ` +
            'a session without encryption. Relax `rc_login` on the homeserver ' +
            'or set MATRIX_ENCRYPTION=false.',
        );
        return this.puppetSession(matrixUserId);
      }

      throw error;
    }
  }

  /** A device-less session, minted through the admin API. */
  private async puppetSession(
    matrixUserId: string,
  ): Promise<MatrixUserSession> {
    return {
      matrixUserId,
      accessToken: await this.actAs(matrixUserId),
      deviceId: '',
    };
  }

  private async loginAsUser(
    matrixUserId: string,
    password: string,
  ): Promise<MatrixUserSession> {
    const response = await this.request<LoginResponse>(
      '/_matrix/client/v3/login',
      {
        method: 'POST',
        body: JSON.stringify({
          type: 'm.login.password',
          identifier: { type: 'm.id.user', user: matrixUserId },
          password,
          initial_device_display_name: 'OneTab AI Web',
        }),
      },
    );

    return {
      matrixUserId: response.user_id,
      accessToken: response.access_token,
      deviceId: response.device_id ?? '',
    };
  }

  /** Sets the password, creating the account if the homeserver lacks it. */
  private async resetUserPassword(
    matrixUserId: string,
    password: string,
    displayName?: string,
  ): Promise<void> {
    await this.withPrivileged((accessToken) =>
      this.request(
        `/_synapse/admin/v2/users/${encodeURIComponent(matrixUserId)}`,
        {
          method: 'PUT',
          accessToken,
          body: JSON.stringify({
            password,
            ...(displayName ? { displayname: displayName } : {}),
            // Other devices keep working: they hold tokens, not the password.
            logout_devices: false,
          }),
        },
      ),
    );
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

    // An appservice can create the room *as* the channel's creator with the
    // `user_id` query parameter. Admin credentials cannot masquerade, so the
    // bridge borrows the creator's own session instead — same outcome, and it
    // is what leaves them holding PL100 in the room.
    const accessToken = this.isAdminMode
      ? await this.actAs(input.creatorMatrixId, { expiresInMs: 60_000 })
      : config.asToken;

    const path = this.isAdminMode
      ? '/_matrix/client/v3/createRoom'
      : `/_matrix/client/v3/createRoom?user_id=${encodeURIComponent(input.creatorMatrixId)}`;

    const response = await this.request<{ room_id: string }>(
      path,
      {
        method: 'POST',
        accessToken,
        body: JSON.stringify({
          name: input.name,
          topic: input.topic,
          preset: input.isPrivate ? 'private_chat' : 'public_chat',
          // Encrypting a room the browsers cannot decrypt would make it
          // unreadable, so the deployment switch has the final say.
          initial_state: input.encrypted && config.encryption
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
    this.assertEnabled();
    const accessToken = await this.roomActorToken(roomId);

    await this.request(
      `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite`,
      {
        method: 'POST',
        accessToken,
        body: JSON.stringify({ user_id: matrixUserId }),
      },
    );
  }

  async kickFromRoom(
    roomId: string,
    matrixUserId: string,
    reason?: string,
  ): Promise<void> {
    this.assertEnabled();
    const accessToken = await this.roomActorToken(roomId);

    await this.request(
      `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/kick`,
      {
        method: 'POST',
        accessToken,
        body: JSON.stringify({ user_id: matrixUserId, reason }),
      },
    );
  }

  /**
   * The Matrix ids currently joined to a room.
   *
   * Uses the Synapse admin room-members API, so the caller does not have to be
   * in the room. Feeds the membership reconciler (`MatrixReconcilerService`),
   * which compares this against our `ChannelMember` rows and converges the two.
   */
  async getRoomMembers(roomId: string): Promise<string[]> {
    this.assertEnabled();
    const response = await this.withPrivileged((accessToken) =>
      this.request<{ members?: string[] }>(
        `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}/members`,
        { accessToken },
      ),
    );
    return response.members ?? [];
  }

  /** Sets a member's power level, mirroring our workspace roles into Matrix. */
  async setPowerLevel(
    roomId: string,
    matrixUserId: string,
    powerLevel: number,
  ): Promise<void> {
    this.assertEnabled();
    const accessToken = await this.roomActorToken(roomId);
    const path = `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.power_levels/`;

    const current = await this.request<{ users?: Record<string, number> }>(
      path,
      { method: 'GET', accessToken },
    );

    await this.request(path, {
      method: 'PUT',
      accessToken,
      body: JSON.stringify({
        ...current,
        users: { ...(current.users ?? {}), [matrixUserId]: powerLevel },
      }),
    });
  }

  /**
   * Joins a room as the given Matrix user.
   *
   * Bot identities (agents, apps) are invited to their DM room the same way a
   * human is, but nothing ever accepts on their behalf — a human joins from
   * their own browser session, a bot has none. `MatrixSyncService` calls this
   * the moment the homeserver reports the invite, since Matrix requires a
   * *joined* member to send events at all, and `getOrCreateDirectMessage`
   * only recognises a room as already existing once both sides have joined it.
   */
  async joinRoomAs(matrixUserId: string, roomId: string): Promise<void> {
    this.assertEnabled();
    const accessToken = this.isAdminMode
      ? await this.actAs(matrixUserId, { expiresInMs: 60_000 })
      : this.config.asToken;

    const path = this.isAdminMode
      ? `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/join`
      : `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/join?user_id=${encodeURIComponent(matrixUserId)}`;

    await this.request(path, { method: 'POST', accessToken, body: '{}' });
  }

  /**
   * Sends a raw timeline event to a room as the given Matrix user.
   *
   * The server-side twin of `MatrixClient.sendMessage` in `@org/matrix-client`
   * (which only ever runs as the signed-in human's own session): this is how
   * the bridge posts on behalf of a bot identity — an agent's response, an
   * app's card — rather than a person. `MatrixBotMessagingService` builds the
   * `content` so it round-trips through the same `extractStructuredEvent`
   * parsing a human-sent structured message would.
   */
  async sendEventAs(
    roomId: string,
    senderMatrixId: string,
    eventType: string,
    content: Record<string, unknown>,
  ): Promise<string> {
    this.assertEnabled();
    const accessToken = this.isAdminMode
      ? await this.actAs(senderMatrixId, { expiresInMs: 60_000 })
      : this.config.asToken;

    const transactionId = `srv.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    const path = this.isAdminMode
      ? `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/${encodeURIComponent(eventType)}/${transactionId}`
      : `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/${encodeURIComponent(eventType)}/${transactionId}?user_id=${encodeURIComponent(senderMatrixId)}`;

    const response = await this.request<{ event_id: string }>(path, {
      method: 'PUT',
      accessToken,
      body: JSON.stringify(content),
    });

    return response.event_id;
  }
}
