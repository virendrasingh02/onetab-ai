import { app, Notification } from 'electron';
import type { DesktopCapabilities, DesktopDistribution, DesktopPlatform } from '../shared/ipc.js';
import { USES_CUSTOM_TITLE_BAR } from './window.js';

/**
 * True inside a Mac App Store build. `process.mas` is Electron's own flag,
 * set only when the app was built with `mas` as the packaging target;
 * `IS_MAS`/`APP_STORE` let a non-mas-packaged dev build simulate one for
 * testing this file's branches without an actual MAS build.
 */
export function isMasBuild(): boolean {
  return Boolean(process.mas || process.env['IS_MAS'] || process.env['APP_STORE']);
}

/**
 * True inside an MSIX/APPX (Microsoft Store) package. `process.windowsStore`
 * is Electron's own flag for this — real, but currently untested end-to-end:
 * no `appx` electron-builder target exists yet to produce a build that would
 * set it. See DESKTOP_STORE_COMPLIANCE_AUDIT.md.
 */
export function isWindowsStoreBuild(): boolean {
  return process.platform === 'win32' && Boolean(process.windowsStore);
}

/** This build's distribution channel — the single place the two checks above are combined. */
export function detectDistribution(): DesktopDistribution {
  if (isMasBuild()) return 'mac-app-store';
  if (isWindowsStoreBuild()) return 'microsoft-store';
  return 'direct';
}

export function detectDesktopCapabilities(): DesktopCapabilities {
  const platform = process.platform as DesktopPlatform;
  const distribution = detectDistribution();
  const canUpdate = app.isPackaged && distribution === 'direct';
  const canNotify = Notification.isSupported();

  const supportedFeatures: string[] = [
    'authentication',
    'deepLinks',
    'filesystem',
    'clipboard',
    'windowControls',
  ];

  const unsupportedFeatures: string[] = [];

  if (canNotify) {
    supportedFeatures.push('notifications');
  } else {
    unsupportedFeatures.push('notifications');
  }

  if (canUpdate) {
    supportedFeatures.push('appUpdates');
  } else {
    unsupportedFeatures.push('appUpdates');
  }

  // Windows and macOS support login item / startup background launching natively
  if (platform === 'win32' || platform === 'darwin') {
    supportedFeatures.push('autoLaunch');
  } else {
    unsupportedFeatures.push('autoLaunch');
  }

  // Window title bar / frame controls
  if (USES_CUSTOM_TITLE_BAR) {
    supportedFeatures.push('customTitleBar');
  }

  return {
    isDesktop: true,
    platform,
    distribution,
    architecture: process.arch,
    authentication: true,
    notifications: canNotify,
    deepLinks: true,
    appUpdates: canUpdate,
    autoLaunch: platform === 'win32' || platform === 'darwin',
    filesystem: true,
    clipboard: true,
    screenshots: false, // reserved for future native screen grabber
    windowControls: true,
    supportedFeatures,
    unsupportedFeatures,
  };
}
