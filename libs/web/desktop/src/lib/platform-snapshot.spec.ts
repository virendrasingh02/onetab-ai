import { describe, expect, it } from 'vitest';
import { WEB_DEFAULT_CAPABILITIES } from './capabilities.js';
import type { DesktopCapabilities } from './desktop-api.js';
import { toPlatformSnapshot } from './platform-snapshot.js';

describe('toPlatformSnapshot', () => {
  it('maps the web defaults to the web platform/runtime/distribution', () => {
    const snapshot = toPlatformSnapshot(WEB_DEFAULT_CAPABILITIES);
    expect(snapshot.platform).toBe('web');
    expect(snapshot.runtime).toBe('browser');
    expect(snapshot.distribution).toBe('web');
  });

  it('normalizes Electron platform strings to the product-facing names', () => {
    const base: DesktopCapabilities = {
      ...WEB_DEFAULT_CAPABILITIES,
      isDesktop: true,
      distribution: 'direct',
    };

    expect(toPlatformSnapshot({ ...base, platform: 'win32' }).platform).toBe('windows');
    expect(toPlatformSnapshot({ ...base, platform: 'darwin' }).platform).toBe('macos');
    expect(toPlatformSnapshot({ ...base, platform: 'linux' }).platform).toBe('linux');
  });

  it('carries the real distribution through for a desktop session', () => {
    const snapshot = toPlatformSnapshot({
      ...WEB_DEFAULT_CAPABILITIES,
      isDesktop: true,
      platform: 'darwin',
      distribution: 'mac-app-store',
    });
    expect(snapshot.runtime).toBe('electron');
    expect(snapshot.distribution).toBe('mac-app-store');
  });

  it('falls back to "direct" if a desktop session somehow has no distribution set', () => {
    const snapshot = toPlatformSnapshot({
      ...WEB_DEFAULT_CAPABILITIES,
      isDesktop: true,
      platform: 'win32',
      distribution: undefined,
    });
    expect(snapshot.distribution).toBe('direct');
  });

  it('carries every boolean capability across unchanged', () => {
    const caps: DesktopCapabilities = {
      ...WEB_DEFAULT_CAPABILITIES,
      isDesktop: true,
      platform: 'win32',
      distribution: 'direct',
      appUpdates: true,
      autoLaunch: true,
      windowControls: true,
    };
    const snapshot = toPlatformSnapshot(caps);
    expect(snapshot.capabilities).toMatchObject({
      authentication: caps.authentication,
      notifications: caps.notifications,
      deepLinks: caps.deepLinks,
      appUpdates: true,
      autoLaunch: true,
      filesystem: caps.filesystem,
      clipboard: caps.clipboard,
      screenshots: caps.screenshots,
      windowControls: true,
    });
  });
});
