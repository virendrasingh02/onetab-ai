import { z } from 'zod';

/**
 * Matrix bridge configuration.
 *
 * The API never embeds the Matrix SDK — it speaks the Client-Server and
 * Application Service HTTP APIs directly. That keeps an ESM-only dependency
 * out of the CommonJS API bundle, and matches the role: we are a bridge and a
 * provisioner, not a chat client.
 */
export const matrixEnvSchema = z.object({
  MATRIX_HOMESERVER_URL: z.string().url().optional(),
  MATRIX_SERVER_NAME: z.string().optional(),

  /**
   * Synapse shared-secret registration key. Used once per user to provision a
   * Matrix identity; never sent to the browser.
   */
  MATRIX_REGISTRATION_SHARED_SECRET: z.string().optional(),

  /** Application service tokens, if running as an appservice. */
  MATRIX_AS_TOKEN: z.string().optional(),
  MATRIX_HS_TOKEN: z.string().optional(),

  /** Enables the bridge. Off by default so the API boots without Matrix. */
  MATRIX_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type MatrixEnv = z.infer<typeof matrixEnvSchema>;

export interface MatrixConfig {
  enabled: boolean;
  homeserverUrl: string;
  serverName: string;
  registrationSharedSecret?: string;
  asToken?: string;
  hsToken?: string;
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
  const parsed = matrixEnvSchema.parse(env);

  if (!parsed.MATRIX_ENABLED) {
    return { enabled: false, homeserverUrl: '', serverName: '' };
  }

  if (!parsed.MATRIX_HOMESERVER_URL || !parsed.MATRIX_SERVER_NAME) {
    throw new Error(
      'MATRIX_ENABLED=true requires MATRIX_HOMESERVER_URL and MATRIX_SERVER_NAME.',
    );
  }

  return {
    enabled: true,
    homeserverUrl: parsed.MATRIX_HOMESERVER_URL.replace(/\/$/, ''),
    serverName: parsed.MATRIX_SERVER_NAME,
    registrationSharedSecret: parsed.MATRIX_REGISTRATION_SHARED_SECRET,
    asToken: parsed.MATRIX_AS_TOKEN,
    hsToken: parsed.MATRIX_HS_TOKEN,
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
