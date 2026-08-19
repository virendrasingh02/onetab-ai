import { createHmac } from 'node:crypto';
import { z } from 'zod';

/**
 * Matrix bridge configuration.
 *
 * The API never embeds the Matrix SDK — it speaks the Client-Server and
 * Application Service HTTP APIs directly. That keeps an ESM-only dependency
 * out of the CommonJS API bundle, and matches the role: we are a bridge and a
 * provisioner, not a chat client.
 *
 * Two ways to hold the privileges the bridge needs:
 *
 * - **Appservice** — `MATRIX_AS_TOKEN` plus a registration file installed on
 *   the homeserver, and `MATRIX_REGISTRATION_SHARED_SECRET` for provisioning.
 *   Requires filesystem access to the homeserver.
 * - **Server admin** — `MATRIX_USERNAME` / `MATRIX_PASSWORD` for an account
 *   with the admin flag. Everything then goes through the Synapse admin API,
 *   which needs nothing but the account, so it works against a homeserver that
 *   is merely reachable (a shared box on the LAN, say).
 *
 * Admin credentials win when both are present.
 */
export const matrixEnvSchema = z.object({
  MATRIX_HOMESERVER_URL: z.string().url().optional(),
  /** Alias, so a deployment can use the shorter name. */
  MATRIX_HOMESERVER: z.string().url().optional(),
  MATRIX_SERVER_NAME: z.string().optional(),

  /**
   * A Synapse account carrying the server-admin flag. Used for every
   * privileged call; never sent to the browser.
   */
  MATRIX_USERNAME: z.string().optional(),
  MATRIX_PASSWORD: z.string().optional(),

  /**
   * An access token for that admin account, if one has been minted.
   *
   * Optional, and worth setting: Synapse rate-limits `/login` per source
   * address, so a few API restarts in a row can leave the bridge unable to
   * sign in for minutes. With a token it never signs in at all — and if the
   * token is ever revoked it falls back to the password.
   */
  MATRIX_ADMIN_TOKEN: z.string().optional(),

  /**
   * Synapse shared-secret registration key. Used once per user to provision a
   * Matrix identity; never sent to the browser.
   */
  MATRIX_REGISTRATION_SHARED_SECRET: z.string().optional(),

  /** Application service tokens, if running as an appservice. */
  MATRIX_AS_TOKEN: z.string().optional(),
  MATRIX_HS_TOKEN: z.string().optional(),

  /**
   * Salt for the per-user Matrix passwords the bridge derives. Bridged users
   * never learn their own password, so this only has to be stable and secret.
   */
  MATRIX_USER_PASSWORD_SECRET: z.string().optional(),

  /** Enables the bridge. Off by default so the API boots without Matrix. */
  MATRIX_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  /**
   * End-to-end encryption for private channels.
   *
   * It costs a real login per browser: encryption needs a device, and only
   * `POST /login` issues a device-bound token. Synapse rate-limits that per
   * source address — and every login the bridge performs comes from one
   * address — so the default `rc_login` settings allow roughly five sessions
   * and then one every few minutes across the whole deployment.
   *
   * Turn this off against a homeserver whose `rc_login` has not been relaxed:
   * sessions then come from the admin API, which is not rate-limited at all,
   * and private rooms are created unencrypted to match.
   */
  MATRIX_ENCRYPTION: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
});

export type MatrixEnv = z.infer<typeof matrixEnvSchema>;

export interface MatrixConfig {
  enabled: boolean;
  /** Whether private rooms are encrypted and sessions are device-bound. */
  encryption: boolean;
  homeserverUrl: string;
  serverName: string;
  adminUsername?: string;
  adminPassword?: string;
  adminToken?: string;
  registrationSharedSecret?: string;
  asToken?: string;
  hsToken?: string;
  /** Never blank when `enabled`; see `readMatrixConfig`. */
  userPasswordSecret: string;
}

/** True when the bridge should drive Synapse through the admin API. */
export function usesAdminCredentials(config: MatrixConfig): boolean {
  return Boolean(
    config.adminToken || (config.adminUsername && config.adminPassword),
  );
}

