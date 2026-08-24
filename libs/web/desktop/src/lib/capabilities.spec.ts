import { describe, expect, it } from 'vitest';
import { isFeatureAvailable, WEB_DEFAULT_CAPABILITIES } from './capabilities.js';
import type { DesktopCapabilities } from './desktop-api.js';

describe('isFeatureAvailable', () => {
  it('correctly reports available and unavailable features on web capabilities', () => {
    expect(isFeatureAvailable('authentication', WEB_DEFAULT_CAPABILITIES)).toBe(true);
    expect(isFeatureAvailable('appUpdates', WEB_DEFAULT_CAPABILITIES)).toBe(false);
    expect(isFeatureAvailable('filesystem', WEB_DEFAULT_CAPABILITIES)).toBe(false);
    expect(isFeatureAvailable('windowControls', WEB_DEFAULT_CAPABILITIES)).toBe(false);
  });

  it('correctly reports desktop features when capabilities are enabled', () => {
    const desktopCaps: DesktopCapabilities = {
      ...WEB_DEFAULT_CAPABILITIES,
      isDesktop: true,
      platform: 'win32',
      appUpdates: true,
      filesystem: true,
      windowControls: true,
      supportedFeatures: ['authentication', 'appUpdates', 'filesystem', 'windowControls'],
      unsupportedFeatures: [],
    };

    expect(isFeatureAvailable('appUpdates', desktopCaps)).toBe(true);
    expect(isFeatureAvailable('filesystem', desktopCaps)).toBe(true);
    expect(isFeatureAvailable('windowControls', desktopCaps)).toBe(true);
  });
});
