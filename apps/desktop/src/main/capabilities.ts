import { app, Notification } from 'electron';
import type { DesktopCapabilities, DesktopPlatform } from '../shared/ipc.js';
import { USES_CUSTOM_TITLE_BAR } from './window.js';

export function detectDesktopCapabilities(): DesktopCapabilities {
  const platform = process.platform as DesktopPlatform;
  const isMas = Boolean(process.mas || process.env['IS_MAS'] || process.env['APP_STORE']);
  const canUpdate = app.isPackaged && !isMas;
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