/**
 * The Matrix password of a bridged user.
 *
 * Derived rather than stored: an encrypted deployment hands the browser a
 * device-bound session, which means somebody has to log in as the user, and a
 * derivation keeps that possible without a secrets table. Nothing outside this
 * process ever sees the result, and rotating the secret self-heals — a refused
 * login resets the password through the admin API and retries.
 */
export function deriveUserPassword(
  secret: string,
  matrixUserId: string,
): string {
  return createHmac('sha256', secret)
    .update(`matrix-password:${matrixUserId}`)
    .digest('base64url');
}

/**
 * Reads and validates the Matrix settings.
 *
 * Returns `enabled: false` rather than throwing when the bridge is switched
 * off, so the rest of the API runs unchanged in environments without a
 * homeserver — which is the normal case for local development.
 */
export function readMatrixConfig(
  env: Record<string, string | undefined>,
): MatrixConfig {
  // `.env` files spell "not set" as `FOO=""`, and a blank token or URL is
  // worse than a missing one: it passes the "is it configured?" checks below
  // and then fails at the homeserver.
  const parsed = matrixEnvSchema.parse(
    Object.fromEntries(
      Object.entries(env).map(([key, value]) => [
        key,
        typeof value === 'string' && value.trim() === '' ? undefined : value,
      ]),
    ),
  );

  if (!parsed.MATRIX_ENABLED) {
    return {
      enabled: false,
      encryption: false,
      homeserverUrl: '',
      serverName: '',
      userPasswordSecret: '',
    };
  }

  const homeserverUrl =
    parsed.MATRIX_HOMESERVER_URL ?? parsed.MATRIX_HOMESERVER;

  if (!homeserverUrl || !parsed.MATRIX_SERVER_NAME) {
    throw new Error(
      'MATRIX_ENABLED=true requires MATRIX_HOMESERVER_URL (or MATRIX_HOMESERVER) and MATRIX_SERVER_NAME.',
    );
  }

  const hasAdmin = Boolean(
    parsed.MATRIX_ADMIN_TOKEN ??
      (parsed.MATRIX_USERNAME && parsed.MATRIX_PASSWORD),
  );

  if (!hasAdmin && !parsed.MATRIX_REGISTRATION_SHARED_SECRET) {
    throw new Error(
      'MATRIX_ENABLED=true requires either MATRIX_USERNAME + MATRIX_PASSWORD (a server admin) or MATRIX_REGISTRATION_SHARED_SECRET.',
    );
  }

  // Falls back to another server-side secret so a deployment that never sets
  // it still gets stable passwords instead of a fresh one per boot.
  const userPasswordSecret =
    parsed.MATRIX_USER_PASSWORD_SECRET ??
    parsed.MATRIX_REGISTRATION_SHARED_SECRET ??
    parsed.MATRIX_PASSWORD ??
    '';

  return {
    enabled: true,
    encryption: parsed.MATRIX_ENCRYPTION,
    homeserverUrl: homeserverUrl.replace(/\/$/, ''),
    serverName: parsed.MATRIX_SERVER_NAME,
    adminUsername: parsed.MATRIX_USERNAME,
    adminPassword: parsed.MATRIX_PASSWORD,
    adminToken: parsed.MATRIX_ADMIN_TOKEN,
    registrationSharedSecret: parsed.MATRIX_REGISTRATION_SHARED_SECRET,
    asToken: parsed.MATRIX_AS_TOKEN,
    hsToken: parsed.MATRIX_HS_TOKEN,
    userPasswordSecret,
  };
}

/** Derives a stable Matrix user id from our own user id. */
export function toMatrixUserId(localpart: string, serverName: string): string {
  return `@${localpart}:${serverName}`;
}

/**
 * Our user ids are cuids, which are already valid Matrix localparts
 * (lowercase alphanumeric). Prefixed so bridged users are recognisable and
 * cannot collide with a human-registered account.
 */
export function toMatrixLocalpart(userId: string): string {
  return `onetab_${userId.toLowerCase()}`;
}
