import { AsyncLocalStorage } from 'node:async_hooks';
import type { ConfigService } from '@nestjs/config';

/**
 * A workspace's own OAuth client credentials, keyed like the env vars they
 * replace (`GITHUB_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, …). Providers read
 * their client through `oauthEnv`, so the same adapter code serves the server's
 * env credentials and a workspace's own app without knowing which.
 */
const store = new AsyncLocalStorage<ReadonlyMap<string, string>>();

export function runWithOAuthOverrides<T>(overrides: ReadonlyMap<string, string>, fn: () => T): T {
  return overrides.size === 0 ? fn() : store.run(overrides, fn);
}

/** The workspace's override for `key` if one is in scope, else the server config value. */
export function oauthEnv(config: Pick<ConfigService, 'get'>, key: string): string | undefined {
  return store.getStore()?.get(key) ?? config.get<string>(key);
}
