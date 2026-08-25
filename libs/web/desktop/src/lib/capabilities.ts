import { useEffect, useState } from 'react';
import {
  getDesktopApi,
  isDesktop,
  type DesktopCapabilities,
} from './desktop-api.js';

export const WEB_DEFAULT_CAPABILITIES: DesktopCapabilities = {
  isDesktop: false,
  platform: 'web',
  architecture: typeof navigator !== 'undefined' ? (navigator.userAgent.includes('x64') ? 'x64' : 'arm64') : 'unknown',
  authentication: true,
  notifications: typeof Notification !== 'undefined',
  deepLinks: false,
  appUpdates: false,
  autoLaunch: false,
  filesystem: false,
  clipboard: typeof navigator !== 'undefined' && 'clipboard' in navigator,
  screenshots: false,
  windowControls: false,
  supportedFeatures: ['authentication', 'clipboard'],
  unsupportedFeatures: ['appUpdates', 'autoLaunch', 'filesystem', 'windowControls', 'deepLinks'],
};

let cachedCapabilities: DesktopCapabilities = isDesktop
  ? {
      ...WEB_DEFAULT_CAPABILITIES,
      isDesktop: true,
      platform: 'win32', // default before async query
      distribution: 'direct', // default before async query — the most permissive guess, corrected within one tick
      deepLinks: true,
      windowControls: true,
      filesystem: true,
    }
  : WEB_DEFAULT_CAPABILITIES;

/**
 * Checks if a specific feature is available in the current runtime.
 */
export function isFeatureAvailable(
  feature: keyof DesktopCapabilities | string,
  capabilities: DesktopCapabilities = cachedCapabilities,
): boolean {
  if (feature in capabilities) {
    const value = capabilities[feature as keyof DesktopCapabilities];
    return typeof value === 'boolean' ? value : Boolean(value);
  }
  return capabilities.supportedFeatures.includes(feature as string);
}

export const desktop = {
  capabilities: {
    get: (): DesktopCapabilities => cachedCapabilities,
    isAvailable: (feature: keyof DesktopCapabilities | string): boolean =>
      isFeatureAvailable(feature, cachedCapabilities),
  },
};

/**
 * Hook subscribing to desktop runtime capabilities.
 */
export function useCapabilities(): DesktopCapabilities {
  const [capabilities, setCapabilities] = useState<DesktopCapabilities>(cachedCapabilities);

  useEffect(() => {
    const api = getDesktopApi();
    if (!api) return;

    let active = true;
    void api.capabilities.get().then((caps) => {
      if (active) {
        cachedCapabilities = caps;
        setCapabilities(caps);
      }
    });

    const unsubscribe = api.capabilities.onChange((caps) => {
      cachedCapabilities = caps;
      setCapabilities(caps);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return capabilities;
}

/**
 * Hook checking if a specific feature is available.
 */
export function useDesktopCapability(feature: keyof DesktopCapabilities | string): boolean {
  const capabilities = useCapabilities();
  return isFeatureAvailable(feature, capabilities);
}

export function supportsTaskbarFlash(
  capabilities: DesktopCapabilities = cachedCapabilities,
): boolean {
  return capabilities.isDesktop && capabilities.platform === 'win32';
}

export function supportsSystemSettings(
  capabilities: DesktopCapabilities = cachedCapabilities,
): boolean {
  return capabilities.isDesktop && capabilities.platform === 'win32';
}

export function useTaskbarFlashSupported(): boolean {
  const capabilities = useCapabilities();
  return supportsTaskbarFlash(capabilities);
}

export function useSystemSettingsSupported(): boolean {
  const capabilities = useCapabilities();
  return supportsSystemSettings(capabilities);
}
