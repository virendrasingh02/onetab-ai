import type { Distribution, DistributionPolicy, PlatformOS } from '../types.js';
import { appleAppStorePolicy } from './apple-app-store.js';
import { appleDirectPolicy } from './apple-direct.js';
import { linuxPolicy } from './linux.js';
import { microsoftDirectPolicy } from './microsoft-direct.js';
import { microsoftStorePolicy } from './microsoft-store.js';
import { webPolicy } from './web.js';

export {
  appleAppStorePolicy,
  appleDirectPolicy,
  linuxPolicy,
  microsoftDirectPolicy,
  microsoftStorePolicy,
  webPolicy,
};

/**
 * `distribution` alone is ambiguous — `'direct'` means something different on
 * each OS — so the lookup key pairs it with `platform`. `windows +
 * mac-app-store` and similar nonsense combinations simply aren't in this
 * table and fall through to the safe default below.
 */
const POLICY_BY_KEY: Record<string, DistributionPolicy> = {
  'macos:direct': appleDirectPolicy,
  'macos:mac-app-store': appleAppStorePolicy,
  'windows:direct': microsoftDirectPolicy,
  'windows:microsoft-store': microsoftStorePolicy,
  'linux:direct': linuxPolicy,
  'web:web': webPolicy,
};

/**
 * Resolves the rulebook for a (platform, distribution) pair.
 *
 * An unrecognized combination — which should not happen outside a bug in the
 * runtime's own detection — fails safe to `webPolicy`, the most conservative
 * policy (nothing is store-restricted, but nothing desktop-only can satisfy
 * `platforms` under it either).
 */
export function resolvePolicy(platform: PlatformOS, distribution: Distribution): DistributionPolicy {
  return POLICY_BY_KEY[`${platform}:${distribution}`] ?? webPolicy;
}
