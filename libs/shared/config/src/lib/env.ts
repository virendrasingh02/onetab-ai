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

  // Object storage. `local` (default) writes to STORAGE_ROOT on the API pod's
  // disk — fine for dev, lost on redeploy and not shared across replicas.
  // `s3` targets any S3-compatible store (AWS S3, MinIO, Cloudflare R2,
  // Backblaze B2, DigitalOcean Spaces, Wasabi) — no SDK, SigV4 over fetch.
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_ROOT: z.string().default('.storage'),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  /** `true` (default) for MinIO/most S3-compatible; `false` for AWS virtual-hosted. */
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('true'),
  MEILI_HOST: z.string().default('http://localhost:7700'),
  MEILI_MASTER_KEY: z.string().default('masterKey123'),
  QDRANT_URL: z.string().default('http://localhost:6333'),
  OLLAMA_URL: z.string().default('http://localhost:11434'),

  // Multi-Provider AI Platform configuration
  NVIDIA_API_KEY: z.string().optional(),
  NVIDIA_BASE_URL: z.string().default('https://integrate.api.nvidia.com/v1'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_BASE_URL: z.string().default('https://api.anthropic.com/v1'),
  GOOGLE_AI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().default('https://api.deepseek.com'),
  GROQ_API_KEY: z.string().optional(),
  GROQ_BASE_URL: z.string().default('https://api.groq.com/openai/v1'),
  MISTRAL_API_KEY: z.string().optional(),
  MISTRAL_BASE_URL: z.string().default('https://api.mistral.ai/v1'),
  XAI_API_KEY: z.string().optional(),
  XAI_BASE_URL: z.string().default('https://api.x.ai/v1'),
  TOGETHER_API_KEY: z.string().optional(),
  TOGETHER_BASE_URL: z.string().default('https://api.together.xyz/v1'),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
  COHERE_API_KEY: z.string().optional(),
  COHERE_BASE_URL: z.string().default('https://api.cohere.com/v2'),

  // Default Platform Provider & Model
  AI_DEFAULT_PROVIDER: z.string().default('nvidia'),
  AI_DEFAULT_MODEL: z.string().default('nvidia/nemotron-3-super-120b-a12b'),

  // GIF picker proxy. Optional: without a key the /gifs endpoints serve a
  // small bundled fallback set. Free key: https://developers.google.com/tenor
  TENOR_API_KEY: z.string().optional(),
  TENOR_CLIENT_KEY: z.string().default('onetab-ai'),

  // Transactional email. `log` (default) renders every message to the logger —
  // no external service, safe everywhere. `http` POSTs to `MAIL_API_URL` with a
  // `{ from, to, subject, html, text }` JSON body (Resend / Postmark / SendGrid
  // shape), authorised with `Bearer ${MAIL_API_KEY}`.
  MAIL_TRANSPORT: z.enum(['log', 'http']).default('log'),
  MAIL_FROM: z.string().default('OneTab AI <noreply@onetab.ai>'),
  MAIL_API_URL: z.string().url().optional(),
  MAIL_API_KEY: z.string().optional(),
  /** Public base URL the app is served from — used to build links in emails. */
  APP_URL: z.string().url().default('http://localhost:4200'),

  // Inbound email → channel (brief §5). A provider (Postmark / Mailgun style)
  // parses incoming mail and POSTs it to `/api/v1/email/inbound?secret=…`.
  // `INBOUND_EMAIL_DOMAIN` is the domain channel addresses are minted under;
  // leaving `INBOUND_EMAIL_SECRET` unset disables the webhook (403).
  INBOUND_EMAIL_DOMAIN: z.string().default('inbound.onetab.ai'),
  INBOUND_EMAIL_SECRET: z.string().optional(),

  // Huddle media (brief §6/§7). Base URL of an Element Call / MatrixRTC
  // deployment; the client embeds it in the huddle's room. Unset ⇒ huddles are
  // presence-only (participants + the conversation thread, no media).
  ELEMENT_CALL_URL: z.string().url().optional(),

  // Multi-App API Integration Configuration
  ENCRYPTION_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  CUSTOM_API_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
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
