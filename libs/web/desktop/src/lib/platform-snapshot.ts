import type { CapabilityKey, Distribution, PlatformOS, PlatformSnapshot, Runtime } from '@org/platform';
import type { DesktopCapabilities } from './desktop-api.js';

function normalizePlatform(caps: DesktopCapabilities): PlatformOS {
  switch (caps.platform) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'macos';
    case 'linux':
      return 'linux';
    default:
      return 'web';
  }
}

/**
 * Turns the live `DesktopCapabilities` (from the Electron bridge, or the web
 * defaults) into the generic `PlatformSnapshot` `@org/platform` evaluates
 * features against. This is the one seam between "what the bridge reports"
 * and "what the feature engine decides" — nothing else in this package
 * should construct a `PlatformSnapshot` by hand.
 */
export function toPlatformSnapshot(caps: DesktopCapabilities): PlatformSnapshot {
  const platform = normalizePlatform(caps);
  const runtime: Runtime = caps.isDesktop ? 'electron' : 'browser';
  const distribution: Distribution = caps.isDesktop ? (caps.distribution ?? 'direct') : 'web';

  const capabilities: Partial<Record<CapabilityKey, boolean>> = {
    authentication: caps.authentication,
    notifications: caps.notifications,
    deepLinks: caps.deepLinks,
    appUpdates: caps.appUpdates,
    autoLaunch: caps.autoLaunch,
    filesystem: caps.filesystem,
    clipboard: caps.clipboard,
    screenshots: caps.screenshots,
    windowControls: caps.windowControls,
  };

  return { platform, runtime, distribution, architecture: caps.architecture, capabilities, planTier: null };
}
