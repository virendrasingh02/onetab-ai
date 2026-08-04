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

  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),
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
