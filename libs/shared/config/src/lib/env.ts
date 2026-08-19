import { z } from 'zod';

/**
 * Environment contract for the API.
 *
 * Validated once at boot so a missing or malformed variable fails immediately
 * with a readable message, rather than surfacing as a confusing runtime error
 * on the first request that happens to need it.
 */
export const apiEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('localhost'),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine((value) => value.startsWith('postgres'), {
      message: 'DATABASE_URL must be a postgres:// connection string',
    }),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  /** Comma-separated allowlist. Empty means "same origin only". */
  CORS_ORIGINS: z.string().default(''),

  // Matrix bridge. Optional: the API runs without a homeserver.
  MATRIX_ENABLED: z.enum(['true', 'false']).default('false'),
  MATRIX_ENCRYPTION: z.enum(['true', 'false']).default('true'),
  MATRIX_HOMESERVER_URL: z.string().url().optional(),
  // Alias. Blank-tolerant, because `.env` files write "unset" as `FOO=""`.
  MATRIX_HOMESERVER: z
    .string()
    .optional()
    .refine((value) => !value || z.string().url().safeParse(value).success, {
      message: 'MATRIX_HOMESERVER must be a URL',
    }),
  MATRIX_SERVER_NAME: z.string().optional(),
  /** Server-admin account the bridge drives Synapse with. */
  MATRIX_USERNAME: z.string().optional(),
  MATRIX_PASSWORD: z.string().optional(),
  MATRIX_ADMIN_TOKEN: z.string().optional(),
  MATRIX_USER_PASSWORD_SECRET: z.string().optional(),
  MATRIX_REGISTRATION_SHARED_SECRET: z.string().optional(),
  MATRIX_AS_TOKEN: z.string().optional(),
  MATRIX_HS_TOKEN: z.string().optional(),

  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),

  // Infrastructure integration settings
  REDIS_URL: z.string().default('redis://localhost:6379'),
  MATRIX_URL: z.string().default('http://localhost:8008'),
  MINIO_ENDPOINT: z.string().default('http://localhost:9000'),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MEILI_HOST: z.string().default('http://localhost:7700'),
  MEILI_MASTER_KEY: z.string().default('masterKey123'),
  QDRANT_URL: z.string().default('http://localhost:6333'),
  OLLAMA_URL: z.string().default('http://localhost:11434'),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

/**
 * `ConfigModule.forRoot({ validate })` hook.
 *
 * Throws with every problem listed at once — fixing one variable per restart
 * is a miserable way to configure a service.
 */
export function validateApiEnv(raw: Record<string, unknown>): ApiEnv {
  const result = apiEnvSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return result.data;
}

/** Parses `CORS_ORIGINS` into an array, dropping blanks. */
export function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
