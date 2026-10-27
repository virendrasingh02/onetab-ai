import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from './logger.js';

/**
 * The three URLs the shell juggles, which are easy to conflate and must not be:
 *
 * - `appUrl`: where the renderer is loaded from. Vite in dev; the internal
 *   `localhost` static server in a packaged build. Never a place to sign in.
 * - `apiUrl`: the REST API, including its `/api/v1` prefix. Used by the main
 *   process directly (sign-in exchange, token refresh, background sync, update
 *   check) — the renderer has its own copy baked into the web bundle.
 * - `webUrl`: the public web app the *system browser* is sent to (sign-in,
 *   "open in browser"). In a packaged build this is not `appUrl`: that origin
 *   only exists while the desktop app is running.
 * - `updateUrl`: the folder `electron-builder` publishes `latest.yml` and the
 *   installer to. Optional: without it the app still offers updates through the
 *   API, by opening the installer's download page, but cannot install them itself.
 */
export interface DesktopRuntimeConfig {
  appUrl: string;
  apiUrl: string;
  webUrl: string;
  updateUrl: string | null;
  /** Where each value came from — surfaced in logs so a mis-pointed build is obvious. */
  sources: { apiUrl: ConfigSource; webUrl: ConfigSource };
}

export type ConfigSource = 'env' | 'build-config' | 'default';

/** Written next to the icons by `scripts/write-config.mjs` when packaging. */
export const CONFIG_FILE_NAME = 'desktop-config.json';

export const DEFAULT_API_URL = 'http://localhost:3000/api/v1';

export interface BuildTimeConfig {
  apiUrl?: string;
  webUrl?: string;
  updateUrl?: string;
}

/** Accepts only absolute http(s) URLs, without a trailing slash. */
export function normalizeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function pick(
  candidates: Array<[ConfigSource, unknown]>,
): { value: string; source: ConfigSource } | null {
  for (const [source, raw] of candidates) {
    const value = normalizeUrl(raw);
    if (value) return { value, source };
  }
  return null;
}

export interface ResolveConfigInput {
  appUrl: string;
  env: Record<string, string | undefined>;
  buildConfig: BuildTimeConfig;
}

/**
 * Precedence is environment → build-time file → default, so a developer can
 * always override a packaged build from the shell and a release never depends
 * on the machine it is launched from.
 */
export function resolveRuntimeConfig({
  appUrl,
  env,
  buildConfig,
}: ResolveConfigInput): DesktopRuntimeConfig {
  const api = pick([
    ['env', env['ONETAB_API_URL']],
    ['env', env['VITE_API_URL']],
    ['build-config', buildConfig.apiUrl],
  ]);
  const web = pick([
    ['env', env['ONETAB_WEB_URL']],
    ['build-config', buildConfig.webUrl],
  ]);
  const update = pick([
    ['env', env['ONETAB_UPDATE_URL']],
    ['build-config', buildConfig.updateUrl],
  ]);

  return {
    appUrl,
    apiUrl: api?.value ?? DEFAULT_API_URL,
    webUrl: web?.value ?? appUrl,
    updateUrl: update?.value ?? null,
    sources: { apiUrl: api?.source ?? 'default', webUrl: web?.source ?? 'default' },
  };
}

/** Reads the packaged config; absence is normal in development. */
export function readBuildConfig(resourcesDir: string): BuildTimeConfig {
  const path = join(resourcesDir, CONFIG_FILE_NAME);
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    return {
      apiUrl: typeof parsed['apiUrl'] === 'string' ? parsed['apiUrl'] : undefined,
      webUrl: typeof parsed['webUrl'] === 'string' ? parsed['webUrl'] : undefined,
      updateUrl: typeof parsed['updateUrl'] === 'string' ? parsed['updateUrl'] : undefined,
    };
  } catch (error) {
    logger.warn('Config', `Ignoring unreadable ${CONFIG_FILE_NAME}`, error);
    return {};
  }
}

export function loadRuntimeConfig(
  appUrl: string,
  resourcesDir: string,
  isDev: boolean,
): DesktopRuntimeConfig {
  const config = resolveRuntimeConfig({
    appUrl,
    env: process.env,
    // `nx package` leaves the file in `resources/`, which a dev run reads too.
    // Letting it through would point `nx serve` at whatever environment was
    // packaged last, so development only ever follows its own environment.
    buildConfig: isDev ? {} : readBuildConfig(resourcesDir),
  });

  logger.info(
    'Config',
    `API ${new URL(config.apiUrl).origin} (${config.sources.apiUrl}), web ${new URL(config.webUrl).origin} (${config.sources.webUrl})`,
  );

  // A packaged build that never learned its API would sign in against the
  // user's own machine and fail with a generic "could not reach the server".
  if (!isDev && config.sources.apiUrl === 'default') {
    logger.warn(
      'Config',
      `No API URL configured for this build; falling back to ${DEFAULT_API_URL}. Package with VITE_API_URL set.`,
    );
  }
  return config;
}
